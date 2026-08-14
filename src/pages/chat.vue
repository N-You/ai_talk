<template>
  <div class="chat-page">
    <!-- 顶栏 -->
    <header class="chat-header">
      <div class="header-back icon-btn" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4L6 10L12 16" stroke="#0B3B33" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="header-center">
        <div class="ai-avatar">
        <img :src="iconMascotMini" width="36" height="36" alt="AI" />
      </div>
        <div class="header-info">
          <div class="header-title">{{ scenarioName }}</div>
          <div class="header-status" :class="{ online: connected }">
            <span class="status-dot"></span>
            {{ connected ? "AI 老师在线" : "连接中..." }}
          </div>
        </div>
      </div>
      <div class="header-more icon-btn">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="5" cy="10" r="1.6" fill="#0B3B33"/>
          <circle cx="10" cy="10" r="1.6" fill="#0B3B33"/>
          <circle cx="15" cy="10" r="1.6" fill="#0B3B33"/>
        </svg>
      </div>
    </header>

    <!-- 对话模式切换：实时聆听（无感对话）/ 一问一答 -->
    <div class="mode-switch">
      <button class="mode-btn" :class="{ active: mode === 'live' }" @click="toggleMode('live')">
        <span class="mode-icon">🎧</span>实时对话
      </button>
      <button class="mode-btn" :class="{ active: mode === 'qa' }" @click="toggleMode('qa')">
        <span class="mode-icon">💬</span>一问一答
      </button>
    </div>

    <!-- 消息列表 -->
    <div ref="listRef" class="message-list" @scroll="onScroll">
      <div v-if="messages.length === 0" class="chat-hint">
        <div class="hint-avatar">
          <img :src="iconMascotMini" width="44" height="44" alt="AI" />
        </div>
        <div class="hint-text">开始你的英语对话吧！</div>
        <div class="hint-sub">支持中文、英文和中英混合</div>
      </div>

      <div v-for="msg in messages" :key="msg.id" class="message" :class="msg.role === 'user' ? 'message-user' : 'message-ai'">
        <div class="message-avatar" v-if="msg.role !== 'user'">
          <img :src="iconMascotMini" width="22" height="22" alt="AI" />
        </div>
        <div class="message-bubble">
          <!-- 分词渲染：英文单词可点击查释义，其余原样显示 -->
          <div class="message-text">
            <template v-for="(seg, i) in tokenize(msg.content)" :key="i">
              <span v-if="seg.type === 'word'" class="word-tap" @click.stop="openWordModal(seg.text)">{{ seg.text }}</span>
              <span v-else>{{ seg.text }}</span>
            </template>
          </div>
          <div class="message-actions" v-if="msg.role === 'assistant'">
            <span class="action-btn" @click="playTts(msg.content)">🔊 播放</span>
          </div>
        </div>
      </div>

      <!-- 输入中...（三点呼吸动画） -->
      <div class="message message-ai" v-if="isThinking">
        <div class="message-avatar">
          <img :src="iconMascotMini" width="22" height="22" alt="AI" />
        </div>
        <div class="message-bubble thinking">
          <span class="typing-dot" v-for="n in 3" :key="n"></span>
        </div>
      </div>
    </div>

    <!-- 输入区域：一问一答模式（输入 / 按住说话） -->
    <div class="input-area" v-if="mode === 'qa'">
      <div class="input-row">
        <div class="voice-btn" :class="{ recording }" @pointerdown="startRecord" @pointerup="stopRecord" @pointerleave="stopRecord">
          <svg v-if="!recording" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="2" width="4" height="8" rx="2" stroke="#FFFFFF" stroke-width="1.6"/>
            <path d="M3.5 8C3.5 10.5 5.5 12.5 8 12.5C10.5 12.5 12.5 10.5 12.5 8" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/>
            <path d="M8 12.5V14.5" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
          <span v-else class="rec-dot"></span>
        </div>
        <input
          class="text-input"
          v-model="inputText"
          placeholder="点击输入或按住说话..."
          :disabled="isThinking"
          @keyup.enter="sendText"
        />
        <div class="send-btn" :class="{ ready: inputText.trim() }" @click="sendText">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
      <div class="voice-tip" v-if="recording">
        <span class="tip-dot"></span>
        <span>{{ recognizing ? "正在识别..." : "松开结束录音" }}</span>
      </div>
    </div>

    <!-- 输入区域：实时聆听模式（VAD 自动切段 + 自动发送，无感对话） -->
    <div class="input-area live-area" v-else>
      <div class="live-status" :class="{ active: liveStarted }">
        <span class="live-dot"></span>
        <span>{{ liveStatusText }}</span>
      </div>
      <div class="live-tip">自动识别停顿，说完稍等，AI 会自动接话，全程无需按键</div>
      <button class="live-btn" :class="{ listening: liveStarted }" @click="liveStarted ? stopLive() : startLive()">
        {{ liveStarted ? "停止聆听" : "开始聆听" }}
      </button>
    </div>

    <!-- 单词释义弹窗（点击消息中的单词触发，风格与主题统一） -->
    <van-popup v-model:show="showWordModal" position="bottom" round :style="{ background: 'transparent' }" :close-on-click-overlay="true">
      <div class="word-dialog">
        <div class="popup-handle"></div>
        <div class="word-dialog-head">
          <span class="popup-title-icon">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 3H14V15H4V3Z" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
              <path d="M6 6H12M6 8.5H12M6 11H9.5" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="popup-title">单词详解</span>
        </div>

        <!-- 查询中 -->
        <div class="word-dialog-body" v-if="!wordInfo && wordLoading">
          <div class="wd-loading">
            <span class="wd-loading-dot" v-for="n in 3" :key="n"></span>
            <span class="wd-loading-text">正在查询释义…</span>
          </div>
        </div>

        <!-- 释义结果 -->
        <div class="word-dialog-body" v-else-if="wordInfo">
          <div class="wd-word-row">
            <span class="wd-word">{{ wordInfo.word }}</span>
            <span class="wd-phonetic" v-if="wordInfo.phonetic">{{ wordInfo.phonetic }}</span>
          </div>
          <div class="wd-meaning">{{ wordInfo.meaning }}</div>
          <div class="wd-example" v-if="wordInfo.example">{{ wordInfo.example }}</div>
        </div>

        <div class="word-dialog-actions">
          <button class="wd-btn wd-btn-close" @click="showWordModal = false">关闭</button>
          <button class="wd-btn wd-btn-add" :disabled="!wordInfo || wordLoading" @click="addWordToLibrary">
            加入生词本
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 2V12M2 7H12" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { showToast, showSuccessToast } from "vant";
import gsap from "gsap";
import { conversationApi, learningApi, speechApi, getToken, WS_URL } from "@/api";
import { useVoiceDetector } from "@/composables/useVoiceDetector";
import iconMascotMini from "@/assets/icons/mascot-mini.svg";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
}

const route = useRoute();
const router = useRouter();

const scenarioId = ref(Number(route.query.scenarioId) || 0);
const scenarioName = ref((route.query.scenarioName as string) || "AI 对话");
const conversationId = ref(0);
const messages = ref<Message[]>([]);
const inputText = ref("");
const isThinking = ref(false);
const listRef = ref<HTMLDivElement | null>(null);
const socket = ref<WebSocket | null>(null);
const connected = ref(false);

// 单词释义弹窗状态（点击消息中的单词触发）
const showWordModal = ref(false);
const wordLoading = ref(false);
const wordInfo = ref<{ word: string; phonetic: string; meaning: string; example: string } | null>(null);

// 流式生成状态
const streaming = ref(false);
const streamMsgId = ref(0);

// TTS 播放资源（live 模式恢复聆听时也要判断是否在播放，故声明提前）
let audioEl: HTMLAudioElement | null = null;
let audioUrl: string | null = null;

// ── 对话模式：live=实时聆听（无感对话） / qa=一问一答 ──
const mode = ref<"live" | "qa">("qa");
const liveStarted = ref(false);
const liveTranscribing = ref(false);

// 实时聆听状态文案
const liveStatusText = computed(() => {
  if (isThinking.value || streaming.value) return "AI 正在回复…";
  if (liveTranscribing.value) return "正在识别你的话…";
  if (liveStarted.value) return "聆听中，直接说即可…";
  return "已暂停聆听";
});

// VAD 分段录音器：停顿自动切段 → 转写 → 自动发送
const voiceDetector = useVoiceDetector({
  minSpeechMs: 500, // <0.5s 视为噪音
  maxSpeechMs: 20000, // 单句最长 20s
  silenceMs: 1200, // 静音 1.2s 判定一句结束
  onSegment: (blob, mimeType) => handleLiveSegment(blob, mimeType),
});

/** 切换对话模式：停止另一模式的进行中活动 */
function toggleMode(m: "live" | "qa") {
  if (mode.value === m) return;
  // 离开 live：停止聆听
  if (mode.value === "live") {
    stopLive();
  }
  // 离开 qa：停止按住说话录音
  if (mode.value === "qa") {
    stopRecord();
  }
  mode.value = m;
}

/** 开始实时聆听（需用户手势触发麦克风权限） */
async function startLive() {
  if (liveStarted.value || isThinking.value) return;
  const ok = await voiceDetector.start();
  if (!ok) {
    showToast("无法访问麦克风，请检查权限");
    return;
  }
  liveStarted.value = true;
}

/** 停止实时聆听 */
function stopLive() {
  voiceDetector.stop();
  liveStarted.value = false;
  liveTranscribing.value = false;
}

/** VAD 切段回调：转写该段并自动发送（无感闭环） */
async function handleLiveSegment(blob: Blob, mimeType: string) {
  if (liveTranscribing.value || isThinking.value || !liveStarted.value) return;
  liveTranscribing.value = true;
  try {
    const res = await speechApi.transcribe({ file: blob, mimeType });
    const text = (res?.text ?? "").trim();
    if (!text) return; // 空识别直接忽略，继续聆听
    if (isThinking.value) return; // AI 正在回复，丢弃本次输入
    // 无感发送：不进输入框，直接走 WS
    if (!connected.value || !socket.value) {
      messages.value.pop(); // 未连接，撤销本地假消息
      showToast("连接已断开，请重试");
      return;
    }
    messages.value.push({ id: Date.now(), role: "user", content: text });
    isThinking.value = true;
    streaming.value = false;
    // AI 回复期间暂停聆听，防止录到 TTS 回声
    voiceDetector.pause();
    scrollToBottom();
    socket.value.send(
      JSON.stringify({ event: "text", data: { conversation_id: conversationId.value, content: text } }),
    );
  } catch (e: any) {
    console.error("[chat] live transcribe error", e);
    showToast(e?.message || "语音识别失败");
  } finally {
    liveTranscribing.value = false;
  }
}

/** AI 回复完成后恢复聆听（live 模式）；若 TTS 在播则等播完，防回声录入 */
function resumeLiveAfterReply() {
  if (mode.value !== "live" || !liveStarted.value) return;
  if (audioEl && !audioEl.paused && !audioEl.ended) {
    audioEl.addEventListener("ended", () => voiceDetector.resume(), { once: true });
  } else {
    setTimeout(() => voiceDetector.resume(), 700);
  }
}

// 自动滚动到底部
watch(
  () => messages.value.length,
  () => scrollToBottom(),
);

function scrollToBottom() {
  nextTick(() => {
    const el = listRef.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

function onScroll() {
  /* 预留：向上翻页 */
}

onMounted(() => {
  initConversation();
});

onUnmounted(() => {
  socket.value?.close();
  socket.value = null;
  voiceDetector.stop();
  releaseAudio();
});

/** 初始化会话：创建会话记录 → 拿到 conversation_id → 连接 WebSocket */
async function initConversation() {
  try {
    const conv = await conversationApi.create(scenarioId.value);
    conversationId.value = conv.id;
    connectSocket();
  } catch (e) {
    showToast("创建对话失败");
  }
}

/**
 * 建立 WebSocket 连接（/ws/conversations?token=...）：
 * onopen → 发送 join；onmessage → 分发 handleWSMessage；
 * onclose/onerror → 更新连接状态（UI 显示"连接中..."）。
 */
function connectSocket() {
  const token = getToken();
  if (!token) {
    showToast("请先登录");
    router.replace("/profile");
    return;
  }

  const url = `${WS_URL}/ws/conversations?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(url);

  ws.onopen = () => {
    connected.value = true;
    ws.send(JSON.stringify({ event: "join", data: { conversation_id: conversationId.value } }));
  };

  ws.onmessage = (e) => {
    try {
      handleWSMessage(JSON.parse(e.data));
    } catch (err) {
      console.error("[chat] bad message", err, e.data);
    }
  };

  ws.onclose = () => {
    connected.value = false;
  };

  ws.onerror = (e) => {
    console.error("[chat] socket error", e);
    connected.value = false;
  };

  socket.value = ws;
}

/**
 * 流式事件协议分发（与后端 ConversationGateway 对应）：
 * - ai_stream：首包创建 AI 气泡（id=Date.now()），后续 delta 追加 → 增量渲染
 * - ai_done：用完整文本覆盖气泡（防流式丢字），流结束并自动 TTS 朗读
 * - ai_error：移除空白气泡 + toast 服务端原因
 */
function handleWSMessage(payload: any) {
  const event = payload.event;
  const data = payload.data ?? payload;

  if (event === "joined") {
    // 加入成功
  } else if (event === "ai_stream") {
    const delta: string = data.delta ?? "";
    if (!delta) return;

    if (!streaming.value) {
      streaming.value = true;
      streamMsgId.value = Date.now();
      messages.value.push({ id: streamMsgId.value, role: "assistant", content: delta });
    } else {
      const last = messages.value[messages.value.length - 1];
      if (last && last.id === streamMsgId.value) {
        last.content += delta;
      }
    }
    isThinking.value = false;
    scrollToBottom();
  } else if (event === "ai_done") {
    const full = data.text ?? "";
    const last = messages.value[messages.value.length - 1];
    if (last && last.id === streamMsgId.value && full) {
      last.content = full;
    }
    streaming.value = false;
    isThinking.value = false;
    scrollToBottom();
    if (full) playTts(full);
    // live 模式：AI 回完自动恢复聆听（等 TTS 播完防回声）
    resumeLiveAfterReply();
  } else if (event === "ai_error") {
    streaming.value = false;
    isThinking.value = false;
    messages.value = messages.value.filter((m) => !(m.id === streamMsgId.value && !m.content));
    showToast(data.message || "AI 回复失败");
    resumeLiveAfterReply();
  } else if (event === "error") {
    console.error("[chat] server error", data);
    isThinking.value = false;
  }
}

/**
 * 发送文字：本地先推用户消息（乐观 UI）→ 置 isThinking →
 * WS send {event:"text"}；WS 未连接时本地插入提示消息。
 */
async function sendText() {
  const text = inputText.value.trim();
  if (!text) return;
  if (isThinking.value) {
    showToast("AI 正在回复，请稍候");
    return;
  }

  messages.value.push({ id: Date.now(), role: "user", content: text });
  inputText.value = "";
  isThinking.value = true;
  streaming.value = false;
  scrollToBottom();

  if (!connected.value || !socket.value) {
    isThinking.value = false;
    messages.value.push({
      id: Date.now() + 1,
      role: "assistant",
      content: "WebSocket 未连接，请确认已登录且后端已启动",
    });
    return;
  }

  socket.value.send(
    JSON.stringify({ event: "text", data: { conversation_id: conversationId.value, content: text } }),
  );
}

// ── 录音（MediaRecorder）──
const recording = ref(false);
const recognizing = ref(false);

let h5Recorder: MediaRecorder | null = null;
let h5Chunks: BlobPart[] = [];
let h5Stream: MediaStream | null = null;

/**
 * 开始录音：getUserMedia 取流 → MediaRecorder 采集（webm/mp4 兼容）；
 * 停止后组装 Blob 交给 doTranscribe。
 */
function startRecord() {
  if (recording.value || recognizing.value || isThinking.value) return;
  if (!getToken()) {
    showToast("请先登录");
    return;
  }
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      h5Stream = stream;
      h5Chunks = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      h5Recorder = new MediaRecorder(stream, { mimeType: mime });
      h5Recorder.ondataavailable = (e) => {
        if (e.data.size > 0) h5Chunks.push(e.data);
      };
      h5Recorder.onstop = () => {
        h5Stream?.getTracks().forEach((t) => t.stop());
        h5Stream = null;
        recording.value = false;
        const blob = new Blob(h5Chunks, { type: mime });
        h5Chunks = [];
        if (blob.size > 0) doTranscribe({ file: blob, mimeType: mime });
      };
      h5Recorder.start();
      recording.value = true;
    })
    .catch((err) => {
      console.error("[chat] mic error", err);
      showToast("无法访问麦克风，请检查权限");
    });
}

/** 停止录音：触发 onstop → 转写（按钮松开/移出时调用） */
function stopRecord() {
  if (h5Recorder && h5Recorder.state !== "inactive") {
    h5Recorder.stop();
    h5Recorder = null;
  }
}

async function doTranscribe(input: { filePath?: string; file?: Blob; mimeType?: string }) {
  recognizing.value = true;
  try {
    const res = await speechApi.transcribe(input);
    const text = (res?.text ?? "").trim();
    if (!text) {
      showToast("没听清，请再说一次");
      return;
    }
    if (isThinking.value) {
      showToast("AI 正在回复，已忽略本次输入");
      return;
    }
    inputText.value = text;
    sendText();
  } catch (e: any) {
    console.error("[chat] transcribe error", e);
    showToast(e?.message || "语音识别失败");
  } finally {
    recognizing.value = false;
  }
}

// ── 点词查释义（点击消息中的英文单词弹窗）──

/** 消息文本分词：英文单词（含连字符/撇号）→ {type:"word"}，其余 → {type:"text"} */
function tokenize(text: string): { type: "word" | "text"; text: string }[] {
  const parts = text.split(/([A-Za-z][A-Za-z'-]*)/g);
  return parts
    .filter((p) => p.length > 0)
    .map((p) => ({ type: /^[A-Za-z]/.test(p) ? ("word" as const) : ("text" as const), text: p }));
}

/** 点击单词：打开释义弹窗并请求后端解释（LLM 生成音标/释义/例句） */
async function openWordModal(word: string) {
  if (wordLoading.value) return; // 查询中禁止重复触发
  showWordModal.value = true;
  wordInfo.value = null;
  wordLoading.value = true;
  try {
    wordInfo.value = await conversationApi.explainWord(word);
  } catch {
    wordInfo.value = { word, phonetic: "", meaning: "查询失败，请稍后再试", example: "" };
  } finally {
    wordLoading.value = false;
  }
}

/** 释义弹窗 → 加入生词本（幂等，重复添加自动复用） */
async function addWordToLibrary() {
  if (!wordInfo.value) return;
  try {
    await learningApi.add(wordInfo.value.word);
    showSuccessToast("已加入生词本");
    showWordModal.value = false;
  } catch (e) {
    showToast("加入失败");
  }
}

// ── TTS 播放 ──
// 过长的文本不自动播放：TTS 有字数/时长限制，播放会被截断且白白消耗额度
const MAX_AUTO_TTS_LEN = 300;

function releaseAudio() {
  if (audioUrl) {
    URL.revokeObjectURL(audioUrl);
    audioUrl = null;
  }
}

async function playTts(text: string) {
  if (!text) return;
  if (text.length > MAX_AUTO_TTS_LEN) return;
  try {
    const blob = await speechApi.synthesize(text);
    releaseAudio();
    audioUrl = URL.createObjectURL(blob);
    if (!audioEl) audioEl = new Audio();
    audioEl.src = audioUrl;
    audioEl.play().catch(() => {});
  } catch (e: any) {
    console.error("[chat] tts error", e);
    showToast(e?.message || "语音朗读失败");
  }
}

/** 结束会话：停聆听 → 关 WS → 调 end 接口记录 → 返回上一页 */
async function endChat() {
  stopLive();
  try {
    socket.value?.close();
    socket.value = null;
    await conversationApi.end(conversationId.value, {});
    showSuccessToast("对话已结束");
  } catch (e) {
    /* ignore */
  }
  goBack();
}

/** 返回上一页（聊天页从首页/场景库进入） */
function goBack() {
  router.back();
}
</script>

<style lang="scss" scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--c-mint-bg);
}

/* 顶栏 */
.chat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  flex-shrink: 0;
  position: relative;

  .header-back,
  .header-more {
    flex-shrink: 0;
  }

  .header-center {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .ai-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--grad-brand);
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .header-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--c-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .header-status {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--c-text-sub);
    margin-top: 2px;

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #b0b8b5;
    }

    &.online {
      color: var(--c-primary-deep);

      .status-dot {
        background: #27c773;
      }
    }
  }
}

/* 对话模式切换（实时聆听 / 一问一答） */
.mode-switch {
  display: flex;
  gap: 6px;
  padding: 10px 16px 0;
  flex-shrink: 0;

  .mode-btn {
    flex: 1;
    height: 36px;
    border-radius: 18px;
    border: 1.5px solid var(--c-border);
    background: var(--c-card);
    color: var(--c-text-sub);
    font-size: 13px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    cursor: pointer;
    transition: all 0.2s ease;

    .mode-icon {
      font-size: 15px;
    }

    &.active {
      background: var(--grad-brand);
      border-color: transparent;
      color: #fff;
      box-shadow: 0 4px 12px rgba(13, 186, 156, 0.3);
    }

    &:active {
      transform: scale(0.97);
    }
  }
}

/* 消息列表 */
.message-list {
  flex: 1;
  padding: 8px 16px;
  overflow-y: auto;
}

.chat-hint {
  text-align: center;
  padding-top: 70px;

  .hint-avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--grad-brand);
    color: #fff;
    font-size: 26px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 12px;
    box-shadow: 0 8px 20px rgba(13, 186, 156, 0.3);
  }

  .hint-text {
    font-size: 17px;
    color: var(--c-text);
    font-weight: 600;
  }

  .hint-sub {
    font-size: 12px;
    color: var(--c-text-sub);
    margin-top: 6px;
  }
}

.message {
  display: flex;
  margin-bottom: 14px;
  gap: 8px;
}

.message-ai {
  flex-direction: row;
}

.message-user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--grad-brand);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message-bubble {
  max-width: 72%;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--c-card);
  box-shadow: 0 2px 10px rgba(11, 59, 51, 0.06);
  word-break: break-word;
  border-bottom-left-radius: 4px;

  &.thinking {
    background: var(--c-card);
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 52px;
    justify-content: center;
  }

  .typing-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--c-primary);
    opacity: 0.35;
    animation: typingBounce 1.2s infinite ease-in-out;

    &:nth-child(2) {
      animation-delay: 0.15s;
    }

    &:nth-child(3) {
      animation-delay: 0.3s;
    }
  }
}

@keyframes typingBounce {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.35;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.message-user .message-bubble {
  background: var(--c-primary);
  border-bottom-right-radius: 4px;
  border-bottom-left-radius: 16px;

  .message-text {
    color: #fff;
  }
}

.message-text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--c-text);
  white-space: pre-wrap;
}

/* 可点击单词（查释义） */
.word-tap {
  cursor: pointer;
  border-radius: 4px;
  padding: 0 1px;
  color: inherit;
  text-decoration: underline;
  text-decoration-color: rgba(13, 186, 156, 0.35);
  text-underline-offset: 3px;
  transition: background 0.15s ease, text-decoration-color 0.15s ease;

  &:active {
    background: rgba(13, 186, 156, 0.14);
    text-decoration-color: var(--c-primary);
  }
}

.message-actions {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--c-divider);
  display: flex;
  gap: 14px;

  .action-btn {
    font-size: 12px;
    color: var(--c-primary);
    cursor: pointer;
  }
}

/* 单词释义弹窗（同步主题：白底大圆角 + 顶部手柄 + 标题图标 + 渐变按钮） */
.word-dialog {
  background: #fff;
  border-radius: 24px 24px 0 0;
  padding: 12px 20px calc(24px + env(safe-area-inset-bottom));

  .popup-handle {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--c-divider);
    margin: 0 auto 16px;
  }

  .word-dialog-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;

    .popup-title-icon {
      width: 34px;
      height: 34px;
      border-radius: 12px;
      background: var(--grad-brand);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 4px 10px rgba(13, 186, 156, 0.28);
    }

    .popup-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--c-text);
    }
  }

  .word-dialog-body {
    min-height: 96px;
    padding: 16px;
    border-radius: 14px;
    background: var(--c-mint-bg);
    box-sizing: border-box;

    .wd-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 64px;

      .wd-loading-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--c-primary);
        opacity: 0.35;
        animation: wdBounce 1.1s infinite ease-in-out;

        &:nth-child(2) {
          animation-delay: 0.14s;
        }

        &:nth-child(3) {
          animation-delay: 0.28s;
        }
      }

      .wd-loading-text {
        font-size: 12px;
        color: var(--c-text-sub);
      }
    }

    .wd-word-row {
      display: flex;
      align-items: baseline;
      gap: 10px;

      .wd-word {
        font-size: 22px;
        font-weight: 700;
        color: var(--c-text);
      }

      .wd-phonetic {
        font-size: 13px;
        color: var(--c-text-sub);
      }
    }

    .wd-meaning {
      font-size: 14px;
      line-height: 1.6;
      color: var(--c-text);
      margin-top: 10px;
    }

    .wd-example {
      font-size: 12px;
      line-height: 1.6;
      color: var(--c-text-sub);
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed var(--c-divider);
    }
  }

  .word-dialog-actions {
    display: flex;
    gap: 10px;
    margin-top: 18px;

    .wd-btn {
      flex: 1;
      height: 48px;
      border-radius: var(--radius-pill);
      font-size: 15px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: transform 0.15s ease, opacity 0.2s ease;

      &:active {
        transform: scale(0.97);
      }

      &:disabled {
        opacity: 0.45;
        pointer-events: none;
      }
    }

    .wd-btn-close {
      background: var(--c-mint-bg);
      color: var(--c-text-sub);
    }

    .wd-btn-add {
      background: var(--grad-brand);
      color: #fff;
      box-shadow: 0 6px 16px rgba(13, 186, 156, 0.3);
    }
  }
}

@keyframes wdBounce {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.35;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

/* 实时聆听面板（无感对话模式） */
.live-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding-top: 14px;

  .live-status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--c-text-sub);

    .live-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #b0b8b5;
    }

    &.active {
      color: var(--c-primary-deep);

      .live-dot {
        background: var(--c-primary);
        animation: livePulse 1.2s infinite;
      }
    }
  }

  .live-tip {
    font-size: 11px;
    color: var(--c-text-faint);
  }

  .live-btn {
    width: 200px;
    height: 48px;
    border-radius: 24px;
    border: none;
    background: var(--grad-brand);
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 6px 16px rgba(13, 186, 156, 0.3);
    transition: transform 0.15s ease;

    &.listening {
      background: linear-gradient(135deg, #e24b4a, #f2926a);
      box-shadow: 0 6px 16px rgba(226, 75, 74, 0.3);
    }

    &:active {
      transform: scale(0.97);
    }
  }
}

@keyframes livePulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.35);
    opacity: 0.55;
  }
}

/* 输入区域 */
.input-area {
  position: relative;
  background: #fff;
  padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--c-divider);
  flex-shrink: 0;
  z-index: 6;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.text-input {
  flex: 1;
  height: 50px;
  background: var(--c-mint-bg);
  border-radius: 25px;
  padding: 0 18px;
  font-size: 14px;
  border: none;
  outline: none;
  color: var(--c-text);
  box-sizing: border-box;

  &::placeholder {
    color: var(--c-text-faint);
  }
}

.voice-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--c-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(13, 186, 156, 0.32);
  cursor: pointer;

  &.recording {
    animation: pulse 1s infinite;
  }

  .rec-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
  }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.12); }
}

.send-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(13, 186, 156, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.2s ease;

  &.ready {
    background: var(--c-primary);
    box-shadow: 0 4px 12px rgba(13, 186, 156, 0.32);
  }
}

.voice-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
  font-size: 11px;
  color: var(--c-red-text);
  margin-top: 6px;

  .tip-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--c-red-text);
  }
}
</style>
