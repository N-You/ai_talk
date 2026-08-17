import router from "@/router";
import { showToast } from "vant";
import { transcribeAudio, UploadError } from "@/utils/chunkedUpload";

/**
 * 请求层统一出口：所有后端 API 的封装。
 * - H5 走同源相对路径，由 vite/nginx 代理 /api 与 /ws 到后端
 * - token 内存 + localStorage 双层管理，401 全局登出
 * - 按领域分组成语义化 API 对象，页面只依赖这里，不直接 fetch
 */

// API 基础配置（H5：走同源相对路径，由 vite/nginx 代理 /api 与 /ws 到后端）
const BASE_URL = "";
/** WebSocket 地址：随页面协议自动切换 ws/wss */
export const WS_URL = `${location.protocol === "https:" ? "wss://" : "ws://"}${location.host}`;

interface RequestOptions {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  data?: any;
}

// Token 管理（localStorage 持久化）
const TOKEN_KEY = "token";
let token: string | null = null;

/** 保存 token（写内存 + localStorage，刷新不丢登录态） */
export function setToken(t: string) {
  token = t;
  localStorage.setItem(TOKEN_KEY, t);
}

/** 读取 token：内存未命中时从 localStorage 惰性加载 */
export function getToken(): string {
  if (token === null) {
    token = localStorage.getItem(TOKEN_KEY);
  }
  return token || "";
}

/** 清除 token（登出/401 时调用） */
export function clearToken() {
  token = null;
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * 通用请求方法（fetch 封装）：
 * 1. 自动注入 Authorization: Bearer token
 * 2. 网络异常统一 toast
 * 3. 401 全局处理：清 token 跳 /profile（一次实现全局登出）
 * 4. 统一 JSON 解析；非 2xx 抛响应体
 */
async function request<T = any>(options: RequestOptions): Promise<T> {
  const { url, method = "GET", data } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const t = getToken();
  if (t) headers["Authorization"] = `Bearer ${t}`;

  let resp: Response;
  try {
    resp = await fetch(`${BASE_URL}${url}`, {
      method,
      headers,
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  } catch {
    showToast("网络异常，请检查连接");
    throw new Error("network error");
  }

  if (resp.status === 401) {
    clearToken();
    router.replace("/profile");
    throw new Error("unauthorized");
  }

  const text = await resp.text();
  const json = text ? JSON.parse(text) : null;

  if (resp.status >= 200 && resp.status < 300) return json as T;
  throw json ?? new Error(`HTTP ${resp.status}`);
}

// ── API 接口 ──────────────────────────────────

// 认证
export const authApi = {
  login: (nickname: string) =>
    request<{ access_token: string; user: any }>({
      url: "/api/auth/login",
      method: "POST",
      data: { nickname },
    }),
  register: (nickname: string) =>
    request<{ access_token: string; user: any }>({
      url: "/api/auth/register",
      method: "POST",
      data: { nickname },
    }),
};

// 用户
export const userApi = {
  getProfile: () => request<any>({ url: "/api/user/profile" }),
  updateProfile: (data: any) =>
    request<any>({ url: "/api/user/profile", method: "PUT", data }),
  getSettings: () => request<any>({ url: "/api/user/settings" }),
  updateSettings: (data: { apiKey?: string; apiBase?: string; model?: string }) =>
    request<any>({ url: "/api/user/settings", method: "PUT", data }),
};

// 场景
export const scenarioApi = {
  list: (category?: string) =>
    request<any[]>({
      url: `/api/scenarios${category ? `?category=${category}` : ""}`,
    }),
  detail: (id: number) => request<any>({ url: `/api/scenarios/${id}` }),
};

// 对话
export const conversationApi = {
  create: (scenarioId: number) =>
    request<any>({ url: "/api/conversations", method: "POST", data: { scenario_id: scenarioId } }),
  list: () => request<any[]>({ url: "/api/conversations" }),
  detail: (id: number) => request<any>({ url: `/api/conversations/${id}` }),
  end: (id: number, data: any) =>
    request<any>({ url: `/api/conversations/${id}/end`, method: "PUT", data }),
  /** 单词释义查询（对话中点击单词弹窗）：返回 { word, phonetic, meaning, example } */
  explainWord: (word: string) =>
    request<any>({ url: "/api/conversations/explain-word", method: "POST", data: { word } }),
};

// 学习库
export const learningApi = {
  list: (params?: { page?: number; size?: number; type?: string; status?: string }) => {
    let qs = "";
    if (params) {
      qs =
        "?" +
        Object.entries(params)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => `${k}=${v}`)
          .join("&");
    }
    return request<any>({ url: `/api/learning-items${qs}` });
  },
  add: (content: string) =>
    request<any>({ url: "/api/learning-items", method: "POST", data: { content } }),
  detail: (id: number) => request<any>({ url: `/api/learning-items/${id}` }),
  delete: (id: number) =>
    request<any>({ url: `/api/learning-items/${id}`, method: "DELETE" }),
  review: (id: number, result: string) =>
    request<any>({
      url: `/api/learning-items/${id}/review`,
      method: "POST",
      data: { result },
    }),
};

// 语音 (ASR: 录音文件 -> 文本)
export const speechApi = {
  /**
   * 语音转写：底层走 chunkedUpload 增强层（超时 + 指数退避重试 + 大文件分片）。
   * language 为可选语言提示；不确定或中英混合时不要传，让模型自动检测更准。
   */
  transcribe: async (
    input: { filePath?: string; file?: Blob | any; mimeType?: string },
    language?: string,
  ) => {
    const t = getToken();
    let file: Blob;
    let mimeType = input.mimeType ?? "audio/webm";

    if (input.file) {
      file = input.file;
    } else if (input.filePath) {
      file = await fetch(input.filePath).then((r) => r.blob());
      mimeType = file.type || mimeType;
    } else {
      throw new Error("缺少音频文件");
    }

    try {
      return await transcribeAudio(file, mimeType, { language, token: t });
    } catch (e: any) {
      // 401 走统一登出逻辑；其余错误向上抛给调用方 toast
      if (e instanceof UploadError && e.status === 401) {
        clearToken();
        router.replace("/profile");
      }
      throw e;
    }
  },
  // TTS: 文本 -> 音频 Blob（30s 超时：防上游挂起让"播放/聆听恢复"永久等待，与 chunkedUpload 对齐）
  synthesize: async (text: string, voice?: string): Promise<Blob> => {
    const t = getToken();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    try {
      const resp = await fetch(`${BASE_URL}/api/speech/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
        },
        body: JSON.stringify({ text, voice }),
        signal: ctrl.signal,
      });
      if (resp.status === 401) {
        clearToken();
        router.replace("/profile");
      }
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        throw new Error(data?.message || "语音朗读失败");
      }
      return resp.blob();
    } finally {
      clearTimeout(timer);
    }
  },
};
