<template>
  <view class="chat-page">
    <!-- 导航栏 -->
    <view class="chat-header">
      <view class="header-back" @click="goBack">
        <text>←</text>
      </view>
      <view class="header-center">
        <text class="header-title">{{ scenarioName }}</text>
        <text class="header-status" :class="{ online: connected }">
          {{ connected ? "● 在线" : "○ 连接中..." }}
        </text>
      </view>
      <view class="header-actions">
        <wd-button size="small" plain type="danger" @click="endChat">结束</wd-button>
      </view>
    </view>

    <!-- 消息列表 -->
    <scroll-view
      class="message-list"
      scroll-y
      :scroll-top="scrollTop"
      :refresher-enabled="false"
    >
      <view v-if="messages.length === 0" class="chat-hint">
        <text class="hint-icon">🎤</text>
        <text class="hint-text">开始你的英语对话吧！</text>
        <text class="hint-sub">支持中文、英文和中英混合</text>
      </view>

      <view
        v-for="msg in messages"
        :key="msg.id"
        class="message"
        :class="msg.role === 'user' ? 'message-user' : 'message-ai'"
      >
        <view class="message-avatar">
          <text>{{ msg.role === "user" ? "👤" : "🤖" }}</text>
        </view>
        <view class="message-bubble">
          <text class="message-text">{{ msg.content }}</text>
          <view class="message-actions" v-if="msg.role === 'assistant'">
            <text class="action-btn" @click="recordWord(msg.content)">💡 记录表达</text>
          </view>
        </view>
      </view>

      <!-- 输入中... -->
      <view class="message message-ai" v-if="isThinking">
        <view class="message-avatar"><text>🤖</text></view>
        <view class="message-bubble thinking">
          <wd-loading size="24rpx" color="#999" />
          <text>AI 正在思考...</text>
        </view>
      </view>
    </scroll-view>

    <!-- 输入区域 -->
    <view class="input-area safe-bottom">
      <view class="input-row">
        <input
          class="text-input"
          v-model="inputText"
          placeholder="说点什么... (支持中英混合)"
          :disabled="isThinking"
          @confirm="sendText"
        />
        <view
          class="voice-btn"
          :class="{ recording }"
          @touchstart="startRecord"
          @touchend="stopRecord"
          @touchcancel="stopRecord"
        >
          <text>{{ recording ? "⏺" : "🎙️" }}</text>
        </view>
        <view class="send-btn" v-if="inputText.trim()" @click="sendText">
          <text>发送</text>
        </view>
      </view>
      <view class="voice-tip" v-if="recording">
        <text class="tip-dot"></text>
        <text>{{ recognizing ? "正在识别..." : "松开结束录音" }}</text>
      </view>
    </view>

    <!-- 学习记录弹窗 -->
    <wd-popup v-model="showRecord" position="bottom" :safe-area-inset-bottom="true">
      <view class="record-popup">
        <text class="popup-title">记录学习内容</text>
        <textarea
          class="popup-input"
          v-model="recordText"
          placeholder="输入单词或短语"
          :maxlength="100"
        />
        <view class="popup-actions">
          <wd-button size="large" plain type="info" @click="showRecord = false">取消</wd-button>
          <wd-button size="large" type="primary" @click="confirmRecord">记录</wd-button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { conversationApi, learningApi, speechApi, getToken, WS_URL } from "@/api";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
}

const scenarioId = ref(0);
const scenarioName = ref("");
const conversationId = ref(0);
const messages = ref<Message[]>([]);
const inputText = ref("");
const isThinking = ref(false);
const scrollTop = ref(0);
const socketTask = ref<UniApp.SocketTask | null>(null);
const connected = ref(false);

const showRecord = ref(false);
const recordText = ref("");

onMounted(() => {
  const pages = getCurrentPages();
  const page = pages[pages.length - 1];
  const options = (page as any).$page?.options || {};
  scenarioId.value = Number(options.scenarioId) || 0;
  scenarioName.value = decodeURIComponent(options.scenarioName || "AI 对话");
  initConversation();
});

onUnmounted(() => {
  if (socketTask.value) { socketTask.value.close(); socketTask.value = null; }
});

async function initConversation() {
  try {
    const conv = await conversationApi.create(scenarioId.value);
    conversationId.value = conv.id;
    connectSocket();
  } catch (e) {
    uni.showToast({ title: "创建对话失败", icon: "none" });
  }
}

function connectSocket() {
  const token = getToken();
  if (!token) {
    console.warn("[chat] no token, skip socket");
    return;
  }

  const url = `${WS_URL}/ws/conversations?token=${encodeURIComponent(token)}`;
  const task = uni.connectSocket({
    url,
    success: () => console.log("[chat] connecting..."),
    fail: (e) => console.error("[chat] connect fail", e),
  });

  task.onOpen(() => {
    connected.value = true;
    sendWS(task, "join", { conversation_id: conversationId.value });
  });

  task.onMessage((res: any) => {
    try {
      const payload = JSON.parse(res.data);
      handleWSMessage(payload);
    } catch (e) {
      console.error("[chat] bad message", e, res.data);
    }
  });

  task.onClose(() => { connected.value = false; });
  task.onError((e: any) => {
    console.error("[chat] socket error", e);
    connected.value = false;
  });

  socketTask.value = task;
}

function sendWS(task: UniApp.SocketTask, event: string, data: any) {
  task.send({ data: JSON.stringify({ event, data }) });
}

function handleWSMessage(payload: any) {
  const event = payload.event;
  const data = payload.data ?? payload;

  if (event === "joined") {
    // 加入成功
  } else if (event === "ai_response") {
    isThinking.value = false;
    messages.value.push({ id: Date.now(), role: "assistant", content: data.text });
    scrollToBottom();
    playTts(data.text); // AI 回复自动语音播放
  } else if (event === "error") {
    console.error("[chat] server error", data);
    isThinking.value = false;
  }
}

async function sendText() {
  const text = inputText.value.trim();
  if (!text) return;
  if (isThinking.value) {
    uni.showToast({ title: "AI 正在回复，请稍候", icon: "none" });
    return;
  }

  const msgId = Date.now();
  messages.value.push({ id: msgId, role: "user", content: text });
  inputText.value = "";
  isThinking.value = true;
  scrollToBottom();

  if (!connected.value || !socketTask.value) {
    isThinking.value = false;
    messages.value.push({ id: msgId + 1, role: "assistant", content: "WebSocket 未连接，请确认已登录且后端已启动" });
    return;
  }

  sendWS(socketTask.value, "text", { conversation_id: conversationId.value, content: text });
}

// 录音管理器: H5 用原生 MediaRecorder (本 uniapp alpha 版 H5 不支持 uni.getRecorderManager),
// App/小程序用 uni.getRecorderManager
const recording = ref(false);
const recognizing = ref(false);

// #ifdef H5
let h5Recorder: MediaRecorder | null = null;
let h5Chunks: BlobPart[] = [];
let h5Stream: MediaStream | null = null;

function startRecord() {
  if (recording.value || recognizing.value || isThinking.value) return;
  if (!getToken()) {
    uni.showToast({ title: "请先登录", icon: "none" });
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
        console.log("[chat] record blob", blob.size, "bytes, mime:", mime);
        if (blob.size > 0) doTranscribe({ file: blob, mimeType: mime });
      };
      h5Recorder.start();
      recording.value = true;
    })
    .catch((err) => {
      console.error("[chat] mic error", err);
      uni.showToast({ title: "无法访问麦克风，请检查权限", icon: "none" });
    });
}

function stopRecord() {
  if (h5Recorder && h5Recorder.state !== "inactive") {
    h5Recorder.stop();
    h5Recorder = null;
  }
}
// #endif

// #ifndef H5
const recorder = uni.getRecorderManager();

recorder.onStart(() => {
  recording.value = true;
});
recorder.onStop((res: any) => {
  recording.value = false;
  if (res?.tempFilePath) {
    doTranscribe({ filePath: res.tempFilePath });
  }
});
recorder.onError((err: any) => {
  recording.value = false;
  console.error("[chat] record error", err);
  uni.showToast({ title: "录音失败", icon: "none" });
});

function startRecord() {
  if (recording.value || recognizing.value || isThinking.value) return;
  if (!getToken()) {
    uni.showToast({ title: "请先登录", icon: "none" });
    return;
  }
  recorder.start({ duration: 60000, sampleRate: 16000, format: "mp3" });
}

function stopRecord() {
  recorder.stop();
}
// #endif

async function doTranscribe(input: { filePath?: string; file?: Blob; mimeType?: string }) {
  recognizing.value = true;
  try {
    const res = await speechApi.transcribe(input);
    const text = (res?.text ?? "").trim();
    if (!text) {
      uni.showToast({ title: "没听清，请再说一次", icon: "none" });
      return;
    }
    // AI 正在回复时禁止发送, 避免静默丢失; 明确提示用户
    if (isThinking.value) {
      uni.showToast({ title: "AI 正在回复，请稍候再说话", icon: "none" });
      inputText.value = text; // 保留文本, 用户可稍后手动发送
      return;
    }
    // 转写文本直接作为消息发送, 复用文本链路
    inputText.value = text;
    await sendText();
  } catch (e: any) {
    const msg = e?.message ?? "";
    uni.showToast({
      title: msg.includes("429") || msg.includes("余额") ? "语音服务额度不足" : "识别失败，请重试",
      icon: "none",
    });
  } finally {
    recognizing.value = false;
  }
}

function recordWord(content: string) {
  recordText.value = content.slice(0, 100);
  showRecord.value = true;
}

// TTS 播放: AI 回复自动发声
// #ifdef H5
async function playTts(text: string) {
  try {
    const blob = await speechApi.synthesize(text);
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.onerror = () => URL.revokeObjectURL(url);
    await audio.play(); // 需用户已交互 (按住录音即算), 否则浏览器拦截
  } catch (e) {
    console.warn("[chat] tts play failed", e);
  }
}
// #endif
// #ifndef H5
function playTts(text: string) {
  // 小程序/App: 待接 uni.createInnerAudioContext (需把 arraybuffer 存为临时文件)
  console.warn("[chat] tts playback not implemented on this platform", text.slice(0, 20));
}
// #endif

async function confirmRecord() {
  const text = recordText.value.trim();
  if (!text) return;
  try {
    await learningApi.add(text);
    showRecord.value = false;
    uni.showToast({ title: "已记录", icon: "success" });
  } catch (e) {
    uni.showToast({ title: "记录失败", icon: "none" });
  }
}

async function endChat() {
  try {
    if (socketTask.value) { socketTask.value.close(); socketTask.value = null; }
    await conversationApi.end(conversationId.value, {});
    uni.showToast({ title: "对话已结束", icon: "success" });
  } catch (e) { /* ignore */ }
  goBack();
}

function goBack() { uni.navigateBack(); }

function scrollToBottom() {
  nextTick(() => { scrollTop.value = scrollTop.value + 9999; });
}
</script>

<style lang="scss" scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f0f2f5;
}

// 导航栏
.chat-header {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  background: linear-gradient(135deg, #4a90d9, #6db3f2);
  flex-shrink: 0;
}

.header-back {
  font-size: 36rpx;
  color: #fff;
  width: 60rpx;
}

.header-center {
  flex: 1;
  text-align: center;

  .header-title {
    display: block;
    font-size: 32rpx;
    font-weight: 600;
    color: #fff;
  }

  .header-status {
    display: block;
    font-size: 20rpx;
    color: rgba(255, 255, 255, 0.6);
    margin-top: 2rpx;

    &.online {
      color: #a8e6a3;
    }
  }
}

.header-actions {
  width: 120rpx;
  display: flex;
  justify-content: flex-end;
}

// 消息区
.message-list {
  flex: 1;
  padding: 24rpx;
  overflow-y: auto;
}

.chat-hint {
  text-align: center;
  padding-top: 120rpx;

  .hint-icon {
    font-size: 72rpx;
    display: block;
    margin-bottom: 16rpx;
  }

  .hint-text {
    display: block;
    font-size: 32rpx;
    color: #333;
    font-weight: 500;
  }

  .hint-sub {
    display: block;
    font-size: 24rpx;
    color: #999;
    margin-top: 8rpx;
  }
}

.message {
  display: flex;
  margin-bottom: 24rpx;
  gap: 12rpx;
}

.message-ai {
  flex-direction: row;
}

.message-user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  flex-shrink: 0;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.06);
}

.message-bubble {
  max-width: 72%;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  background: #fff;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.04);

  &.thinking {
    background: #f0f2f5;
    color: #999;
    font-size: 24rpx;
    display: flex;
    align-items: center;
    gap: 12rpx;
  }
}

.message-ai .message-bubble {
  border-bottom-left-radius: 4rpx;
}

.message-user .message-bubble {
  background: linear-gradient(135deg, #4a90d9, #357abd);
  border-bottom-right-radius: 4rpx;

  .message-text {
    color: #fff;
  }
}

.message-text {
  font-size: 28rpx;
  line-height: 1.6;
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-actions {
  margin-top: 12rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #eee;

  .action-btn {
    font-size: 24rpx;
    color: #4a90d9;
  }
}

// 输入区
.input-area {
  background: #fff;
  padding: 16rpx 24rpx;
  border-top: 1rpx solid #eee;
  flex-shrink: 0;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.text-input {
  flex: 1;
  height: 72rpx;
  background: #f5f5f5;
  border-radius: 36rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
}

.voice-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  flex-shrink: 0;
  box-shadow: 0 4rpx 12rpx rgba(74, 144, 217, 0.3);
  transition: transform 0.15s;

  &.recording {
    background: linear-gradient(135deg, #e74c3c, #c0392b);
    box-shadow: 0 4rpx 12rpx rgba(231, 76, 60, 0.4);
    transform: scale(1.12);
    animation: record-pulse 1s infinite;
  }
}

@keyframes record-pulse {
  0%, 100% { transform: scale(1.08); }
  50% { transform: scale(1.18); }
}

.voice-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding-top: 12rpx;
  font-size: 24rpx;
  color: #e74c3c;

  .tip-dot {
    width: 14rpx;
    height: 14rpx;
    border-radius: 50%;
    background: #e74c3c;
    animation: record-pulse 1s infinite;
  }
}

.send-btn {
  padding: 12rpx 28rpx;
  background: #4a90d9;
  border-radius: 36rpx;
  flex-shrink: 0;

  text {
    font-size: 26rpx;
    color: #fff;
  }
}

// 记录弹窗
.record-popup {
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx 32rpx 48rpx;

  .popup-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 20rpx;
    display: block;
    text-align: center;
  }

  .popup-input {
    width: 100%;
    height: 160rpx;
    background: #f5f5f5;
    border-radius: 12rpx;
    padding: 16rpx;
    font-size: 28rpx;
    margin-bottom: 24rpx;
    box-sizing: border-box;
  }

  .popup-actions {
    display: flex;
    gap: 16rpx;

    :deep(wd-button) {
      flex: 1;
    }
  }
}
</style>
