<template>
  <div class="chat-page">
    <!-- 导航栏 -->
    <div class="chat-header">
      <div class="header-back" @click="goBack">
        <van-icon name="arrow-left" color="#fff" size="20" />
      </div>
      <div class="header-center">
        <div class="header-title">{{ scenarioName }}</div>
        <div class="header-status" :class="{ online: connected }">
          {{ connected ? "● 在线" : "○ 连接中..." }}
        </div>
      </div>
      <div class="header-actions">
        <van-button size="small" plain type="danger" @click="endChat">结束</van-button>
      </div>
    </div>

    <!-- 消息列表 -->
    <div ref="listRef" class="message-list" @scroll="onScroll">
      <div v-if="messages.length === 0" class="chat-hint">
        <div class="hint-icon">🎤</div>
        <div class="hint-text">开始你的英语对话吧！</div>
        <div class="hint-sub">支持中文、英文和中英混合</div>
      </div>

      <div v-for="msg in messages" :key="msg.id" class="message" :class="msg.role === 'user' ? 'message-user' : 'message-ai'">
        <div class="message-avatar">
          <span>{{ msg.role === "user" ? "👤" : "🤖" }}</span>
        </div>
        <div class="message-bubble">
          <div class="message-text">{{ msg.content }}</div>
          <div class="message-actions" v-if="msg.role === 'assistant'">
            <span class="action-btn" @click="recordWord(msg.content)">💡 记录表达</span>
            <span class="action-btn" @click="playTts(msg.content)">🔊 播放</span>
          </div>
        </div>
      </div>

      <!-- 输入中... -->
      <div class="message message-ai" v-if="isThinking">
        <div class="message-avatar"><span>🤖</span></div>
        <div class="message-bubble thinking">
          <van-loading size="16" color="#999" />
          <span>AI 正在思考...</span>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="input-area">
      <div class="input-row">
        <input
          class="text-input"
          v-model="inputText"
          placeholder="说点什么... (支持中英混合)"
          :disabled="isThinking"
          @keyup.enter="sendText"
        />
        <div class="voice-btn" :class="{ recording }" @pointerdown="startRecord" @pointerup="stopRecord" @pointerleave="stopRecord">
          <span>{{ recording ? "⏺" : "🎙️" }}</span>
        </div>
        <div class="send-btn" v-if="inputText.trim()" @click="sendText">
          <span>发送</span>
        </div>
      </div>
      <div class="voice-tip" v-if="recording">
        <span class="tip-dot"></span>
        <span>{{ recognizing ? "正在识别..." : "松开结束录音" }}</span>
      </div>
    </div>

    <!-- 学习记录弹窗 -->
    <van-popup v-model:show="showRecord" position="bottom" round :style="{ padding: '20px' }">
      <div class="record-popup">
        <div class="popup-title">记录学习内容</div>
        <textarea class="popup-input" v-model="recordText" placeholder="输入单词或短语" maxlength="100" rows="3" />
        <div class="popup-actions">
          <van-button size="large" plain type="default" @click="showRecord = false">取消</van-button>
          <van-button size="large" type="primary" @click="confirmRecord">记录</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { showToast, showSuccessToast } from "vant";
import { conversationApi, learningApi, speechApi, getToken, WS_URL } from "@/api";

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

const showRecord = ref(false);
const recordText = ref("");

// 流式生成状态
const streaming = ref(false);
const streamMsgId = ref(0);

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
});

async function initConversation() {
  try {
    const conv = await conversationApi.create(scenarioId.value);
    conversationId.value = conv.id;
    connectSocket();
  } catch (e) {
    showToast("创建对话失败");
  }
}

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
  } else if (event === "ai_error") {
    streaming.value = false;
    isThinking.value = false;
    messages.value = messages.value.filter((m) => !(m.id === streamMsgId.value && !m.content));
    showToast(data.message || "AI 回复失败");
  } else if (event === "error") {
    console.error("[chat] server error", data);
    isThinking.value = false;
  }
}

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
  } catch (e) {
    console.error("[chat] transcribe error", e);
    showToast("语音识别失败");
  } finally {
    recognizing.value = false;
  }
}

// ── 记录表达 ──
function recordWord(content: string) {
  recordText.value = content.slice(0, 100);
  showRecord.value = true;
}

async function confirmRecord() {
  const text = recordText.value.trim();
  if (!text) return;
  try {
    await learningApi.add(text);
    showRecord.value = false;
    showSuccessToast("已记录");
  } catch (e) {
    showToast("记录失败");
  }
}

// ── TTS 播放 ──
let audioEl: HTMLAudioElement | null = null;

async function playTts(text: string) {
  try {
    const blob = await speechApi.synthesize(text);
    const url = URL.createObjectURL(blob);
    if (!audioEl) audioEl = new Audio();
    audioEl.src = url;
    audioEl.play().catch(() => {});
  } catch (e) {
    console.error("[chat] tts error", e);
  }
}

async function endChat() {
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

function goBack() {
  router.back();
}
</script>

<style lang="scss" scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f0f2f5;
}

.chat-header {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  background: linear-gradient(135deg, #4a90d9, #6db3f2);
  flex-shrink: 0;
}

.header-back {
  width: 36px;
  cursor: pointer;
  display: flex;
}

.header-center {
  flex: 1;
  text-align: center;

  .header-title {
    display: block;
    font-size: 17px;
    font-weight: 600;
    color: #fff;
  }

  .header-status {
    display: block;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.6);
    margin-top: 2px;

    &.online {
      color: #a8e6a3;
    }
  }
}

.header-actions {
  width: 70px;
  display: flex;
  justify-content: flex-end;
}

.message-list {
  flex: 1;
  padding: 14px;
  overflow-y: auto;
}

.chat-hint {
  text-align: center;
  padding-top: 80px;

  .hint-icon {
    font-size: 44px;
    margin-bottom: 10px;
  }

  .hint-text {
    font-size: 17px;
    color: #333;
    font-weight: 500;
  }

  .hint-sub {
    font-size: 12px;
    color: #999;
    margin-top: 6px;
  }
}

.message {
  display: flex;
  margin-bottom: 16px;
  gap: 8px;
}

.message-ai {
  flex-direction: row;
}

.message-user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
  flex-shrink: 0;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.message-bubble {
  max-width: 72%;
  padding: 12px 14px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  word-break: break-word;

  &.thinking {
    background: #f0f2f5;
    color: #999;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.message-ai .message-bubble {
  border-bottom-left-radius: 4px;
}

.message-user .message-bubble {
  background: linear-gradient(135deg, #4a90d9, #357abd);
  border-bottom-right-radius: 4px;

  .message-text {
    color: #fff;
  }
}

.message-text {
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  white-space: pre-wrap;
}

.message-actions {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #eee;
  display: flex;
  gap: 14px;

  .action-btn {
    font-size: 12px;
    color: #4a90d9;
    cursor: pointer;
  }
}

.input-area {
  background: #fff;
  padding: 10px 14px;
  border-top: 1px solid #eee;
  flex-shrink: 0;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.text-input {
  flex: 1;
  height: 38px;
  background: #f5f5f5;
  border-radius: 19px;
  padding: 0 14px;
  font-size: 14px;
  border: none;
  outline: none;
}

.voice-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(74, 144, 217, 0.3);
  cursor: pointer;

  &.recording {
    animation: pulse 1s infinite;
  }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.12); }
}

.send-btn {
  padding: 8px 16px;
  background: #4a90d9;
  border-radius: 19px;
  flex-shrink: 0;
  cursor: pointer;

  span {
    font-size: 13px;
    color: #fff;
  }
}

.voice-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
  font-size: 11px;
  color: #e24b4a;
  margin-top: 6px;

  .tip-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #e24b4a;
  }
}

.record-popup {
  .popup-title {
    font-size: 17px;
    font-weight: 600;
    color: #333;
    margin-bottom: 12px;
    text-align: center;
  }

  .popup-input {
    width: 100%;
    min-height: 70px;
    background: #f5f5f5;
    border-radius: 10px;
    padding: 10px;
    font-size: 14px;
    border: none;
    box-sizing: border-box;
    resize: none;
    outline: none;
  }

  .popup-actions {
    display: flex;
    gap: 10px;
    margin-top: 14px;

    :deep(.van-button) {
      flex: 1;
    }
  }
}
</style>
