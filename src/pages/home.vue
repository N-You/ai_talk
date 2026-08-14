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
      <div class="review-btn" @click="goLearning">
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

    <!-- 继续练习 -->
    <div class="section-head">
      <span class="section-title">继续练习</span>
      <span class="section-more" @click="goScenarios">全部场景 ></span>
    </div>
    <section class="continue-card" @click="goChat(featuredScenes[0])" ref="continueRef">
      <div class="scene-icon">
        <img :src="iconCoffee" width="36" height="36" alt="coffee" />
      </div>
      <div class="continue-mid">
        <div class="continue-name">咖啡店点单 · 初级</div>
        <div class="continue-desc">上次对话 12/14，再接再厉！</div>
      </div>
      <div class="continue-btn">继续</div>
    </section>

    <!-- 今日生词 -->
    <div class="section-head">
      <span class="section-title">今日生词</span>
      <span class="section-more" @click="goLearning">查看全部 ></span>
    </div>
    <section class="word-item" v-for="(w, i) in todayWords" :key="w.en" @click="goLearning" :ref="(el) => setWordRef(el, i)">
      <div class="word-body">
        <div class="word-en">{{ w.en }}</div>
        <div class="word-zh">{{ w.zh }}</div>
      </div>
      <span class="word-level" :class="`lv-${w.lv}`">{{ w.level }}</span>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onActivated } from "vue";
import { useRouter } from "vue-router";
import gsap from "gsap";
import { getToken } from "@/api";
import iconMascot from "@/assets/icons/mascot.svg";
import iconPlay from "@/assets/icons/play-cartoon.svg";
import iconCoffee from "@/assets/icons/icon-coffee.svg";

const router = useRouter();
const nickname = ref("Learner");
const streak = ref(7);
const masteredWords = ref(128);
const minutes = ref(45);
const todoWords = ref(12);

const featuredScenes = ref([
  { id: 1, name: "咖啡店点单" },
  { id: 4, name: "机场值机" },
  { id: 7, name: "求职面试" },
  { id: 11, name: "餐厅订位" },
]);

const todayWords = ref([
  { en: "espresso", zh: "n. 浓缩咖啡", lv: 2, level: "Lv.2 熟悉" },
  { en: "baggage", zh: "n. 行李", lv: 1, level: "Lv.1 生疏" },
]);

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
});

// keep-alive 缓存下，每次切回该 tab 重新播放入场动画（首次挂载也会触发）
onActivated(() => {
  playIntro();
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

/** 导航：进入对话页，场景信息通过 query 传递（聊天页头部直接展示场景名） */
function goChat(scene: any) {
  router.push({ path: "/chat", query: { scenarioId: scene.id, scenarioName: scene.name } });
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
}
</style>
