import { ref } from "vue";

/**
 * 语音活动检测（VAD）+ 静音分段录音工具。
 *
 * 设计目标：实现"实时聆听无感对话"的前端采集端——
 * 持续录音，用能量阈值判断"开始说话 / 停顿结束"，
 * 在停顿处自动切出一个语音段（Blob），交给上层转写。
 *
 * 技术要点：
 * - MediaRecorder.start(chunkMs) 定时切片，每片独立累积到当前段
 * - AudioContext + AnalyserNode 每帧读时域数据算 RMS 能量（0~1）
 * - 说话中静音持续 silenceMs → 切段；最长 maxSpeechMs 强制切段
 * - 最短 minSpeechMs 以内的"说话"视为噪音丢弃（防误触发）
 */

export type VoiceState = "idle" | "listening";

export interface VoiceDetectorOptions {
  /** 最小有效语音段（毫秒），小于此丢弃 */
  minSpeechMs?: number;
  /** 最大语音段（毫秒），超时强制切段 */
  maxSpeechMs?: number;
  /** 静音持续多久判定一句结束（毫秒） */
  silenceMs?: number;
  /** 能量阈值 0~1（RMS 归一化），低于视为静音 */
  threshold?: number;
  /** MediaRecorder 切片间隔（毫秒） */
  chunkMs?: number;
  /** 每切出一个语音段回调 */
  onSegment?: (blob: Blob, mimeType: string) => void;
}

export function useVoiceDetector(options: VoiceDetectorOptions = {}) {
  const {
    minSpeechMs = 500,
    maxSpeechMs = 20000,
    silenceMs = 1200,
    threshold = 0.02,
    chunkMs = 250,
    onSegment,
  } = options;

  const state = ref<VoiceState>("idle");

  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let rafId = 0;

  /** 当前段累积的切片 */
  let chunks: Blob[] = [];
  let currentMime = "audio/webm";
  let speaking = false;
  let silenceStart = 0; // 静音起算时间
  let segmentStart = 0; // 当前段开始时间
  let disposed = false;

  /** 能量分析循环：每帧读时域数据算 RMS */
  function analyze() {
    if (disposed || !analyser) return;
    const buf = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buf);

    // RMS 归一化到 0~1
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);

    const now = performance.now();
    if (rms > threshold) {
      if (!speaking) {
        // 开始说话：记段起点
        speaking = true;
        segmentStart = now;
        silenceStart = 0;
        chunks = [];
      } else {
        // 持续说话：重置静音计时
        silenceStart = 0;
      }
    } else if (speaking) {
      // 静音累计
      if (silenceStart === 0) silenceStart = now;
      const silentFor = now - silenceStart;
      const speechLen = now - segmentStart;
      if (silentFor >= silenceMs || speechLen >= maxSpeechMs) {
        flushSegment();
      }
    }

    rafId = requestAnimationFrame(analyze);
  }

  /** 切段：把当前 chunks 拼成 Blob 交给上层 */
  function flushSegment() {
    if (!speaking) return;
    speaking = false;
    silenceStart = 0;

    const speechLen = performance.now() - segmentStart;
    // 太短视为噪音，丢弃
    if (speechLen < minSpeechMs || chunks.length === 0) {
      chunks = [];
      return;
    }
    const blob = new Blob(chunks, { type: currentMime });
    chunks = [];
    onSegment?.(blob, currentMime);
  }

  /** 开始聆听（请求麦克风权限，需用户手势触发） */
  async function start(): Promise<boolean> {
    if (state.value === "listening") return true;
    disposed = false;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return false;
    }

    const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
    currentMime = mime;
    recorder = new MediaRecorder(stream, { mimeType: mime });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    // 定时切片：每 chunkMs 产一片，供切段时按时间片拼接
    recorder.start(chunkMs);

    // VAD 能量分析
    audioCtx = new AudioContext();
    const src = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);

    state.value = "listening";
    rafId = requestAnimationFrame(analyze);
    return true;
  }

  /** 暂停聆听（如 AI 回复期间，防录到 TTS 回声）；保留录音管线 */
  function pause() {
    if (disposed) return;
    // 立即切掉当前未完成段，避免暂停期间丢失已说内容
    flushSegment();
    if (recorder && recorder.state === "recording") recorder.pause();
    cancelAnimationFrame(rafId);
  }

  /** 恢复聆听 */
  function resume() {
    if (disposed || state.value !== "listening") return;
    if (recorder && recorder.state === "paused") recorder.resume();
    rafId = requestAnimationFrame(analyze);
  }

  /** 停止聆听并释放全部资源 */
  function stop() {
    disposed = true;
    cancelAnimationFrame(rafId);
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
    state.value = "idle";
  }

  return { state, start, pause, resume, stop };
}
