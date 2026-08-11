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
        <view class="voice-btn" @touchstart="startRecord" @touchend="stopRecord">
          <text>🎙️</text>
        </view>
        <view class="send-btn" v-if="inputText.trim()" @click="sendText">
          <text>发送</text>
        </view>
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
import { conversationApi, learningApi, getToken, WS_URL } from "@/api";

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
  } else if (event === "error") {
    console.error("[chat] server error", data);
    isThinking.value = false;
  }
}

async function sendText() {
  const text = inputText.value.trim();
  if (!text || isThinking.value) return;

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

function startRecord() { uni.showToast({ title: "语音功能开发中", icon: "none" }); }
function stopRecord() {}

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
