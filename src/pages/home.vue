<template>
  <div class="home-page">
    <!-- 背景装饰 -->
    <div class="bg-blob blob-green"></div>
    <div class="bg-blob blob-mint"></div>

    <!-- 问候区 -->
    <header class="greet" ref="greetRef">
      <div class="greet-text">
        <div class="greet-title">早上好，{{ nickname }}</div>
        <div class="greet-sub">今天也要开口说英语哦</div>
      </div>
      <div class="avatar" @click="goProfile">
        <img :src="iconMascot" width="54" height="54" alt="mascot" />
      </div>
    </header>

    <!-- 今日复习卡片 -->
    <section class="review-card" ref="reviewRef">
      <div class="review-left">
        <span class="review-tag">每日复习</span>
        <div class="review-title">今日待复习</div>
        <div class="review-count">
          <span class="review-num">{{ todoWords }}</span>
          <span class="review-unit">个生词等待回顾</span>
        </div>
      </div>
      <div class="review-btn" @click="goReview">
        <img :src="iconPlay" width="28" height="28" alt="play" />
        <span>开始</span>
      </div>
    </section>

    <!-- 学习统计 -->
    <section class="stats" ref="statsRef">
      <div class="stat-card">
        <div class="stat-num">{{ streak }}</div>
        <div class="stat-label">连续练习(天)</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ masteredWords }}</div>
        <div class="stat-label">已掌握生词</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ minutes }}</div>
        <div class="stat-label">对话时长(分)</div>
      </div>
    </section>

    <!-- 继续练习（最近一次会话，可删除） -->
    <template v-if="lastConversation">
      <div class="section-head">
        <span class="section-title">继续练习</span>
        <span class="section-more" @click="goScenarios">全部场景 ></span>
      </div>
      <section class="continue-card" @click="goChat(lastScene)" ref="continueRef">
        <div class="scene-icon">
          <img :src="sceneIcon" width="36" height="36" alt="scene" />
        </div>
        <div class="continue-mid">
          <div class="continue-name">{{ lastConversation.scenario_name }}</div>
          <div class="continue-desc">
            {{ lastConversation.duration ? `上次练习 ${formatDuration(lastConversation.duration)}` : "上次练习未完，继续加油！" }} · {{ formatRelative(lastConversation.started_at) }}
          </div>
        </div>
        <div class="continue-right">
          <div class="continue-btn">继续</div>
          <button class="del-btn" @click.stop="deleteConversation">
            <img :src="iconTrash" width="15" height="15" alt="删除" />
          </button>
        </div>
      </section>
    </template>

    <!-- 今日生词 -->
    <div class="section-head">
      <span class="section-title">今日生词</span>
      <span class="section-more" @click="goLearning">查看全部 ></span>
    </div>
    <section class="word-item" v-for="(w, i) in todayWords" :key="w.en" @click="goReview" :ref="(el) => setWordRef(el, i)">
      <div class="word-body">
        <div class="word-en">{{ w.en }}</div>
        <div class="word-zh">{{ w.zh }}</div>
      </div>
      <span class="word-level" :class="`lv-${w.lv}`">{{ w.level }}</span>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onActivated } from "vue";
import { useRouter } from "vue-router";
import { showConfirmDialog, showSuccessToast, showToast } from "vant";
import gsap from "gsap";
import { learningApi, conversationApi } from "@/api";
import iconMascot from "@/assets/icons/mascot.svg";
import iconPlay from "@/assets/icons/play-cartoon.svg";
import iconCoffee from "@/assets/icons/icon-coffee.svg";
import iconPlane from "@/assets/icons/icon-plane.svg";
import iconInterview from "@/assets/icons/icon-interview.svg";
import iconRestaurant from "@/assets/icons/icon-restaurant.svg";
import iconHotel from "@/assets/icons/icon-hotel.svg";
import iconDefault from "@/assets/icons/icon-default.svg";
import iconTrash from "@/assets/icons/icon-trash.svg";

const router = useRouter();
const nickname = ref("Learner");
const streak = ref(7);
const masteredWords = ref(128);
const minutes = ref(45);
const todoWords = ref(12);

/** 今日学习计划（真实数据：待复习数 / 已掌握 / 今日新词 / 连续天数；接口失败保留默认展示值） */
const daily = ref<any>(null);

/** 拉取今日学习计划（每次切回首页都刷新，进度实时） */
async function loadDaily() {
  try {
    const d = await learningApi.daily();
    daily.value = d;
    todoWords.value = d.reviews_due ?? 0;
    masteredWords.value = d.mastered_total ?? 0;
    streak.value = d.streak_days ?? 0;
  } catch {
    /* 未登录 / 接口异常时保留默认值 */
  }
}

/** mastery → 熟练度等级数字（配合 lv-1 ~ lv-4 徽章配色） */
function masteryLevel(m: number) {
  if (m >= 80) return 4;
  if (m >= 60) return 3;
  if (m >= 35) return 2;
  return 1;
}

/** mastery → 等级文案 */
function masteryLabel(m: number) {
  if (m >= 80) return "L4 精通";
  if (m >= 60) return "L3 掌握";
  if (m >= 35) return "L2 熟悉";
  return "L1 生疏";
}

/** 今日生词列表（真实数据：今日已通过「每日新词」学习的单词） */
const todayWords = computed(() =>
  (daily.value?.today_words ?? []).map((w: any) => ({
    en: w.content,
    zh: w.meaning ?? "—",
    lv: masteryLevel(w.mastery),
    level: masteryLabel(w.mastery),
  })),
);

/** 最近一次会话（首页"继续练习"卡片数据；无会话时整块隐藏） */
const lastConversation = ref<any>(null);

/** 拉取会话列表取最近一条（倒序第一条，附带场景名） */
async function loadConversations() {
  try {
    const list = await conversationApi.list();
    lastConversation.value = list?.[0] ?? null;
  } catch {
    /* 未登录 / 接口异常时隐藏继续练习卡片 */
    lastConversation.value = null;
  }
}

/** 继续练习点击跳转参数（场景 id + 名称） */
const lastScene = computed(() => ({
  id: lastConversation.value?.scenario_id ?? 0,
  name: lastConversation.value?.scenario_name ?? "AI 对话",
}));

/** 最近会话的场景图标：按场景名匹配卡通图标（与场景库一致） */
const sceneIcon = computed(() => {
  const name = lastConversation.value?.scenario_name ?? "";
  if (name.includes("咖啡") || name.includes("café") || name.includes("Cafe")) return iconCoffee;
  if (name.includes("机场") || name.includes("flight") || name.includes("Flight") || name.includes("值机")) return iconPlane;
  if (name.includes("面试") || name.includes("interview") || name.includes("Interview")) return iconInterview;
  if (name.includes("餐厅") || name.includes("restaurant") || name.includes("Restaurant") || name.includes("订位")) return iconRestaurant;
  if (name.includes("酒店") || name.includes("hotel") || name.includes("Hotel")) return iconHotel;
  return iconDefault;
});

/** 时长（秒）→ 中文文案 */
function formatDuration(sec: number) {
  if (sec >= 60) return `${Math.floor(sec / 60)} 分钟`;
  return `${sec} 秒`;
}

/** 时间 → 相对文案（刚刚 / N 分钟前 / N 小时前 / N 天前 / 日期） */
function formatRelative(dateStr: string) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return d.toLocaleDateString();
}

/** 删除最近一次会话：确认后调接口，删完重新拉取（更早的会话顶上） */
async function deleteConversation() {
  if (!lastConversation.value) return;
  try {
    await showConfirmDialog({
      title: "删除对话",
      message: `确定删除「${lastConversation.value.scenario_name}」的这段对话记录吗？删除后不可恢复。`,
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    return; // 用户取消
  }
  try {
    await conversationApi.delete(lastConversation.value.id);
    showSuccessToast("已删除");
    loadConversations();
  } catch {
    showToast("删除失败");
  }
}

const greetRef = ref<HTMLElement | null>(null);
const reviewRef = ref<HTMLElement | null>(null);
const statsRef = ref<HTMLElement | null>(null);
const continueRef = ref<HTMLElement | null>(null);
const wordRefs: HTMLElement[] = [];

/** 收集今日生词 DOM 引用（配合 GSAP stagger 入场动画） */
function setWordRef(el: unknown, i: number) {
  if (el) wordRefs[i] = el as HTMLElement;
}

// GSAP 入场动效（每次激活都重放，保证切换 tabbar 回来动画保留）
function playIntro() {
  gsap.fromTo(greetRef.value, { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });
  gsap.fromTo(
    reviewRef.value,
    { opacity: 0, y: 24, scale: 0.96 },
    { opacity: 1, y: 0, scale: 1, duration: 0.6, delay: 0.12, ease: "back.out(1.6)" },
  );
  const statChildren = statsRef.value ? Array.from(statsRef.value.children) : [];
  if (statChildren.length) {
    gsap.fromTo(
      statChildren,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.45, delay: 0.3, stagger: 0.08, ease: "power2.out" },
    );
  }
  gsap.fromTo(
    continueRef.value,
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.5, delay: 0.5, ease: "power2.out" },
  );
  if (wordRefs.length) {
    gsap.fromTo(
      wordRefs,
      { opacity: 0, x: -14 },
      { opacity: 1, x: 0, duration: 0.45, delay: 0.65, stagger: 0.08, ease: "power2.out" },
    );
  }
}

onMounted(() => {
  const saved = localStorage.getItem("nickname");
  if (saved) nickname.value = saved;
  loadDaily();
  loadConversations();
});

// keep-alive 缓存下，每次切回该 tab 重新播放入场动画（首次挂载也会触发）
onActivated(() => {
  playIntro();
  loadDaily(); // 每次回到首页刷新今日进度
  loadConversations(); // 每次回到首页刷新最近会话（可能被删除或新增）
});

/** 导航：首页 → 场景库 */
function goScenarios() {
  router.push("/scenarios");
}

/** 导航：首页 → 我的（头像入口） */
function goProfile() {
  router.push("/profile");
}

/** 导航：首页 → 学习库（今日生词/查看全部） */
function goLearning() {
  router.push("/learning");
}

/** 导航：进入今日练习（复习 + 每日新词意思匹配） */
function goReview() {
  router.push("/review");
}

/** 导航：进入对话页。
 * "继续练习"卡片（最近会话）携带 conversationId → chat 页恢复该会话上下文继续对话；
 * 其他入口只传场景信息，chat 页会创建新会话。
 */
function goChat(scene: { id: number; name: string }) {
  const query: Record<string, string> = { scenarioId: String(scene.id), scenarioName: scene.name };
  if (lastConversation.value?.id) {
    query.conversationId = String(lastConversation.value.id);
  }
  router.push({ path: "/chat", query });
}
</script>

<style lang="scss" scoped>
.home-page {
  position: relative;
  min-height: 100vh;
  background: var(--c-mint-bg);
  /* 底部预留 TabBar（66px 胶囊 + 16px 间距 + 安全区） */
  padding: 8px 20px calc(110px + env(safe-area-inset-bottom));
  box-sizing: border-box;
  overflow-x: hidden;
}

/* 背景漂浮装饰 */
.bg-blob {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}

.blob-green {
  top: -60px;
  right: -70px;
  width: 240px;
  height: 240px;
  background: radial-gradient(circle at 30% 30%, rgba(13, 186, 156, 0.28), rgba(46, 214, 178, 0.06) 70%);
  filter: blur(30px);
}

.blob-mint {
  bottom: 40px;
  left: -90px;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle at 60% 40%, rgba(127, 224, 200, 0.35), rgba(127, 224, 200, 0.05) 70%);
  filter: blur(36px);
}

/* 问候区 */
.greet {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 0 20px;

  .greet-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--c-text);
  }

  .greet-sub {
    font-size: 13px;
    color: var(--c-text-sub);
    margin-top: 4px;
  }

  .avatar {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: var(--grad-brand);
    color: #fff;
    font-size: 20px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6px 16px rgba(13, 186, 156, 0.35);
    cursor: pointer;
  }
}

/* 今日复习卡片 */
.review-card {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 168px;
  padding: 0 22px;
  border-radius: var(--radius-lg);
  background: var(--grad-brand);
  box-shadow: var(--shadow-float);

  .review-tag {
    display: inline-flex;
    align-items: center;
    height: 26px;
    padding: 0 12px;
    border-radius: var(--radius-pill);
    background: rgba(255, 255, 255, 0.22);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
  }

  .review-title {
    font-size: 20px;
    font-weight: 700;
    color: #fff;
    margin-top: 10px;
  }

  .review-count {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-top: 2px;

    .review-num {
      font-size: 40px;
      font-weight: 700;
      color: #fff;
      line-height: 1;
    }

    .review-unit {
      font-size: 13px;
      color: #e6fff7;
    }
  }

  .review-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    width: 84px;
    height: 84px;
    border-radius: 50%;
    background: #fff;
    color: var(--c-primary);
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 8px 20px rgba(0, 60, 50, 0.28);
    transition: transform 0.15s ease;

    &:active {
      transform: scale(0.94);
    }
  }
}

/* 学习统计 */
.stats {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 10px;
  margin: 16px 0;

  .stat-card {
    flex: 1;
    background: var(--c-card);
    border-radius: 18px;
    padding: 14px 12px;
    box-shadow: var(--shadow-card);

    .stat-num {
      font-size: 22px;
      font-weight: 700;
      color: var(--c-text);
    }

    .stat-label {
      font-size: 11px;
      color: var(--c-text-sub);
      margin-top: 4px;
    }
  }
}

/* 继续练习卡片 */
.continue-card {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  background: var(--c-card);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: transform 0.15s ease;

  &:active {
    transform: scale(0.98);
  }

  .scene-icon {
    width: 60px;
    height: 60px;
    border-radius: 16px;
    background: var(--grad-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .continue-mid {
    flex: 1;
    min-width: 0;

    .continue-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--c-text);
    }

    .continue-desc {
      font-size: 11px;
      color: var(--c-text-sub);
      margin-top: 5px;
    }
  }

  .continue-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .continue-btn {
    height: 36px;
    padding: 0 18px;
    border-radius: 18px;
    background: var(--c-primary);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  /* 删除对话按钮：浅红底 + 红色描边，与语义色系统一致（白卡上清晰可辨） */
  .del-btn {
    width: 32px;
    height: 32px;
    border: 1px solid rgba(242, 149, 138, 0.5);
    border-radius: 10px;
    background: rgba(242, 149, 138, 0.14);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.15s ease, background 0.2s ease;

    &:active {
      transform: scale(0.9);
      background: rgba(242, 149, 138, 0.3);
    }
  }
}

/* 今日生词 */
.word-item {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
  padding: 0 14px;
  border-radius: var(--radius-sm);
  background: var(--c-card);
  box-shadow: var(--shadow-card);
  margin-bottom: 12px;
  cursor: pointer;
  transition: transform 0.15s ease;

  &:active {
    transform: scale(0.98);
  }

  .word-en {
    font-size: 15px;
    font-weight: 600;
    color: var(--c-text);
  }

  .word-zh {
    font-size: 11px;
    color: var(--c-text-sub);
    margin-top: 3px;
  }

  .word-level {
    display: inline-flex;
    align-items: center;
    height: 24px;
    padding: 0 10px;
    border-radius: var(--radius-pill);
    font-size: 11px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .lv-2 {
    background: rgba(245, 199, 64, 0.18);
    color: var(--c-gold-text);
  }

  .lv-1 {
    background: rgba(250, 158, 51, 0.18);
    color: var(--c-orange-text);
  }

  .lv-3 {
    background: rgba(13, 186, 156, 0.18);
    color: var(--c-primary-deep);
  }

  .lv-4 {
    background: rgba(10, 107, 92, 0.18);
    color: var(--c-primary-deep);
  }
}
</style>
