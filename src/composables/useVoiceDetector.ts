import { ref } from "vue";
import { showToast } from "vant";

/**
 * 语音活动检测（VAD）+ 静音分段录音工具 —— 音频优化版（2026-08）。
 *
 * 相比旧版的三处结构性升级（解决"识别错误 / 接收不全"的根因）：
 *
 * 1. 收音质量（前端收音优化 + 开启回声消除）
 *    - getUserMedia 显式开启 echoCancellation / noiseSuppression / autoGainControl，
 *      并用 { ideal: true } 而非 { exact: true } —— 不支持强制的浏览器自动降级，
 *      不会因约束过严导致 getUserMedia 直接报错。
 *    - 单声道采集（channelCount ideal:1）：体积减半、网络传输更快，ASR 单声道足够。
 *
 * 2. 降噪底层逻辑（短剧降噪底层逻辑优化 + 参数调优）
 *    - 自适应噪声地板：持续对"非说话期间"的 RMS 做慢速 EMA 估计，
 *      触发阈值 = max(噪声地板 × triggerRatio, 下限)，嘈杂环境自动抬高、
 *      安静环境自动降低，告别旧版固定 0.02 阈值"环境音一响就误触发"。
 *    - 迟滞判断（hysteresis）：说话判定用高阈值（trigger），持续说话判定用
 *      低阈值（release）。防止阈值附近的抖动导致一句话被拦腰截断
 *      （"接收不全"的头号原因）。
 *    - 预卷（preRoll）：说话起点前保留最近几个切片，避免句首音节被 VAD 判定
 *      延迟"切掉"；句尾通过 requestData() 主动取缓冲补尾（postRoll 语义），
 *      防止最后一个辅音/尾音丢失。
 *
 * 3. 分段与资源
 *    - 切片缓冲带内存上限（空闲只留最近 maxIdleChunks 片），长时聆听不涨内存。
 *    - MediaRecorder error 事件、AudioContext 挂起恢复（iOS Safari）均有处理。
 *
 * 音量估计用 AnalyserNode 时域 RMS（0~1），每帧做轻量 EMA 平滑，
 * 再与自适应阈值比较，避免单帧毛刺。
 */

export type VoiceState = "idle" | "listening";

export interface VoiceDetectorOptions {
  /** 最小有效语音段（毫秒），小于此长度视为环境噪音直接丢弃 */
  minSpeechMs?: number;
  /** 单段最大时长（毫秒），超时强制切段 —— 兼顾 DashScope base64 10MB 上限 */
  maxSpeechMs?: number;
  /** 静音持续多久判定一句话结束（毫秒） */
  silenceMs?: number;
  /** 噪声地板下限（0~1）：绝对安静时触发阈值也不会低于它 */
  thresholdFloor?: number;
  /** 触发阈值 = 噪声地板 × triggerRatio（抬升系数，越大越"迟钝"） */
  triggerRatio?: number;
  /** 迟滞释放系数：说话中 RMS 低于 噪声地板 × releaseRatio 才开始累计静音 */
  releaseRatio?: number;
  /** 噪声地板 EMA 更新速率（每次分析帧的权重，越小越平滑） */
  noiseAdaptRate?: number;
  /** 预卷时长（毫秒）：句首前保留的音频，防止开头被切（取整到切片粒度） */
  preRollMs?: number;
  /** MediaRecorder 切片间隔（毫秒） */
  chunkMs?: number;
  /** 空闲时缓冲最多保留的切片数（内存上限 = chunkMs × 该值） */
  maxIdleChunks?: number;
  /** 每切出一个语音段回调 */
  onSegment?: (blob: Blob, mimeType: string) => void;
}

/** 默认参数（经实测调优，详见 docs/音频识别优化方案.md） */
const DEFAULT_OPTIONS: Omit<Required<VoiceDetectorOptions>, "onSegment"> = {
  minSpeechMs: 500, // <0.5s 视为噪音
  maxSpeechMs: 15000, // 单句最长 15s（旧版 20s：越长 base64 越大，越易超 DashScope 上限）
  silenceMs: 1200, // 静音 1.2s 判定一句结束。
  // ⚠️ 英语学习者说英文时思考停顿多（um/ah/换词），0.9s 会把句子切碎成 2~3s 碎片，
  // 每段单独转写丢上下文 → "英文识别差"。1.2s 在流畅度与不切碎间取平衡（2026-08-16）。
  thresholdFloor: 0.008, // 噪声地板下限（自适应抬升的基准）
  triggerRatio: 3.0, // 触发阈值 = max(噪声地板×3.0, 绝对下限 0.025)
  releaseRatio: 2.0, // 说话中低于 噪声地板×2.0 才开始计静音（迟滞，防抖动切段）
  noiseAdaptRate: 0.002, // 噪声地板 EMA 速率（很慢，避免说话声污染噪声估计）
  preRollMs: 400, // 句首预卷 400ms（≈2 个切片）
  chunkMs: 250,
  maxIdleChunks: 20, // 空闲保留 5s 缓冲
};

/**
 * 绝对触发下限（RMS）。历史（2026-08-16 排障过程）：
 * - 0.048（噪声地板×4 时代）："收不到"实为哨兵 bug（silenceStart=0）所致，
 *   阈值被误判为元凶，实际不是它
 * - 0.012：修完哨兵 bug 后调低 → **环境噪音(rms≈0.023)也能触发，未说话也识别**
 * - 0.025（当前）：压住常见环境噪音（键盘/远处声音 ~0.02），
 *   正常说话 RMS 0.05+ 仍轻松触发；若轻声/远麦场景触发不了再回调。
 * 自适应只负责"嘈杂环境自动抬高"，绝对下限负责安静环境的基准灵敏度。
 */
const ABS_TRIGGER_FLOOR = 0.025;
/** 绝对释放下限（低于它才算静音；与触发下限保持 ~36% 迟滞间距） */
const ABS_RELEASE_FLOOR = 0.016;

/**
 * 麦克风约束：显式开启回声消除/降噪/自动增益 + 单声道。
 * 全部用 { ideal }（尽力而为）而非 { exact }（强制），
 * 部分设备（如部分 iOS Safari 免提模式）不支持强制约束时自动降级，不会报错。
 *
 * ⚠️ noiseSuppression 对英文识别的取舍（2026-08-16 实测）：
 * 后端模型对"清晰英文"识别 100% 准确（TTS 对照实验），用户实时麦克风英文差
 * → 差异在采集链路。英文辅音（th/f/s/sh）集中在 4-8kHz 高频，noiseSuppression
 * 的频谱抑制可能削弱它们。若 A/B 测试发现关掉降噪后英文明显变准，
 * 把 USE_NOISE_SUPPRESSION 改为 false（代价：平稳环境噪音会进入 ASR）。
 */
const USE_NOISE_SUPPRESSION = true;

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: { ideal: true }, // 回声消除：避免外放 TTS / 对方声音被录进麦克风
  noiseSuppression: { ideal: USE_NOISE_SUPPRESSION }, // 降噪：见上方注释
  autoGainControl: { ideal: true }, // 自动增益：人离麦远近音量趋于一致
  channelCount: { ideal: 1 }, // 单声道：文件减半，ASR 无需立体声
};

/** 约束降级提示只弹一次（避免每次聆听都打扰） */
let constraintWarned = false;

/**
 * 录音码率（bps）：opus 默认 ~32kbps 会丢失英文高频辅音细节。
 * 128kbps 显著保留 4-8kHz 高频（th/f/s 等），2-3 秒段 ≈ 32-48KB，
 * 仍在直传/分片阈值内，代价可忽略。
 */
const RECORD_BITS_PER_SECOND = 128_000;

/** 优先选择的录音编码：opus 体积小音质好；webm/mp4 兜底跨平台 */
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

/** 按候选列表挑第一个浏览器支持的 MIME，全不支持则返回空串让浏览器自选 */
function pickMimeType(): string {
  for (const m of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

export function useVoiceDetector(options: VoiceDetectorOptions = {}) {
  // onSegment 由调用方注入（可选），默认缺省
  const opts = { ...DEFAULT_OPTIONS, onSegment: undefined as VoiceDetectorOptions["onSegment"], ...options };

  const state = ref<VoiceState>("idle");

  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let rafId = 0;

  /**
   * 连续音频切片缓冲（含静音），按需裁剪，供切段时按索引切片。
   * ⚠️ chunks[0] 是含 WebM EBML 文件头的首片 —— **永远保留、永不消费/裁剪**。
   * 每段拼装必须带上它，否则拼出的 webm 缺文件头 = 损坏文件，
   * DashScope 解码错乱 → "识别错误/大部分未识别"（2026-08-16 事故）。
   */
  let chunks: Blob[] = [];
  let currentMime = "audio/webm";

  // ── VAD 状态 ──
  let speaking = false; // 当前是否在说话（触发后进入，迟滞退出）
  let segmentStartChunk = 0; // 当前段在 chunks 中的起始索引（含预卷）
  let speechStartAt = 0; // 说话起点（performance.now）
  let speechLenAtFlush = 0; // 触发切段时记录的"实际说话时长"（供最短段过滤）
  // 静音起算时间；**用 -1 表示"未开始计时"，绝不能写 0**：
  // 0 会被 `now - silenceStart` 当成计时起点，silentFor = now 巨大 →
  // 说话第一帧就误判"静音超时"疯狂切段 → 所有段因太短被丢弃（2026-08-16 事故）
  let silenceStart = -1;
  let noiseFloor = opts.thresholdFloor; // 自适应噪声地板（RMS 慢速 EMA）
  let smoothedRms = 0; // 能量平滑值（每帧 EMA）
  let pendingFlush = false; // 已请求取尾、等待 dataavailable 后执行切段
  let flushTimer = 0; // 取尾兜底定时器（防止 recorder 异常导致 dataavailable 不触发）
  let disposed = false;
  /** 诊断日志节流：每 2s 打印一次能量/阈值/状态（DevTools 排障用，可删除） */
  let lastDebugLog = 0;
  /** 启动后记录的最大能量（用于 5s 弱信号自检告警） */
  let maxRmsSinceStart = 0;
  let lowSignalWarned = false;
  /** 本次聆听开始时间（performance.now），用于弱信号自检 */
  let listeningSince = 0;

  /**
   * 触发/释放阈值：
   * - 触发（开始说话）= max(噪声地板×triggerRatio, 绝对下限 0.02)
   * - 释放（结束说话）= max(噪声地板×releaseRatio, 绝对下限 0.012)
   * 自适应保证嘈杂环境自动抬高防误触发；绝对下限保证安静环境不丢灵敏度。
   */
  function triggerThreshold() {
    return Math.max(noiseFloor * opts.triggerRatio, ABS_TRIGGER_FLOOR);
  }
  function releaseThreshold() {
    return Math.max(noiseFloor * opts.releaseRatio, ABS_RELEASE_FLOOR);
  }

  /**
   * 真正执行切段（调用前必须保证 chunks 已包含尾部切片）：
   * 按 [segmentStartChunk, 当前末尾) 切片 → 消费掉已用缓冲（保留 preRoll 片供下段）→ 回调。
   */
  function doFlush() {
    pendingFlush = false;
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = 0;
    }
    if (!speaking) return; // 已被 stop() 重置，忽略本次
    speaking = false;
    silenceStart = -1; // 重置为"未计时"（不能用 0，理由见状态注释）
    if (chunks.length === 0) return; // 防御：录音刚启动还没有任何切片，直接丢弃

    const segmentEnd = chunks.length;
    // 本段 = [文件头片 chunks[0]] + [segmentStartChunk, segmentEnd)：
    // 预卷 + 说话内容 + 尾部补片。
    // **必须拼接 chunks[0]** —— 它是 WebM EBML 文件头，缺了音频文件损坏，
    // DashScope 只能"猜"着解码 → 识别错误/内容丢失。
    const header = chunks[0];
    const blob = new Blob([header, ...chunks.slice(segmentStartChunk, segmentEnd)], {
      type: currentMime,
    });
    // 保留 chunks[0]（文件头）+ 末尾 preRoll 片作为下一段的预卷，其余消费掉。
    // 注意：slice 起点从 index 1 开始，绝不动 index 0。
    const preRollChunks = Math.ceil(opts.preRollMs / opts.chunkMs);
    chunks = [chunks[0], ...chunks.slice(Math.max(1, segmentEnd - preRollChunks))];

    if (blob.size === 0 || speechLenAtFlush < opts.minSpeechMs) {
      // 调试：短段/空段被丢弃时记录原因，便于确认是 VAD 误触发还是真噪音
      console.debug(
        `[VAD] 段被丢弃 blob=${blob.size}B speech=${Math.round(speechLenAtFlush)}ms ` +
          `(min=${opts.minSpeechMs}ms)`,
      );
      return;
    }
    console.debug(`[VAD] 切段完成 blob=${blob.size}B speech=${Math.round(speechLenAtFlush)}ms`);
    opts.onSegment?.(blob, currentMime);
  }

  /**
   * 触发切段：
   * - 正常静音切段（awaitTail=true）：先 requestData() 让 MediaRecorder 把缓冲的
   *   尾部音频吐出来（补"句尾"），等下一次 dataavailable 把该片推入 chunks 后再
   *   由 ondataavailable → doFlush 真正切片 —— 否则会丢掉最后 0~250ms
   *   （"接收不全"的又一原因）。兜底：250ms 内 dataavailable 未触发（recorder
   *   异常）也强行 doFlush，防卡死。
   * - stop() 场景（awaitTail=false）：recorder 即将销毁，直接同步切，不再等尾。
   */
  function flushSegment(awaitTail: boolean) {
    if (!speaking || pendingFlush) return;
    pendingFlush = true;
    speechLenAtFlush = performance.now() - speechStartAt; // 记录实际说话时长
    if (awaitTail && recorder && recorder.state === "recording") {
      recorder.requestData(); // 触发一次 dataavailable，把尾部缓冲推入 chunks
      flushTimer = window.setTimeout(doFlush, 250); // 兜底：事件不来也不能卡住
    } else {
      doFlush(); // 同步路径（stop / recorder 不可用）
    }
  }

  /**
   * 能量分析循环（每帧 rAF）：
   * 1. 读时域数据算 RMS → EMA 平滑
   * 2. 非说话期：慢速更新噪声地板；超阈值（含迟滞）→ 说话起点 + 预卷
   * 3. 说话期：低于释放阈值累计静音，静音够长或超最长时长 → 切段
   */
  function analyze() {
    if (disposed || !analyser) return;
    // 用 Float32 时域数据（-1~1）而非 byte(0~255)：精度更高，
    // 弱信号（轻声/远麦）也能被准确测到，byte 版会把微弱语音量化掉
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);

    // RMS 计算（Float32 已归一化到 -1~1）
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = buf[i];
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    // EMA 平滑：抑制单帧毛刺（键盘敲击、点击声）
    smoothedRms = smoothedRms === 0 ? rms : smoothedRms * 0.7 + rms * 0.3;
    if (rms > maxRmsSinceStart) maxRmsSinceStart = rms;

    // 诊断日志（节流 2s）：确认 VAD 是否真的收到音频 ——
    // 若 rms 恒为 0 说明 AudioContext/analyser 没数据（设备/挂起问题）；
    // 若 rms 明显高于 trigger 却无反应，说明切段回调链路有问题。
    const now = performance.now();
    if (now - lastDebugLog > 2000) {
      lastDebugLog = now;
      console.debug(
        `[VAD] rms=${smoothedRms.toFixed(3)} trigger=${triggerThreshold().toFixed(3)} ` +
          `release=${releaseThreshold().toFixed(3)} noiseFloor=${noiseFloor.toFixed(3)} ` +
          `speaking=${speaking} chunks=${chunks.length}`,
      );
    }
    // 弱信号自检（一次性）：启动 5s 后若从未捕捉到接近阈值的能量，
    // 提示麦克风音量/距离问题 —— 这正是"实时对话收不到语音"的常见根因
    if (!lowSignalWarned && listeningSince > 0 && now - listeningSince > 5000 && maxRmsSinceStart < ABS_TRIGGER_FLOOR) {
      lowSignalWarned = true;
      console.warn(
        `[VAD] 警告：5s 内最大能量 ${maxRmsSinceStart.toFixed(4)} 低于触发阈值 ` +
          `${ABS_TRIGGER_FLOOR}。请检查：① 系统麦克风输入音量是否过低；② 是否离麦克风太远；` +
          `③ 浏览器麦克风权限是否给了正确设备。`,
      );
    }

    if (!speaking) {
      if (smoothedRms > triggerThreshold()) {
        // ── 说话起点：计算预卷起始索引（保留句首前几片，防句首被切）──
        // 起点从 index 1 起算（index 0 是 WebM 文件头片，由 doFlush 单独拼接）
        speaking = true;
        speechStartAt = now;
        silenceStart = -1; // 未开始计静音
        const preRollChunks = Math.ceil(opts.preRollMs / opts.chunkMs);
        segmentStartChunk = Math.max(1, chunks.length - preRollChunks);
      } else {
        // 空闲期：缓慢学习噪声地板（说话期间不更新，防说话声污染估计）
        noiseFloor = Math.max(
          opts.thresholdFloor,
          noiseFloor * (1 - opts.noiseAdaptRate) + smoothedRms * opts.noiseAdaptRate,
        );
        trimIdleBuffer();
      }
    } else {
      if (smoothedRms > releaseThreshold()) {
        // 仍在说话：重置静音计时为"未计时"（-1）。
        // ⚠️ 绝不能写 0：0 会被当成计时起点 → silentFor = now 巨大 → 立即误切段
        silenceStart = -1;
      } else if (silenceStart < 0) {
        // 能量跌破释放阈值：开始计静音
        silenceStart = now;
      }
      const silentFor = silenceStart < 0 ? 0 : now - silenceStart;
      const speechLen = now - speechStartAt;
      if (silentFor >= opts.silenceMs || speechLen >= opts.maxSpeechMs) {
        flushSegment(true); // 触发切段（异步取尾，见 flushSegment 注释）
      }
    }

    rafId = requestAnimationFrame(analyze);
  }

  /** 裁剪空闲期缓冲：只保留 chunks[0]（WebM 文件头）+ 最近 maxIdleChunks 片 */
  function trimIdleBuffer() {
    if (chunks.length > opts.maxIdleChunks + 1) {
      // 从 index 1 开始裁剪，chunks[0]（文件头）永远保留
      chunks.splice(1, chunks.length - 1 - opts.maxIdleChunks);
    }
  }

  /** 开始聆听（请求麦克风权限，需用户手势触发） */
  async function start(): Promise<boolean> {
    if (state.value === "listening") return true;
    disposed = false;
    try {
      // 显式开启回声消除/降噪/自动增益（见 AUDIO_CONSTRAINTS 注释）
      stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
    } catch (err) {
      console.error("[useVoiceDetector] getUserMedia failed", err);
      return false;
    }

    // 约束生效自检（2026-08-17）：{ ideal } 是"尽力而为"，部分设备/浏览器会静默降级——
    // 读实际值确认回声消除是否真生效，否则"以为有 AEC 其实没有"是回声盲区。
    // 只提示一次，避免每次聆听都打扰。
    const track = stream.getAudioTracks()[0];
    const settings = track?.getSettings?.();
    if (settings && settings.echoCancellation === false && !constraintWarned) {
      constraintWarned = true;
      console.warn("[useVoiceDetector] echoCancellation 未生效（设备/浏览器降级），建议佩戴耳机");
      showToast("当前设备回声消除未生效，建议佩戴耳机");
    }
    if (settings && settings.noiseSuppression === false) {
      console.warn("[useVoiceDetector] noiseSuppression 未生效，环境噪声将进入识别");
    }

    currentMime = pickMimeType();
    try {
      recorder = new MediaRecorder(
        stream,
        currentMime
          ? { mimeType: currentMime, audioBitsPerSecond: RECORD_BITS_PER_SECOND }
          : { audioBitsPerSecond: RECORD_BITS_PER_SECOND },
      );
    } catch {
      recorder = new MediaRecorder(stream); // 兜底：让浏览器自选编码
    }
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) chunks.push(e.data);
      // 取尾完成：本次 dataavailable（或正常切片）一入列立即执行切段，无需等兜底定时器
      if (pendingFlush) doFlush();
    };
    recorder.onerror = (e: Event) => {
      console.error("[useVoiceDetector] MediaRecorder error", e);
    };
    // 定时切片：每 chunkMs 产一片，供切段按索引切片（切片粒度=预卷粒度）
    recorder.start(opts.chunkMs);

    // VAD 能量分析
    audioCtx = new AudioContext();
    // iOS Safari 等设备 AudioContext 可能以 suspended 启动，需显式 resume。
    // 若 resume 失败（浏览器自动播放策略禁止），analyser 读到的永远是静音(128)，
    // VAD 将完全听不到 —— 必须失败并释放资源，而不是静默继续。
    if (audioCtx.state === "suspended") {
      try {
        await audioCtx.resume();
      } catch (err) {
        console.error("[useVoiceDetector] AudioContext resume failed", err);
        releasePartial();
        return false;
      }
    }
    const src = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    // 静音输出保险丝：analyser → GainNode(0) → destination。
    // 让 AudioContext 始终有一条"输出路径"，避免部分浏览器对无输出节点
    // 的 AudioContext 做节流/静默，导致 analyser 数据不更新（rms 恒 0）。
    const mute = audioCtx.createGain();
    mute.gain.value = 0; // 纯静音，不产生任何声音
    analyser.connect(mute);
    mute.connect(audioCtx.destination);

    // 启动自检：输出 AudioContext 状态与首帧能量，便于 DevTools 判断链路
    const selfCheck = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(selfCheck);
    let selfSum = 0;
    for (let i = 0; i < selfCheck.length; i++) selfSum += selfCheck[i] * selfCheck[i];
    console.debug(
      `[VAD] 启动自检 audioCtx=${audioCtx.state} 首帧rms=${Math.sqrt(selfSum / selfCheck.length).toFixed(4)}`,
    );

    state.value = "listening";
    maxRmsSinceStart = 0;
    lowSignalWarned = false;
    listeningSince = performance.now();
    rafId = requestAnimationFrame(analyze);
    return true;
  }

  /** 启动中途失败时的资源清理（流 + recorder + context），避免麦克风常亮 */
  function releasePartial() {
    disposed = true;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    recorder = null;
    audioCtx?.close().catch(() => {});
    audioCtx = null;
    analyser = null;
    chunks = [];
    speaking = false;
    pendingFlush = false;
    state.value = "idle";
  }

  /** 暂停聆听（如 AI 回复期间，防录到 TTS 回声）；保留录音管线 */
  function pause() {
    if (disposed) return;
    // 立即切掉当前未完成段（异步取尾不影响暂停），避免暂停期间丢失已说内容
    flushSegment(true);
    if (recorder && recorder.state === "recording") recorder.pause();
    cancelAnimationFrame(rafId);
  }

  /** 恢复聆听 */
  function resume() {
    if (disposed || state.value !== "listening") return;
    if (recorder) {
      if (recorder.state === "paused") {
        recorder.resume(); // 正常路径：恢复采集
      } else if (recorder.state === "inactive") {
        // 防御：recorder 意外停止（罕见）→ 用原流重建采集，否则 VAD 永久失效
        console.warn("[useVoiceDetector] recorder inactive，重建采集");
        try {
          recorder.start(opts.chunkMs);
        } catch (e) {
          console.error("[useVoiceDetector] recorder 重建失败", e);
        }
      }
    }
    rafId = requestAnimationFrame(analyze);
  }

  /** 停止聆听并释放全部资源 */
  function stop() {
    disposed = true;
    cancelAnimationFrame(rafId);
    // 若有未决的取尾切段，直接取消（recorder 即将销毁，残留段随会话结束）
    if (pendingFlush) {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = 0;
      }
      pendingFlush = false;
      speaking = false;
    }
    // 先切掉未完成段（同步路径，不等尾 —— recorder 即将销毁）
    flushSegment(false);
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    recorder = null;
    audioCtx?.close().catch(() => {});
    audioCtx = null;
    analyser = null;
    chunks = [];
    speaking = false;
    pendingFlush = false;
    state.value = "idle";
  }

  return { state, start, pause, resume, stop };
}
