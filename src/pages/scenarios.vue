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
        @click="openSceneThreads(scene)"
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

    <!-- 对话线程弹层（Pi 式：一个场景 = 主题，下有多组对话，各自独立上下文） -->
    <van-popup v-model:show="showThreads" position="bottom" round :style="{ background: 'transparent' }" :close-on-click-overlay="true" @click-overlay="showThreads = false">
      <div class="thread-sheet">
        <div class="popup-handle"></div>
        <div class="thread-head">
          <span class="popup-title-icon">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 4.5C3 3.7 3.7 3 4.5 3H13.5C14.3 3 15 3.7 15 4.5V12C15 12.8 14.3 13.5 13.5 13.5H9L5.5 16V13.5H4.5C3.7 13.5 3 12.8 3 12V4.5Z" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="popup-title">{{ currentScene?.name ?? "对话" }} · 对话记录</span>
          <span class="thread-count" v-if="threads.length">{{ threads.length }} 组</span>
        </div>

        <!-- 加载中 -->
        <div class="thread-loading" v-if="threadsLoading">
          <span class="wd-loading-text">加载对话记录…</span>
        </div>

        <!-- 无线程：空状态引导新建 -->
        <div class="thread-empty" v-else-if="!threads.length">
          <div class="empty-text">还没有对话记录，开始第一组对话吧</div>
        </div>

        <!-- 线程列表：点条目继续该组对话（独立上下文）；垃圾桶删除整组 -->
        <div class="thread-list" v-else>
          <div v-for="t in threads" :key="t.id" class="thread-item" @click="continueThread(t)">
            <span class="thread-play">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4.5 3L10.5 7L4.5 11V3Z" fill="#0DBA9C"/>
              </svg>
            </span>
            <div class="thread-mid">
              <div class="thread-title">{{ t.title || "未命名对话" }}</div>
              <div class="thread-meta">{{ formatThreadTime(t.started_at) }} · {{ t.message_count ?? 0 }} 条消息</div>
            </div>
            <button class="thread-del" @click.stop="deleteThread(t)">
              <img :src="iconTrash" width="15" height="15" alt="删除" />
            </button>
          </div>
        </div>

        <div class="thread-actions">
          <button class="thread-btn-new" @click="newThread">＋ 新建对话</button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onActivated } from "vue";
import { useRouter } from "vue-router";
import { showToast, showSuccessToast, showConfirmDialog } from "vant";
import gsap from "gsap";
import { scenarioApi, conversationApi } from "@/api";
import iconCoffee from "@/assets/icons/icon-coffee.svg";
import iconPlane from "@/assets/icons/icon-plane.svg";
import iconInterview from "@/assets/icons/icon-interview.svg";
import iconRestaurant from "@/assets/icons/icon-restaurant.svg";
import iconHotel from "@/assets/icons/icon-hotel.svg";
import iconShopping from "@/assets/icons/icon-shopping.svg";
import iconChat from "@/assets/icons/icon-chat.svg";
import iconDefault from "@/assets/icons/icon-default.svg";
import iconTrash from "@/assets/icons/icon-trash.svg";

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
  if (name.includes("购物") || name.includes("shopping") || name.includes("Shopping") || name.includes("商店")) return iconShopping;
  if (name.includes("日常") || name.includes("聊天") || name.includes("Daily") || name.includes("daily") || name.includes("对话")) return iconChat;
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

// ── 对话线程管理（Pi 式：一个场景 = 一个对话主题，下有多组对话，各自独立上下文）──
const showThreads = ref(false);
const threadsLoading = ref(false);
const threads = ref<any[]>([]);
const currentScene = ref<Scenario | null>(null);

/** 点击场景卡 → 拉取该主题下的全部对话线程并弹出列表 */
async function openSceneThreads(scene: Scenario) {
  currentScene.value = scene;
  showThreads.value = true;
  threadsLoading.value = true;
  try {
    threads.value = await conversationApi.listByScenario(scene.id);
  } catch {
    threads.value = [];
  } finally {
    threadsLoading.value = false;
  }
}

/** 继续某组对话：带 conversationId 进聊天页 → 恢复该线程上下文 */
function continueThread(t: any) {
  showThreads.value = false;
  router.push({
    path: "/chat",
    query: {
      scenarioId: String(currentScene.value?.id ?? t.scenario_id),
      scenarioName: currentScene.value?.name ?? t.scenario_name,
      conversationId: String(t.id),
    },
  });
}

/** 新建对话：不带 conversationId → 聊天页创建新线程（全新上下文） */
function newThread() {
  showThreads.value = false;
  router.push({
    path: "/chat",
    query: { scenarioId: String(currentScene.value?.id ?? 0), scenarioName: currentScene.value?.name ?? "AI 对话" },
  });
}

/** 删除一组对话（整组删除：会话及其全部消息上下文，后端 DB 级联）；删完刷新列表 */
async function deleteThread(t: any) {
  try {
    await showConfirmDialog({
      title: "删除对话",
      message: `确定删除「${t.title || "未命名对话"}」这组对话吗？将清空该组全部对话记录（上下文），删除后不可恢复。`,
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    return; // 用户取消
  }
  try {
    await conversationApi.delete(t.id);
    showSuccessToast("已删除");
    threads.value = threads.value.filter((x) => x.id !== t.id); // 局部移除，免重新拉取
  } catch {
    showToast("删除失败");
  }
}

/** 时间 → 相对文案（刚刚 / N 分钟前 / N 小时前 / 日期） */
function formatThreadTime(dateStr: string) {
  if (!dateStr) return "";
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

/* 对话线程弹层（Pi 式多组对话管理） */
.thread-sheet {
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

  .thread-head {
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
      flex: 1;
    }

    .thread-count {
      font-size: 12px;
      color: var(--c-text-sub);
      background: var(--c-mint-bg);
      border-radius: 999px;
      padding: 3px 10px;
    }
  }

  .thread-loading {
    padding: 40px 0;
    text-align: center;
    font-size: 13px;
    color: var(--c-text-sub);
  }

  .thread-empty {
    padding: 40px 0;
    text-align: center;
    font-size: 13px;
    color: var(--c-text-sub);
  }

  .thread-list {
    max-height: 46vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .thread-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 14px;
    background: var(--c-mint-bg);
    cursor: pointer;
    transition: transform 0.15s ease;

    &:active {
      transform: scale(0.98);
    }

    .thread-play {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(13, 186, 156, 0.2);
    }

    .thread-mid {
      flex: 1;
      min-width: 0;

      .thread-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--c-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .thread-meta {
        font-size: 12px;
        color: var(--c-text-sub);
        margin-top: 2px;
      }
    }

    .thread-del {
      width: 30px;
      height: 30px;
      border: none;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      opacity: 0.55;
      flex-shrink: 0;
    }
  }

  .thread-actions {
    margin-top: 14px;

    .thread-btn-new {
      width: 100%;
      height: 48px;
      border: none;
      border-radius: var(--radius-pill);
      background: var(--grad-brand);
      color: #fff;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 6px 16px rgba(13, 186, 156, 0.3);
      transition: transform 0.15s ease;

      &:active {
        transform: scale(0.97);
      }
    }
  }
}
</style>
