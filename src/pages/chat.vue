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
          <div class="header-status" :class="{ online: connected, reconnecting: reconnecting }">
            <span class="status-dot"></span>
            {{ connected ? "AI 老师在线" : (reconnecting ? "连接断开，重连中..." : "连接中...") }}
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
        </div>
        <!-- 播放/停止操作：放在消息气泡右侧（仅 AI 消息），随气泡垂直居中 -->
        <div class="message-actions" v-if="msg.role === 'assistant'">
          <span class="action-btn" :class="{ playing: playingMsgId === msg.id }" @click="togglePlay(msg)">
            {{ playingMsgId === msg.id ? "⏹" : "🔊" }}
          </span>
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
import { Subject, interval, timer } from "rxjs";
import type { Subscription } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { webSocket, WebSocketSubject } from "rxjs/webSocket";
import { conversationApi, learningApi, speechApi, userApi, getToken, WS_URL } from "@/api";
import { useVoiceDetector } from "@/composables/useVoiceDetector";
import { resolveAsrLang } from "@/config/languages";
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
const connected = ref(false);
const reconnecting = ref(false);

// ── WS 连接（RxJS 管理：事件流 + 心跳 + 重连 + 统一清理，防内存泄漏）──
/** 连接代际：每次 connectSocket +1，旧连接的回调（open/close/心跳）据此失效，杜绝串扰 */
let wsGen = 0;
let wsSubject: WebSocketSubject<any> | null = null;
/** 指数退避重连计数（连接成功/主动清理时归零） */
let reconnectAttempts = 0;
/** 重连定时器订阅（RxJS timer，随 destroy$ 自动清理） */
let reconnectTimerSub: Subscription | null = null;
/** 心跳参数：25s 发 ping；60s 无任何消息视为假死，强制重连 */
const PING_INTERVAL_MS = 25_000;
const STALE_TIMEOUT_MS = 60_000;
let lastMsgAt = 0;
/** 页面是否已卸载（卸载后禁止任何重连/副作用） */
let destroyed = false;
/** 页面卸载信号：全部订阅 takeUntil(destroy$)，卸载即自动取消订阅（RxJS 防泄漏核心） */
const destroy$ = new Subject<void>();
/** 显式收集的活动订阅（消息/心跳/假死检测），替换连接时先整体取消 */
const wsSubs: Subscription[] = [];

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

// VAD 分段录音器：停顿自动切段 → 转写 → 自动发送。
// 参数经调优（详见 docs/音频识别优化方案.md）：
// - 显式开启回声消除/降噪/自动增益（useVoiceDetector 内 getUserMedia 约束）
// - 触发阈值自适应噪声地板（triggerRatio=4），环境音不再误触发
// - 预卷 400ms + 句尾取尾补齐，解决句首/句尾被切（接收不全）
const voiceDetector = useVoiceDetector({
  minSpeechMs: 350, // <0.35s 视为噪音（英语短词 stop/yes/ok 约 0.3~0.6s，500ms 会把短词整段丢弃 → 识别不到/不准）
  maxSpeechMs: 15000, // 单句最长 15s（受 DashScope base64 10MB 上限约束）
  silenceMs: 1200, // 静音 1.2s 判定一句结束（英文学习者思考停顿多，0.9s 会把句子切碎）
  onSegment: (blob, mimeType) => handleLiveSegment(blob, mimeType),
  // barge-in（2026-08-22）：TTS 播放中 VAD 保持聆听，用户一开口立即打断播报。
  // 打断后回声源消失，用户后半句录音干净；误触发（AEC 未消净的 TTS 回声）时
  // 只会打断播报、不会产生幻听消息（转写为空则丢弃）——"安全失败"。
  onSpeechStart: () => handleBargeIn(),
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
  try {
    const ok = await voiceDetector.start();
    if (!ok) {
      // start() 返回 false：麦克风权限被拒 / AudioContext 无法启动
      showToast("无法访问麦克风，请检查权限");
      return;
    }
    liveStarted.value = true;
  } catch (e: any) {
    // start() 内部异常（如 AudioContext 创建失败）也要兜住，避免页面卡死
    console.error("[chat] startLive error", e);
    showToast("启动聆听失败，请重试");
  }
}

/** 停止实时聆听 */
function stopLive() {
  voiceDetector.stop();
  liveStarted.value = false;
  liveTranscribing.value = false;
}

/** VAD 切段回调：转写该段并自动发送（无感闭环） */
/**
 * barge-in 打断（2026-08-22）：VAD 检测到用户开口（onSpeechStart）时调用。
 * 若 TTS 正在播放 → 立即停掉播报（stopTts：停 audio + 复位 ttsPlaying + 恢复聆听）。
 * 回声源消失后，用户后半句录音干净，切段后正常进入对话 —— 实现"边说边打断 AI"。
 * 若没在播放 → 无操作（正常聆听路径，不影响切段）。
 * 误触发（AEC 未消净的 TTS 回声）时：只打断播报、不会产生幻听消息
 * （后续转写为空则丢弃）——"安全失败"，宁可少播不可乱发。
 */
function handleBargeIn() {
  if (ttsPlaying.value) {
    console.debug("[chat] barge-in：检测到说话，打断 TTS 播报");
    stopTts(); // 停 TTS + 复位 ttsPlaying + 退出 barge-in 模式
    // 丢弃打断前已录入的段缓冲（含 TTS 外放回声）——否则用户后半句转写
    // 会混入 AI 刚说的话，识别不准确。重置后用户继续说话重新起算，段只含人声。
    voiceDetector.resetSegment();
  }
}

async function handleLiveSegment(blob: Blob, mimeType: string) {
  // 丢弃原因都打日志，方便排查"收不到语音"：
  // - liveTranscribing=true：上一段还在转写中（含 60s 超时+重试，最长达分钟级），当前段被挤掉
  // - ttsPlaying=true：TTS 正在外放，本段极可能是扬声器回声（防幻听第三层）
  // - isThinking=true：AI 回复中（正常），但若回复状态卡死也会静默丢段
  // - !liveStarted：聆听已停止（正常）
  if (liveTranscribing.value) {
    console.debug("[chat] live 段被丢弃：上一段仍在转写中");
    return;
  }
  // 注：不再有 ttsPlaying 丢弃分支（2026-08-22 barge-in 改造）——
  // 播放中用户开口由 onSpeechStart → handleBargeIn 先停 TTS，本段已是干净的用户声音；
  // 若播放中无人说话，VAD 不会切段（TTS 外放由浏览器 AEC 消掉，残余不足以触发）。
  if (isThinking.value) {
    console.debug("[chat] live 段被丢弃：AI 正在回复中 (isThinking=true)");
    return;
  }
  if (!liveStarted.value) return;
  liveTranscribing.value = true;
  console.debug(`[chat] live 段转写开始 blob=${blob.size}B mime=${mimeType}`);
  try {
    // 传入用户配置的识别语言（如 "en"）：显式语言提示可显著改善英文识别（压掉中文母语先验）
    const res = await speechApi.transcribe({ file: blob, mimeType }, resolveAsrLang(recogLang.value));
    const text = (res?.text ?? "").trim();
    if (!text) return; // 空识别直接忽略，继续聆听
    if (isThinking.value) return; // AI 正在回复，丢弃本次输入
    // 无感发送：不进输入框，直接走 WS。
    // 注意：未连接判断必须在 push 之前，旧代码在这里 pop() 会误删上一条 AI 消息。
    if (!sendWs({ event: "text", data: { conversation_id: conversationId.value, content: text } })) {
      showToast("连接已断开，请重试");
      return;
    }
    messages.value.push({ id: Date.now(), role: "user", content: text });
    isThinking.value = true;
    streaming.value = false;
    // AI 回复期间暂停聆听，防止录到 TTS 回声
    voiceDetector.pause();
    scrollToBottom();
  } catch (e: any) {
    console.error("[chat] live transcribe error", e);
    showToast(e?.message || "语音识别失败");
  } finally {
    liveTranscribing.value = false;
  }
}

/**
 * 播放收尾处理（live 模式，2026-08-22 barge-in 改造后）：
 * - barge-in 模式下 VAD 播放中保持聆听（playTts 播放开始已 resume），
 *   本函数主要负责：播放结束/停止时的**状态清理**（playingMsgId/ttsPlaying/定时器/监听）
 * - 恢复聆听时机：① ended 真正触发（等 TTS 自然播完，不再提前静音——曾导致
 *   "最后 0.6s 突然无声"体验差，2026-08-22 废弃尾音提前恢复）；② 播放卡死检测
 *   （currentTime 连续 3s 停滞才恢复，长文本正常播放不会再被打断，只有真卡死才兜底，
 *   防 VAD 永不恢复）
 * - token 绑定：旧播放（被停止/被新播放覆盖）的恢复回调一律失效，防串扰
 */
function resumeLiveAfterReply() {
  if (mode.value !== "live" || !liveStarted.value) return;
  const token = ttsToken; // 绑定本次播放令牌：被新播放/停止覆盖后，旧回调全部失效
  const resumeNow = () => {
    if (ttsTailTimer !== null) {
      clearTimeout(ttsTailTimer);
      ttsTailTimer = null;
    }
    audioEl?.removeEventListener("ended", onEnded);
    if (token !== ttsToken) return; // 已被新播放/停止覆盖：本次恢复作废
    playingMsgId.value = null; // 播放结束/停止：清除"正在播放"标记
    ttsPlaying.value = false; // 音频不再出声，守卫解除
    voiceDetector.setBargeIn(false); // 恢复正常灵敏度（播放结束/卡死兜底恢复时）
    // 仅当 TTS 此刻仍在出声（卡死兜底 / 停止后的异常残留）才静音——0 音量物理上
    // 无法被麦克风捕获，防残留外放触发 VAD 幻听。正常 ended 路径 audioEl.ended=true
    // 不会执行，播放完整播完——不再有"最后 0.6s 突然无声"的体验问题（2026-08-22）。
    if (audioEl && !audioEl.paused && !audioEl.ended) audioEl.volume = 0;
    voiceDetector.resume();
  };
  // 尾音提前恢复已废弃（2026-08-22）：曾监听 timeupdate 剩 <0.6s 即静音+恢复聆听，
  // 导致每段播放结尾"突然停止"（用户反馈体验差）。现在等 ended 自然播完再收尾。
  function onEnded() {
    if (token !== ttsToken) return;
    resumeNow();
  }
  if (audioEl && !audioEl.paused && !audioEl.ended) {
    audioEl.addEventListener("ended", onEnded, { once: true });
    // 卡死检测：每 1s 检查一次 currentTime，连续 3 次（3s）无推进且未 ended
    // → 判定播放卡死（play() 被拒/音频源卡住），恢复聆听兜底。
    // 替代旧版"8s 定时恢复"：长文本正常播放（>8s）不再被打断，只有真卡死才恢复。
    let lastPos = audioEl.currentTime;
    let stallCount = 0;
    const checkStall = () => {
      if (token !== ttsToken) return;
      if (!audioEl) {
        resumeNow();
        return;
      }
      if (audioEl.ended || audioEl.paused) {
        resumeNow();
        return;
      }
      const pos = audioEl.currentTime;
      if (pos === lastPos) {
        stallCount++;
        if (stallCount >= 3) {
          console.warn("[chat] tts 播放停滞，恢复聆听兜底");
          resumeNow();
          return;
        }
      } else {
        stallCount = 0;
        lastPos = pos;
      }
      ttsTailTimer = window.setTimeout(checkStall, 1000);
    };
    ttsTailTimer = window.setTimeout(checkStall, 1000);
  } else {
    // 没有正在播放的音频（合成失败/已停止等）：短暂延迟后恢复
    window.setTimeout(() => {
      if (token !== ttsToken) return;
      resumeNow();
    }, 700);
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
  loadUserSettings(); // 拉取用户语音设置（语速 + 识别语言）
  initConversation();
});

onUnmounted(() => {
  // RxJS 生命周期收尾：置 destroyed 拦截一切重连副作用，destroy$ complete 让所有
  // takeUntil(destroy$) 的订阅（消息/心跳/假死/重连）自动取消 —— 防内存泄漏核心
  destroyed = true;
  destroy$.next();
  destroy$.complete();
  cleanupSocket();
  voiceDetector.stop();
  stopTts(); // 停止播放并释放音频，避免离开页面后还在响
});

/** 拉取用户语音设置（settings：语速 speed + 识别语言 language），进入页面时调用；失败静默用默认 */
async function loadUserSettings() {
  try {
    const s = await userApi.getSettings();
    if (typeof s.speed === "number") ttsSpeed.value = Math.min(1.5, Math.max(0.5, s.speed));
    if (typeof s.language === "string") recogLang.value = s.language;
  } catch {
    /* 未登录 / 接口异常时用默认值 */
  }
}

/** 初始化会话：
 * 1. query 携带 conversationId（首页"继续练习"）→ 恢复已有会话：拉历史消息渲染，直接 join 继续对话
 * 2. 否则（场景库/今日生词入口）→ 创建新会话 → join
 */
async function initConversation() {
  const resumeId = Number(route.query.conversationId) || 0;
  try {
    if (resumeId) {
      try {
        // 恢复模式：detail 返回会话 + 历史消息 + 场景
        const conv = await conversationApi.detail(resumeId);
        conversationId.value = conv.id;
        if (conv.scenario?.name) scenarioName.value = conv.scenario.name;
        // 历史消息按时间正序渲染（主键自增即创建顺序）
        messages.value = (conv.messages ?? [])
          .filter((m: any) => m.role === "user" || m.role === "assistant")
          .map((m: any) => ({ id: m.id, role: m.role, content: m.content }));
        connectSocket();
        nextTick(scrollToBottom); // 恢复后滚动到底部，看到上次最后一条消息
        return;
      } catch {
        // 会话已被删除（404）：降级为新会话，全新上下文（2026-08-22）。
        // 首页删除后若仍带着旧 conversationId 进入，不应报"初始化失败"，
        // 而应视为"清空上下文重新开始"——直接开一个新会话。
        console.warn("[chat] 恢复会话失败（可能已删除），降级为新会话");
      }
    }
    const conv = await conversationApi.create(scenarioId.value);
    conversationId.value = conv.id;
    connectSocket();
  } catch (e) {
    showToast("对话初始化失败");
  }
}

/**
 * 建立 WebSocket 连接（RxJS WebSocketSubject 管理，/ws/conversations?token=...）。
 *
 * RxJS 化的收益（2026-08-22）：
 * - 事件流（open/close/message）+ 定时器（心跳/假死/重连）统一为可组合流
 * - 所有订阅 takeUntil(destroy$)：页面卸载即自动取消，杜绝定时器/订阅泄漏
 * - 连接"代际"（wsGen）让旧连接回调全部失效，替换连接零串扰
 *
 * 事件语义（与 WebSocketSubject 对应）：
 * - openObserver → 连接建立：发 join + 重置重连计数 + 状态复位
 * - closeObserver → 连接关闭（主动/异常都到这）：复位 AI 状态 + 计划重连
 *   （主动替换/卸载由 wsGen / destroyed 拦截，不触发重连）
 */
function connectSocket() {
  const token = getToken();
  if (!token) {
    showToast("请先登录");
    router.replace("/profile");
    return;
  }

  const gen = ++wsGen; // 新一代连接：旧连接的一切回调随之失效
  disposeWsSubs(); // 先取消旧连接的活动订阅（消息/心跳/假死/重连）

  const url = `${WS_URL}/ws/conversations?token=${encodeURIComponent(token)}`;
  lastMsgAt = Date.now();

  wsSubject = webSocket<any>({
    url,
    openObserver: {
      next: () => {
        if (gen !== wsGen || destroyed) return; // 旧连接/已卸载，忽略
        connected.value = true;
        reconnecting.value = false;
        reconnectAttempts = 0; // 连接成功，重置退避步数
        wsSubject?.next({ event: "join", data: { conversation_id: conversationId.value } });
      },
    },
    closeObserver: {
      next: () => {
        if (gen !== wsGen || destroyed) return; // 旧连接/已卸载，不触发重连
        connected.value = false;
        // 关键修复（2026-08-16）：断线复位 AI 回复状态，
        // 否则 isThinking 卡 true 会静默丢弃所有后续语音段
        isThinking.value = false;
        streaming.value = false;
        liveTranscribing.value = false;
        if (mode.value === "live" && liveStarted.value) voiceDetector.resume();
        scheduleReconnect(gen); // 指数退避重连
      },
    },
  });

  // 消息流 → handleWSMessage（pong 仅用于假死兜底，不分发 UI）
  const msgSub = wsSubject.pipe(takeUntil(destroy$)).subscribe({
    next: (raw: any) => {
      lastMsgAt = Date.now(); // 任何消息都算"连接存活"
      let payload: any;
      try {
        payload = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (err) {
        console.error("[chat] bad message", err, raw);
        return;
      }
      if (payload?.event === "pong") return;
      handleWSMessage(payload);
    },
    error: (err) => console.error("[chat] ws error", err),
  });

  // 心跳：25s 定时 ping（保持连接活跃）
  const pingSub = interval(PING_INTERVAL_MS).pipe(takeUntil(destroy$)).subscribe(() => {
    if (gen !== wsGen || destroyed) return;
    if (wsSubject && connected.value) wsSubject.next({ event: "ping" });
  });

  // 假死检测：60s 无任何消息 → 主动关闭触发 closeObserver → 重连
  const staleSub = interval(5_000).pipe(takeUntil(destroy$)).subscribe(() => {
    if (gen !== wsGen || destroyed) return;
    if (connected.value && Date.now() - lastMsgAt > STALE_TIMEOUT_MS) {
      console.warn("[chat] heartbeat stale, force reconnect");
      wsSubject?.complete(); // 触发 closeObserver（gen 未变 → 走重连）
    }
  });

  wsSubs.push(msgSub, pingSub, staleSub);
}

/** 统一发送：连接可用才发，返回是否成功（替代原 socket.value.send） */
function sendWs(payload: any): boolean {
  if (!wsSubject || !connected.value) return false;
  wsSubject.next(payload);
  return true;
}

/** 指数退避自动重连：1s×2^n 封顶 30s，加 ±30% 抖动；RxJS timer 管理（随 destroy$ 清理） */
function scheduleReconnect(gen: number) {
  if (destroyed || gen !== wsGen) return; // 已卸载 / 已有新连接
  if (reconnectTimerSub) reconnectTimerSub.unsubscribe(); // 防重复排队
  reconnecting.value = true;
  const delay = Math.min(1000 * 2 ** reconnectAttempts, 30_000) * (0.7 + Math.random() * 0.6);
  reconnectAttempts++;
  console.warn(`[chat] ws closed, reconnect in ${Math.round(delay)}ms (attempt ${reconnectAttempts})`);
  reconnectTimerSub = timer(delay)
    .pipe(takeUntil(destroy$))
    .subscribe(() => {
      reconnectTimerSub = null;
      if (destroyed) return;
      connectSocket(); // 新一代 gen 自动 +1
    });
}

/** 取消当前连接的全部活动订阅（替换连接/清理时调用） */
function disposeWsSubs() {
  for (const s of wsSubs) s.unsubscribe();
  wsSubs.length = 0;
  if (reconnectTimerSub) {
    reconnectTimerSub.unsubscribe();
    reconnectTimerSub = null;
  }
}

/** 主动断开并清理（结束会话/页面卸载）：不触发重连 */
function cleanupSocket() {
  wsGen++; // 令所有旧回调（open/close/心跳）失效
  reconnecting.value = false;
  reconnectAttempts = 0;
  disposeWsSubs();
  if (wsSubject) {
    try {
      wsSubject.complete(); // 关闭底层连接；closeObserver 因 wsGen 已变被忽略
    } catch {
      /* ignore */
    }
    wsSubject = null;
  }
  connected.value = false;
}

/**
 * 流式事件协议分发（与后端 ConversationGateway 对应）：
 * - ai_stream：首包创建 AI 气泡（id=Date.now()），后续 delta 追加 → 增量渲染
 * - ai_done：用完整文本覆盖气泡（防流式丢字），流结束并自动 TTS 朗读
 * - ai_error：移除空白气泡 + toast 服务端原因
 * - user_message：房间内其他端发来的用户消息（多端同步）
 */
function handleWSMessage(payload: any) {
  const event = payload.event;
  const data = payload.data ?? payload;

  if (event === "joined") {
    // 加入成功
  } else if (event === "user_message") {
    // 同会话其他设备发送的用户消息：直接插入气泡（发送端本地已乐观渲染，不会重复）
    const content: string = data.content ?? "";
    if (content) {
      messages.value.push({ id: Date.now(), role: "user", content });
      scrollToBottom();
    }
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
    // 自动朗读：绑定消息 id 便于显示"停止"。playTts 内部已完整负责
    // "暂停 VAD → 合成 → 播放 → 播完/停止后恢复聆听"，**此处绝不能再调
    // resumeLiveAfterReply()**——它是同步执行而 playTts 在 await 合成处挂起，
    // 会导致：① 700ms 后提前恢复 VAD，TTS 外放被录进麦克风 → 幻听；
    // ② playingMsgId 被提前清空，停止按钮变回 🔊，播放中无法点停（2026-08-22 事故）。
    if (full) playTts(full, last?.id);
    else resumeLiveAfterReply(); // 没有内容可播：直接恢复聆听
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

  if (!sendWs({ event: "text", data: { conversation_id: conversationId.value, content: text } })) {
    isThinking.value = false;
    messages.value.push({
      id: Date.now() + 1,
      role: "assistant",
      content: "连接未建立，请确认已登录且后端已启动",
    });
  }
}

// ── 录音（MediaRecorder）──
const recording = ref(false);
const recognizing = ref(false);

let h5Recorder: MediaRecorder | null = null;
let h5Chunks: BlobPart[] = [];
let h5Stream: MediaStream | null = null;

/**
 * 一问一答模式的麦克风约束（与实时聆听保持一致）：
 * 显式开启回声消除/降噪/自动增益，单声道采集。
 * 用 { ideal } 而非 { exact }，部分设备不支持强制约束时自动降级，不报错。
 * noiseSuppression 对英文高频辅音有削弱风险，可改 false 做 A/B 对比
 * （见 useVoiceDetector.ts 顶部注释）。
 */
const QA_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: { ideal: true },
  noiseSuppression: { ideal: true },
  autoGainControl: { ideal: true },
  channelCount: { ideal: 1 },
};

/** 录音码率：opus 128kbps 保留英文高频辅音细节（与 useVoiceDetector 一致） */
const QA_RECORD_BITS_PER_SECOND = 128_000;

/** 录音 MIME 候选（与 useVoiceDetector 一致）：opus 优先，webm/mp4 兜底 */
const QA_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/** 挑第一个浏览器支持的录音编码；全不支持返回空串让浏览器自选 */
function pickQaMime(): string {
  for (const m of QA_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

/** QA 录音最长时间（毫秒）：超长会触发后端 base64 7MB 守卫报错，60s 自动停更友好 */
const QA_MAX_RECORD_MS = 60_000;
let recordMaxTimer: number | null = null;
/** 约束降级提示只弹一次（避免每段录音都打扰） */
let echoWarned = false;

/**
 * 开始录音：getUserMedia（带回声消除/降噪约束）→ MediaRecorder 采集；
 * 停止后组装 Blob 交给 doTranscribe。
 */
function startRecord() {
  if (recording.value || recognizing.value || isThinking.value) return;
  if (!getToken()) {
    showToast("请先登录");
    return;
  }
  // 防回声（2026-08-16）：用户按住说话 = 明确抢话意图，
  // 先暂停正在播放的 TTS，否则外放声音被录进录音 → 识别混乱
  if (audioEl && !audioEl.paused && !audioEl.ended) {
    audioEl.pause();
  }
  navigator.mediaDevices
    .getUserMedia({ audio: QA_AUDIO_CONSTRAINTS })
    .then((stream) => {
      h5Stream = stream;
      h5Chunks = [];

      // 约束生效自检（2026-08-17）：{ ideal } 是"尽力而为"，部分设备会静默降级——
      // 读实际值确认回声消除是否真生效，否则"以为有 AEC 其实没有"是回声盲区
      const track = stream.getAudioTracks()[0];
      const settings = track?.getSettings?.();
      if (settings && settings.echoCancellation === false && !echoWarned) {
        echoWarned = true;
        console.warn("[chat] echoCancellation 未生效（设备/浏览器降级），建议佩戴耳机");
        showToast("当前设备回声消除未生效，建议佩戴耳机");
      }
      if (settings && settings.noiseSuppression === false) {
        console.warn("[chat] noiseSuppression 未生效，环境噪声将进入识别");
      }

      const mime = pickQaMime();
      try {
        h5Recorder = new MediaRecorder(
          stream,
          mime
            ? { mimeType: mime, audioBitsPerSecond: QA_RECORD_BITS_PER_SECOND }
            : { audioBitsPerSecond: QA_RECORD_BITS_PER_SECOND },
        );
      } catch {
        h5Recorder = new MediaRecorder(stream); // 兜底自选编码
      }
      h5Recorder.ondataavailable = (e) => {
        if (e.data.size > 0) h5Chunks.push(e.data);
      };
      h5Recorder.onerror = (e) => {
        console.error("[chat] recorder error", e);
        showToast("录音异常，请重试");
      };
      h5Recorder.onstop = () => {
        if (recordMaxTimer !== null) {
          clearTimeout(recordMaxTimer);
          recordMaxTimer = null;
        }
        h5Stream?.getTracks().forEach((t) => t.stop());
        h5Stream = null;
        recording.value = false;
        const blob = new Blob(h5Chunks, { type: mime });
        h5Chunks = [];
        // 太短（< ~0.3s 音频）视为误触/噪音，直接丢弃，避免空识别
        if (blob.size < 8 * 1024) {
          showToast("录音太短，请再说一次");
          return;
        }
        if (blob.size > 0) doTranscribe({ file: blob, mimeType: mime });
      };
      h5Recorder.start();
      recording.value = true;
      // 60s 自动停止：防按住不放录到超长（base64 7MB 上限），到点提示并触发 onstop 转写
      recordMaxTimer = window.setTimeout(() => {
        if (h5Recorder && h5Recorder.state === "recording") {
          showToast("录音已达 60 秒上限");
          h5Recorder.stop();
        }
      }, QA_MAX_RECORD_MS);
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
    // 传入用户配置的识别语言（同 live 模式，见 handleLiveSegment）
    const res = await speechApi.transcribe(input, resolveAsrLang(recogLang.value));
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

/** 释义弹窗 → 加入生词本（幂等，重复添加自动复用；携带 LLM 已查到的释义/音标/例句） */
async function addWordToLibrary() {
  if (!wordInfo.value) return;
  try {
    await learningApi.add(wordInfo.value.word, {
      meaning: wordInfo.value.meaning,
      phonetic: wordInfo.value.phonetic,
      example: wordInfo.value.example,
    });
    showSuccessToast("已加入生词本");
    showWordModal.value = false;
  } catch (e) {
    showToast("加入失败");
  }
}

// ── TTS 播放 ──
// 过长的文本不自动播放：TTS 有字数/时长限制，播放会被截断且白白消耗额度
const MAX_AUTO_TTS_LEN = 300;
/** 用户设置的 AI 语速（settings.speed，0.5~1.5，默认 1；进入页面时拉取） */
const ttsSpeed = ref(1);
/**
 * 识别语言（settings.language，见 config/languages.ts）。
 * 默认 "auto"（2026-08-22 修复）：中英混说是中文母语学习者的常态，
 * 强制 language=en 会把中文"听译"成英文；后端已用 language_hints=["en","zh"]
 * （候选语种提示）兼顾"短英文词"与"中文"，比强制单语种更平衡。
 * 纯单语种场景可在「我的」页切 en/zh 强制提升。
 */
const recogLang = ref("auto");
/** TTS 结果内存缓存（key=voice:speed:text → Blob）：重听/点词重复朗读不再重复合成，省调用省额度 */
const ttsCache = new Map<string, Blob>();
const TTS_CACHE_MAX = 50;

/** 带缓存的 TTS 合成：命中直接返回，未命中合成后入缓存（Map 迭代序=插入序，超限淘汰最旧） */
async function cachedSynthesize(text: string, voice?: string): Promise<Blob> {
  const key = `${voice ?? ""}:${ttsSpeed.value}:${text}`;
  const hit = ttsCache.get(key);
  if (hit) return hit;
  const blob = await speechApi.synthesize(text, voice, ttsSpeed.value);
  if (ttsCache.size >= TTS_CACHE_MAX) {
    const oldest = ttsCache.keys().next().value;
    if (oldest !== undefined) ttsCache.delete(oldest);
  }
  ttsCache.set(key, blob);
  return blob;
}

/** 正在播放的消息 id（用于"播放/停止"按钮切换与高亮；null=未播放） */
const playingMsgId = ref<number | null>(null);

/**
 * TTS 是否正在播放（防幻听第三层守卫，2026-08-22）：
 * handleLiveSegment 切段转写前先查它——TTS 出声期间切出的段极可能是
 * 外放回声（尤其外放+近麦环境），一律丢弃，不进入转写/发送链路。
 * 与 isThinking 守卫的区别：isThinking 是"AI 回复中"（含流式阶段），
 * ttsPlaying 是"音频正在外放"（播放/合成完成的播放阶段）。
 * ⚠️ 不做"内容比对"：跟读（英语学习核心交互）与回声在文本上不可区分，
 * 都是"AI 说过的话"，比对会误杀跟读（2026-08-22 事故，已废弃）。
 */
const ttsPlaying = ref(false);

/**
 * TTS 播放令牌：解决"合成中停止失效"的竞态（2026-08-22）。
 * playTts 是异步的（await 合成），期间点停止/再点播放——
 * 若没有令牌，旧 playTts 在合成完成后仍会把音频播出来（"点了停还在播"）。
 * 令牌自增 = 作废所有更早的进行中播放；await 后检查令牌是否仍是最新。
 */
let ttsToken = 0;

/** 恢复聆听的 8s 兜底定时器（页面卸载/释放音频时清理） */
let ttsTailTimer: number | null = null;

function releaseAudio() {
  if (ttsTailTimer !== null) {
    clearTimeout(ttsTailTimer);
    ttsTailTimer = null;
  }
  if (audioUrl) {
    URL.revokeObjectURL(audioUrl);
    audioUrl = null;
  }
}

/**
 * 播放 TTS（自动朗读 / 手动点 🔊）。
 * 防回声/防幻听（2026-08-16 ~ 08-22 演进）：
 * - 早期：播放前暂停聆听、播完恢复（"要么听 AI 说，要么听你说"）
 * - 现在（barge-in）：**播放中 VAD 保持聆听**，用户一开口由 onSpeechStart →
 *   handleBargeIn 立即停 TTS（回声源消失，录音干净），后续切段正常进入对话。
 *   这同时是"防幻听"的主动式方案：任何 VAD 触发都会先停掉回声源。
 * msgId 可选：绑定"正在播放哪条消息"，用于切换 停止/播放 按钮。
 */
async function playTts(text: string, msgId?: number) {
  if (!text) return;
  if (text.length > MAX_AUTO_TTS_LEN) return;
  const token = ++ttsToken; // 本次播放令牌
  playingMsgId.value = msgId ?? null;
  try {
    const blob = await cachedSynthesize(text);
    if (token !== ttsToken) return; // 播放已被停止/被新播放覆盖：放弃本次
    releaseAudio();
    audioUrl = URL.createObjectURL(blob);
    if (!audioEl) audioEl = new Audio();
    audioEl.src = audioUrl;
    audioEl.volume = 0.7; // 轻微降低外放音量，减小回声能量（不影响听感）
    // 播放开始：置位"TTS 出声中"守卫 + 进入 barge-in 模式
    // （VAD 阈值×1.6 压住 AEC 残余回声防自打断；用户近麦说话仍可触发）
    ttsPlaying.value = true;
    audioEl.play().catch(() => {});
    if (mode.value === "live" && liveStarted.value) {
      // barge-in 关键：播放开始立即恢复聆听（AI 回复期间 pause 的 VAD 此刻解除）——
      // 否则 VAD 一直暂停，用户开口 onSpeechStart 永远不会触发，打断失效
      voiceDetector.setBargeIn(true);
      voiceDetector.resume();
    }
    // 播完/超时后收尾（见 resumeLiveAfterReply：进度优先，卡死检测兜底）
    resumeLiveAfterReply();
  } catch (e: any) {
    if (token !== ttsToken) return; // 旧播放的失败，忽略（已被停止/覆盖）
    console.error("[chat] tts error", e);
    showToast(e?.message || "语音朗读失败");
    playingMsgId.value = null;
    // 合成失败：没有 TTS 播放，恢复聆听
    resumeLiveAfterReply();
  }
}

/**
 * 停止播放（⏹ 按钮 / 离开页面）：
 * - ttsToken 自增：作废进行中的 playTts（合成完成后不会再播出来）
 * - 暂停 audio + 释放 URL（缓存保留：重播命中缓存，不重复合成 → 省 TTS 额度）
 * - 恢复聆听（若 live 模式因播放暂停了 VAD —— 防回声状态机闭环，否则停止后麦克风一直"失聪"）
 */
function stopTts() {
  ttsToken++; // 作废进行中的播放
  ttsPlaying.value = false; // 音频停止出声，解除"TTS 播放中"守卫
  if (mode.value === "live" && liveStarted.value) voiceDetector.setBargeIn(false); // 恢复正常灵敏度
  if (audioEl && !audioEl.paused) audioEl.pause();
  releaseAudio();
  playingMsgId.value = null;
  resumeLiveAfterReply();
}

/** 播放/停止切换：正在播这条 → 停止；否则播放这条 */
function togglePlay(msg: Message) {
  if (playingMsgId.value === msg.id) stopTts();
  else playTts(msg.content, msg.id);
}

/** 结束会话：停聆听 → 断开 WS（含取消重连/心跳）→ 调 end 接口记录 → 返回上一页 */
async function endChat() {
  stopLive();
  try {
    cleanupSocket();
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
  align-items: center; /* 气泡右侧操作按钮随气泡垂直居中 */
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

/* 播放/停止操作区：消息气泡右侧、垂直居中的小圆按钮（仅 AI 消息） */
.message-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0; /* 长文本时按钮不被压缩 */

  .action-btn {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--c-mint-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    cursor: pointer;
    transition: transform 0.15s ease, background 0.2s ease;

    &:active {
      transform: scale(0.92);
    }

    &.playing {
      background: var(--c-red-text); /* 播放中：红色圆钮（停止态），直观区分 */
      color: #fff;
    }
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
