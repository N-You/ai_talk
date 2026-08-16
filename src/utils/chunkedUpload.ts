/**
 * 语音转写上传增强层 —— 分片上传策略优化（2026-08）。
 *
 * 旧版问题：整段 Blob 一次 multipart POST，无超时、无重试。
 * 移动网络抖动时极易出现：连接被掐 → 请求截断 → 后端收到不完整音频
 * → 识别报错或"接收不全"。
 *
 * 本模块提供三层保障：
 * 1. 超时控制：单次请求 60s 上限（AbortController），超过直接放弃本次重试，
 *    不会让页面无限挂起。
 * 2. 指数退避重试：网络错误 / 5xx / 429 自动重试（最多 MAX_RETRY 次，
 *    退避 0.6s × 2^n + 随机抖动），抖动可避免多个请求同时重试打爆网关。
 * 3. 大文件分片：> 1MB 自动走分片上传（1MB/片、顺序传、每片独立重试），
 *    单片失败只需重传单片，避免"一整段重来"。
 *
 * 后端配套：POST /api/speech/transcribe-chunked（末片到达自动拼接 + 转写），
 * 见 ai_talk_backend-nest/src/speech/speech.controller.ts。
 */

/** 单请求超时（毫秒） */
const REQUEST_TIMEOUT_MS = 60_000;
/** 单片/单请求最大重试次数 */
const MAX_RETRY = 2;
/** 指数退避基数（毫秒）：0.6s × 2^n */
const RETRY_BASE_MS = 600;
/** 分片大小（字节）：≤1MB 走直传，>1MB 走分片 */
const CHUNK_SIZE = 1024 * 1024;

/** 上传错误：带 HTTP 状态码，供上层做 401 登出等特殊处理 */
export class UploadError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 单次 fetch（带超时）。超时/网络错误抛 UploadError(undefined status)，
 * HTTP 非 2xx 抛 UploadError(status)。
 */
async function postForm(url: string, form: FormData, token: string): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
      signal: ctrl.signal,
    });
    if (resp.status === 401) {
      throw new UploadError("unauthorized", 401);
    }
    const data = await resp.json().catch(() => ({}));
    if (resp.status >= 200 && resp.status < 300) return data;
    throw new UploadError(data?.message || `HTTP ${resp.status}`, resp.status);
  } catch (e: any) {
    if (e instanceof UploadError) throw e;
    // AbortController 超时中止
    if (e?.name === "AbortError") throw new UploadError("上传超时");
    throw new UploadError(e?.message || "网络异常");
  } finally {
    clearTimeout(timer);
  }
}

/** 判断是否需要重试：网络错误 / 超时（无 status）或服务端 5xx / 429 */
function shouldRetry(e: UploadError): boolean {
  if (!e.status) return true;
  return e.status >= 500 || e.status === 429;
}

/** 带重试的上传：对可重试错误做指数退避重试，最多 MAX_RETRY 次 */
async function uploadWithRetry(url: string, form: FormData, token: string): Promise<any> {
  let lastErr: UploadError | null = null;
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      return await postForm(url, form, token);
    } catch (e) {
      if (!(e instanceof UploadError)) throw e;
      if (!shouldRetry(e) || attempt >= MAX_RETRY) throw e; // 不可重试或已到次数
      lastErr = e;
      // 指数退避 + 抖动（±30%），避免并发重试踩踏
      const delay = RETRY_BASE_MS * 2 ** attempt * (0.7 + Math.random() * 0.6);
      console.warn(`[chunkedUpload] 上传失败，${Math.round(delay)}ms 后重试 (${attempt + 1}/${MAX_RETRY})`, e.message);
      await sleep(delay);
    }
  }
  throw lastErr ?? new UploadError("上传失败");
}

/** 直传：整段 ≤ 1MB 时一次传完 */
async function uploadDirect(
  file: Blob,
  mimeType: string,
  language: string | undefined,
  token: string,
): Promise<any> {
  const form = new FormData();
  const ext = (mimeType || "audio/webm").split("/")[1]?.split(";")[0] || "webm";
  form.append("file", file, `record_${Date.now()}.${ext}`);
  if (language) form.append("language", language);
  return uploadWithRetry("/api/speech/transcribe", form, token);
}

/**
 * 分片上传：> 1MB 时切成 1MB/片顺序传，每片独立重试。
 * 末片请求由后端完成"拼接 + 转写"并直接返回识别结果。
 */
async function uploadChunked(
  file: Blob,
  mimeType: string,
  language: string | undefined,
  token: string,
): Promise<any> {
  const total = Math.ceil(file.size / CHUNK_SIZE);
  // 前端生成唯一上传会话 ID（时间戳 + 随机串），后端按它聚拢分片
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const ext = (mimeType || "audio/webm").split("/")[1]?.split(";")[0] || "webm";
  const fileName = `record_${Date.now()}.${ext}`;

  let result: any;
  for (let i = 0; i < total; i++) {
    const form = new FormData();
    form.append("file", file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE), fileName);
    form.append("uploadId", uploadId);
    form.append("index", String(i));
    form.append("total", String(total));
    form.append("mimeType", mimeType);
    if (language) form.append("language", language);
    // 注意：只有末片会带识别结果返回（后端末片到达才拼接转写）
    result = await uploadWithRetry("/api/speech/transcribe-chunked", form, token);
  }
  return result;
}

export interface TranscribeAudioOptions {
  language?: string; // 语言提示（ISO 639-1），不确定/混合语言请勿传（自动检测更准）
  token?: string; // Bearer token
}

/**
 * 语音转写入口：按文件大小自动选择 直传 / 分片上传，内置超时 + 重试。
 * @returns 后端返回体，形如 { text: string }
 */
export async function transcribeAudio(
  file: Blob,
  mimeType: string,
  opts: TranscribeAudioOptions = {},
): Promise<any> {
  const token = opts.token ?? "";
  if (!file || file.size === 0) throw new UploadError("音频为空");
  return file.size <= CHUNK_SIZE
    ? uploadDirect(file, mimeType, opts.language, token)
    : uploadChunked(file, mimeType, opts.language, token);
}
