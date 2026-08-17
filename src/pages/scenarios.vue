<template>
  <div class="scenarios-page">
    <div class="bg-blob"></div>

    <!-- 顶部栏 -->
    <header class="page-header">
      <span class="page-title">选择场景</span>
      <div class="icon-btn">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="8" r="5" stroke="#0DBA9C" stroke-width="2"/>
          <path d="M12 12L15.5 15.5" stroke="#0DBA9C" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
    </header>

    <!-- 副标题 -->
    <div class="sub-head">
      <span class="sub-text">与 AI 实时对话，挑战真实场景</span>
      <span class="sub-sort">智能推荐 ></span>
    </div>

    <!-- 分类标签 -->
    <div class="chip-row">
      <button
        v-for="cat in categories"
        :key="cat.key"
        class="chip"
        :class="{ 'chip-active': activeCategory === cat.key }"
        @click="switchCategory(cat.key)"
      >
        {{ cat.label }}
      </button>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="loading-wrap">
      <van-loading size="24" color="#0DBA9C" vertical>加载中...</van-loading>
    </div>

    <!-- 场景列表 -->
    <div v-else class="scene-list">
      <div
        v-for="(scene, i) in filteredScenes"
        :key="scene.id"
        class="scene-card"
        :ref="(el) => setSceneRef(el, i)"
        @click="goChat(scene)"
      >
        <div class="scene-icon" :class="`grad-${(i % 4) + 1}`">
          <img :src="sceneIcon(scene)" width="40" height="40" :alt="scene.name" />
        </div>
        <div class="scene-mid">
          <div class="scene-name">{{ scene.name }}</div>
          <div class="scene-meta">
            <span class="diff-badge" :class="diffClass(scene.difficulty)">{{ diffLabel(scene.difficulty) }}</span>
            <span class="scene-rounds">对话 {{ scene.rounds || 12 }} 轮</span>
          </div>
        </div>
        <div class="scene-play">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5.5 4L11.5 8L5.5 12V4Z" fill="#FFFFFF"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && filteredScenes.length === 0" class="empty">
      <div class="empty-text">暂未找到场景</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onActivated } from "vue";
import { useRouter } from "vue-router";
import gsap from "gsap";
import { scenarioApi } from "@/api";
import iconCoffee from "@/assets/icons/icon-coffee.svg";
import iconPlane from "@/assets/icons/icon-plane.svg";
import iconInterview from "@/assets/icons/icon-interview.svg";
import iconRestaurant from "@/assets/icons/icon-restaurant.svg";
import iconHotel from "@/assets/icons/icon-hotel.svg";
import iconDefault from "@/assets/icons/icon-default.svg";

interface Scenario {
  id: number;
  name: string;
  category: string;
  description: string | null;
  difficulty: number;
  icon: string | null;
  rounds?: number;
}

const router = useRouter();

const categories = [
  { key: "all", label: "全部" },
  { key: "life", label: "日常生活" },
  { key: "work", label: "职场" },
  { key: "travel", label: "旅行" },
];

const activeCategory = ref("all");
const scenarios = ref<Scenario[]>([]);
const loading = ref(true);
const sceneRefs: HTMLElement[] = [];

/** 分类过滤：all 直接返回全部，否则按 category 精确匹配 */
const filteredScenes = computed(() => {
  if (activeCategory.value === "all") return scenarios.value;
  return scenarios.value.filter((s) => s.category === activeCategory.value);
});

/** 难度数值 → 中文标签（1入门 ~ 5高级） */
const diffLabel = (d: number) => {
  const map: Record<number, string> = { 1: "入门", 2: "初级", 3: "中级", 4: "进阶", 5: "高级" };
  return map[d] || "初级";
};

/** 难度 → 徽章配色类（低/中/高三档） */
const diffClass = (d: number) => {
  if (d >= 4) return "diff-high";
  if (d === 3) return "diff-mid";
  return "diff-low";
};

// 场景图标：返回独立 SVG 文件 URL（卡通版，白底粗描边 + 可爱表情）
const sceneIcon = (scene: Scenario): string => {
  const name = scene.name;
  if (name.includes("咖啡") || name.includes("café") || name.includes("Cafe")) return iconCoffee;
  if (name.includes("机场") || name.includes("flight") || name.includes("Flight") || name.includes("值机")) return iconPlane;
  if (name.includes("面试") || name.includes("interview") || name.includes("Interview")) return iconInterview;
  if (name.includes("餐厅") || name.includes("restaurant") || name.includes("Restaurant") || name.includes("订位")) return iconRestaurant;
  if (name.includes("酒店") || name.includes("hotel") || name.includes("Hotel")) return iconHotel;
  return iconDefault;
};

/** 收集场景卡 DOM 引用（配合 GSAP stagger 入场动画） */
function setSceneRef(el: unknown, i: number) {
  if (el) sceneRefs[i] = el as HTMLElement;
}

/** 切换分类（chip 点击） */
function switchCategory(key: string) {
  activeCategory.value = key;
}

// GSAP：场景卡依次浮现（每次激活重放）
function playIntro() {
  if (sceneRefs.length) {
    gsap.fromTo(
      sceneRefs,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.07, ease: "power2.out" },
    );
  }
}

onMounted(async () => {
  try {
    const data = await scenarioApi.list();
    scenarios.value = data || [];
  } catch (e) {
    console.error("Failed to load scenarios:", e);
  } finally {
    loading.value = false;
  }

  playIntro();
});

// keep-alive 缓存下，每次切回该 tab 重新播放入场动画
onActivated(() => {
  playIntro();
});

/** 点击场景卡 → 进入对话页（场景名通过 query 传给聊天页头部） */
const goChat = (scene: Scenario) => {
  router.push({ path: "/chat", query: { scenarioId: scene.id, scenarioName: scene.name } });
};
</script>

<style lang="scss" scoped>
.scenarios-page {
  position: relative;
  min-height: 100vh;
  background: var(--c-mint-bg);
  /* 底部预留 TabBar（66px 胶囊 + 16px 间距 + 安全区） */
  padding: 8px 20px calc(110px + env(safe-area-inset-bottom));
  box-sizing: border-box;
  overflow-x: hidden;
}

.bg-blob {
  position: absolute;
  top: -50px;
  right: -80px;
  width: 250px;
  height: 250px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(13, 186, 156, 0.22), rgba(46, 214, 178, 0.05) 70%);
  filter: blur(30px);
  pointer-events: none;
}

.sub-head {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0 14px;

  .sub-text {
    font-size: 13px;
    color: var(--c-text-sub);
  }

  .sub-sort {
    font-size: 12px;
    color: var(--c-primary);
    font-weight: 500;
  }
}

.chip-row {
  position: relative;
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
  overflow-x: auto;
  padding-bottom: 2px;

  &::-webkit-scrollbar {
    display: none;
  }
}

.loading-wrap {
  padding: 80px 0;
  display: flex;
  justify-content: center;
}

.scene-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.scene-card {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 110px;
  padding: 16px;
  border-radius: var(--radius-md);
  background: var(--c-card);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: transform 0.15s ease;
  box-sizing: border-box;

  &:active {
    transform: scale(0.98);
  }

  .scene-icon {
    width: 70px;
    height: 70px;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .grad-1 {
    background: linear-gradient(135deg, #0dba9c, #29d1ad);
  }

  .grad-2 {
    background: linear-gradient(135deg, #2a96d9, #55b8ea);
  }

  .grad-3 {
    background: linear-gradient(135deg, #8a6ae0, #b096ef);
  }

  .grad-4 {
    background: linear-gradient(135deg, #f2926a, #f8bf92);
  }

  .scene-mid {
    flex: 1;
    min-width: 0;

    .scene-name {
      font-size: 16px;
      font-weight: 700;
      color: var(--c-text);
    }

    .scene-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 7px;

      .diff-badge {
        display: inline-flex;
        align-items: center;
        height: 20px;
        padding: 0 8px;
        border-radius: var(--radius-pill);
        font-size: 10px;
        font-weight: 600;
      }

      .diff-low {
        background: rgba(127, 224, 200, 0.4);
        color: var(--c-primary-deep);
      }

      .diff-mid {
        background: rgba(245, 199, 64, 0.25);
        color: var(--c-gold-text);
      }

      .diff-high {
        background: rgba(242, 149, 138, 0.25);
        color: var(--c-red-text);
      }

      .scene-rounds {
        font-size: 11px;
        color: var(--c-text-sub);
      }
    }
  }

  .scene-play {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--c-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(13, 186, 156, 0.3);
  }
}

.empty {
  padding: 100px 0;
  text-align: center;
  font-size: 14px;
  color: var(--c-text-sub);
}
</style>
