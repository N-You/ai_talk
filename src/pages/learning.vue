<template>
  <div class="learning-page">
    <div class="bg-blob"></div>

    <!-- 顶部栏 -->
    <header class="page-header">
      <span class="page-title">我的生词本</span>
      <div class="icon-btn">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 4.5H15L10.5 10V14L7.5 15V10L3 4.5Z" stroke="#0DBA9C" stroke-width="2" stroke-linejoin="round"/>
        </svg>
      </div>
    </header>

    <!-- 统计概览 -->
    <section class="stat-banner" ref="statRef">
      <div class="stat-left">
        <div class="stat-label">累计生词</div>
        <div class="stat-num-row">
          <span class="stat-num">{{ total }}</span>
          <span class="stat-unit">个</span>
        </div>
        <div class="stat-week">本周新增 12 个</div>
      </div>
      <div class="stat-right">
        <div class="mastery-num">{{ masteryPercent }}%</div>
        <div class="mastery-label">整体熟练度</div>
        <div class="mastery-track">
          <span class="mastery-fill" :style="{ width: masteryPercent + '%' }"></span>
        </div>
      </div>
    </section>

    <!-- 今日学习入口（复习 + 每日新词，进度实时） -->
    <section class="today-card" @click="goReview">
      <div class="today-left">
        <span class="today-tag">今日学习</span>
        <div class="today-row">
          <span class="today-num">{{ daily?.new_done ?? 0 }}/{{ daily?.goal ?? 5 }}</span>
          <span class="today-label">新词</span>
          <span class="today-sep">·</span>
          <span class="today-num">{{ daily?.reviews_due ?? 0 }}</span>
          <span class="today-label">待复习</span>
        </div>
      </div>
      <div class="today-go">
        <span>去练习</span>
        <img :src="iconArrowRight" width="14" height="14" alt="go" />
      </div>
    </section>

    <!-- 熟练度等级说明 -->
    <section class="level-bar">
      <div v-for="lv in levels" :key="lv.key" class="level-item" :class="`lv-${lv.key}`">
        <span class="level-code">{{ lv.code }}</span>
        <span class="level-name">{{ lv.name }}</span>
      </div>
    </section>

    <!-- 搜索栏 -->
    <div class="search-wrap">
      <van-search
        v-model="searchText"
        placeholder="搜索单词或表达..."
        shape="round"
        background="transparent"
        @update:model-value="onSearch"
      />
    </div>

    <!-- 状态 Tabs（自定义胶囊） -->
    <div class="chip-row">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="chip"
        :class="{ 'chip-active': activeTab === t.key }"
        @click="onTabChange(t.key)"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="loading-wrap">
      <van-loading size="24" color="#0DBA9C" vertical>加载中...</van-loading>
    </div>

    <!-- 学习列表 -->
    <div v-else class="item-list">
      <div
        v-for="(item, i) in items"
        :key="item.id"
        class="word-card"
        :ref="(el) => setItemRef(el, i)"
        @click="showReview(item)"
      >
        <div class="item-top">
          <div class="item-left">
            <div class="item-content">{{ item.content }}</div>
            <div class="item-phonetic-row">
              <span class="item-phonetic" v-if="item.phonetic">{{ item.phonetic }}</span>
              <span class="item-meaning" v-if="item.meaning">{{ item.meaning }}</span>
            </div>
          </div>
          <span class="item-level" :class="levelClass(item.mastery)">
            <span class="lv-icon"><img :src="lvIcon(item.mastery)" width="16" height="16" alt="level" /></span>
            {{ levelLabel(item.mastery) }}
          </span>
        </div>
        <div class="mastery-track">
          <span class="mastery-fill" :style="{ width: Math.round(item.mastery) + '%', background: masteryColor(item.mastery) }"></span>
        </div>
        <div class="item-footer">
          <span class="review-label" v-if="item.next_review_at">{{ formatReviewTime(item.next_review_at) }}</span>
          <span class="review-label" v-else>新收录</span>
          <div class="sound-btn">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 5.5H5L8 3V11L5 8.5H3V5.5Z" stroke="#0DBA9C" stroke-width="1.5" stroke-linejoin="round"/>
              <path d="M10 4.5C11 5.2 11 8.8 10 9.5" stroke="#0DBA9C" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- 加载更多 -->
      <div class="load-more" v-if="hasMore" @click="loadMore">加载更多</div>
      <div class="load-end" v-else-if="items.length > 0">— 已全部加载 —</div>

      <!-- 空状态 -->
      <div class="empty" v-if="items.length === 0">
        <div class="empty-icon">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 7H32C34.2 7 36 8.8 36 11V35C36 35.6 35.6 36 35 36H10C8.3 36 7 34.7 7 33V7Z" stroke="#0DBA9C" stroke-width="2.4" stroke-linejoin="round"/>
            <path d="M13 16H29M13 22H29" stroke="#0DBA9C" stroke-width="2.4" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="empty-text">还没有学习内容</div>
        <div class="empty-sub">在对话中点击「记录表达」，或点击下方添加</div>
      </div>
    </div>

    <!-- 添加按钮 -->
    <div class="add-area">
      <div class="add-bar" @click="showAddPopup">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 4V16M4 10H16" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round"/>
        </svg>
        <span class="add-text">添加单词或短语</span>
      </div>
    </div>

    <!-- 添加弹窗（同步设计稿风格） -->
    <van-popup v-model:show="showAdd" position="bottom" round :style="{ background: 'transparent' }" :close-on-click-overlay="true" @click-overlay="showAdd = false">
      <div class="add-popup">
        <div class="popup-handle"></div>
        <div class="popup-head">
          <span class="popup-title-icon">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 3V15M3 8H13" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="popup-title">添加学习内容</span>
        </div>
        <div class="popup-sub">输入单词或短语，AI 自动补充释义与音标</div>
        <div class="popup-input-wrap">
          <input
            v-model="newContent"
            class="popup-input"
            placeholder="如 reservation / 预订座位"
            maxlength="60"
            @keyup.enter="addItem"
          />
          <span class="popup-input-count">{{ newContent.length }}/60</span>
        </div>
        <div class="popup-actions">
          <button class="popup-btn popup-btn-cancel" @click="showAdd = false">取消</button>
          <button class="popup-btn popup-btn-confirm" :class="{ disabled: !newContent.trim() }" @click="addItem">
            AI 自动补充
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 7H11M11 7L8 4M11 7L8 10" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </van-popup>

    <!-- 复习弹窗（同步设计稿风格） -->
    <van-popup v-model:show="showReviewPopup" position="bottom" round :style="{ background: 'transparent' }" :close-on-click-overlay="true" @click-overlay="showReviewPopup = false">
      <div class="review-popup">
        <div class="popup-handle"></div>
        <div class="popup-head">
          <span class="popup-title-icon popup-title-icon-gold">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 1.5L11 6.5L16 7L12.3 10.3L13.5 15.5L9 12.8L4.5 15.5L5.7 10.3L2 7L7 6.5L9 1.5Z" fill="#FFFFFF"/>
            </svg>
          </span>
          <span class="popup-title">复习：{{ currentItem?.content }}</span>
        </div>
        <div class="popup-meaning" v-if="currentItem?.meaning">{{ currentItem.meaning }}</div>
        <div class="popup-sub">还记得这个单词吗？根据熟悉度选择</div>
        <div class="review-grid">
          <button v-for="opt in reviewOptions" :key="opt.key" class="review-opt" :class="`opt-${opt.key}`" @click="submitReview(opt.key)">
            <span class="opt-label">{{ opt.label }}</span>
            <span class="opt-arrow">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 6H9M9 6L6.5 3.5M9 6L6.5 8.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onActivated } from "vue";
import { useRouter } from "vue-router";
import { showToast, showSuccessToast } from "vant";
import gsap from "gsap";
import { learningApi } from "@/api";
import level1Icon from "@/assets/icons/level-1.svg";
import level2Icon from "@/assets/icons/level-2.svg";
import level3Icon from "@/assets/icons/level-3.svg";
import level4Icon from "@/assets/icons/level-4.svg";
import iconArrowRight from "@/assets/icons/icon-arrow-right.svg";

const router = useRouter();

/** 今日学习计划（新词进度 / 待复习数，接口失败时显示默认值） */
const daily = ref<any>(null);

/** 拉取今日学习计划（切回本页时刷新进度） */
async function loadDaily() {
  try {
    daily.value = await learningApi.daily();
  } catch {
    /* 未登录 / 接口异常时忽略，横幅显示默认值 */
  }
}

/** 导航：进入今日练习页（复习 + 每日新词意思匹配） */
function goReview() {
  router.push("/review");
}

interface LearningItem {
  id: number;
  content: string;
  type: string;
  meaning: string | null;
  phonetic: string | null;
  mastery: number;
  next_review_at: string | null;
}

const tabs = [
  { key: "all", label: "全部" },
  { key: "review", label: "待复习" },
  { key: "mastered", label: "已掌握" },
];

// L1-L4 熟练度机制
const levels = [
  { key: 1, code: "L1", name: "生疏" },
  { key: 2, code: "L2", name: "熟悉" },
  { key: 3, code: "L3", name: "掌握" },
  { key: 4, code: "L4", name: "精通" },
];

const reviewOptions = [
  { key: "again", label: "忘记", type: "danger" },
  { key: "hard", label: "模糊", type: "warning" },
  { key: "good", label: "认识", type: "success" },
  { key: "easy", label: "熟练", type: "primary" },
] as const;

const searchText = ref("");
const activeTab = ref("all");
const items = ref<LearningItem[]>([]);
const loading = ref(true);
const page = ref(1);
const hasMore = ref(false);
const total = ref(128);
const searchTimer = ref<number | null>(null);

const showAdd = ref(false);
const newContent = ref("");

const showReviewPopup = ref(false);
const currentItem = ref<LearningItem | null>(null);

const itemRefs: HTMLElement[] = [];

// 熟练度百分比（模拟：无数据时取 68，有数据时按列表均值）
const masteryPercent = computed(() => {
  if (items.value.length) {
    const avg = items.value.reduce((s, it) => s + (it.mastery || 0), 0) / items.value.length;
    return Math.round(avg);
  }
  return 68;
});

/** mastery → 熟练度等级文案（L1 生疏 ~ L4 精通） */
const levelLabel = (m: number) => {
  if (m >= 80) return "L4 精通";
  if (m >= 60) return "L3 掌握";
  if (m >= 35) return "L2 熟悉";
  return "L1 生疏";
};

/** mastery → 等级徽章配色类（level-1 ~ level-4） */
const levelClass = (m: number) => {
  if (m >= 80) return "level-4";
  if (m >= 60) return "level-3";
  if (m >= 35) return "level-2";
  return "level-1";
};

/** mastery → 进度条颜色（绿/薄荷/金黄/橙，与熟练度等级对应） */
const masteryColor = (m: number) => {
  if (m >= 80) return "#0A6B5C";
  if (m >= 60) return "#0DBA9C";
  if (m >= 35) return "#F5C740";
  return "#FA9E33";
};

/** mastery → 等级图标 SVG（星级/钻石/三角/倒三角，随熟练度变化） */
const lvIcon = (m: number): string => {
  // 卡通版等级图标：独立 SVG 文件
  if (m >= 80) return level4Icon;
  if (m >= 60) return level3Icon;
  if (m >= 35) return level2Icon;
  return level1Icon;
};

/** 收集学习卡 DOM 引用（配合 GSAP stagger 入场动画） */
function setItemRef(el: unknown, i: number) {
  if (el) itemRefs[i] = el as HTMLElement;
}

onMounted(() => {
  fetchItems();
  loadDaily();
});

// GSAP：卡片依次浮现（每次激活重放）
function playIntro() {
  if (itemRefs.length) {
    gsap.fromTo(
      itemRefs,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, ease: "power2.out" },
    );
  }
}

// keep-alive 缓存下，每次切回该 tab 重新播放入场动画
onActivated(() => {
  playIntro();
  loadDaily(); // 回到本页刷新今日学习进度
});

// 搜索防抖
function onSearch() {
  if (searchTimer.value) clearTimeout(searchTimer.value);
  searchTimer.value = window.setTimeout(() => {
    page.value = 1;
    items.value = [];
    fetchItems();
  }, 400);
}

/** 切换状态 tab：重置分页并重新拉取 */
function onTabChange(key: string) {
  activeTab.value = key;
  page.value = 1;
  items.value = [];
  fetchItems();
}

/**
 * 分页拉取学习列表：page=1 覆盖 / 否则 concat 追加；
 * 由 total 计算 hasMore 控制"加载更多"；加载完成后重放入场动画。
 */
async function fetchItems() {
  loading.value = true;
  try {
    const params: any = { page: page.value, size: 20 };
    if (activeTab.value !== "all") params.status = activeTab.value;
    if (searchText.value.trim()) params.search = searchText.value.trim();

    const res = await learningApi.list(params);
    items.value = page.value === 1 ? res.items || [] : items.value.concat(res.items || []);
    total.value = res.total ?? total.value;
    hasMore.value = items.value.length < total.value;
  } catch (e) {
    console.error("Failed to load items:", e);
  } finally {
    loading.value = false;
  }

  playIntro();
}

/** 加载更多：页码 +1 后追加拉取 */
function loadMore() {
  page.value++;
  fetchItems();
}

/** 点击学习卡 → 打开复习弹窗 */
function showReview(item: LearningItem) {
  currentItem.value = item;
  showReviewPopup.value = true;
}

/** 提交复习结果：用返回的 mastery/next_review_at 局部更新列表项（无需整页刷新） */
async function submitReview(result: string) {
  if (!currentItem.value) return;
  try {
    const updated = await learningApi.review(currentItem.value.id, result);
    const idx = items.value.findIndex((i) => i.id === currentItem.value!.id);
    if (idx > -1) {
      items.value[idx] = { ...items.value[idx], mastery: updated.mastery, next_review_at: updated.next_review_at };
    }
    showReviewPopup.value = false;
    showSuccessToast("已记录");
  } catch (e) {
    showToast("操作失败");
  }
}

/** 打开添加弹窗（清空输入） */
function showAddPopup() {
  newContent.value = "";
  showAdd.value = true;
}

/** 添加学习内容：入库后回到第一页刷新列表（AI 补充释义为异步，先提示） */
async function addItem() {
  const content = newContent.value.trim();
  if (!content) return;
  try {
    await learningApi.add(content);
    showAdd.value = false;
    showToast("已添加，AI 补充中...");
    page.value = 1;
    items.value = [];
    fetchItems();
  } catch (e) {
    showToast("添加失败");
  }
}

/** next_review_at → 相对时间文案（现在/N分钟后/今天/明天） */
function formatReviewTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return "现在复习";
  if (diff < 3600000) return `${Math.ceil(diff / 60000)}分钟后`;
  if (diff < 86400000) return "今天复习";
  return "明天复习";
}
</script>

<style lang="scss" scoped>
.learning-page {
  position: relative;
  min-height: 100vh;
  background: var(--c-mint-bg);
  /* 底部预留 TabBar（66px 胶囊 + 16px 间距 + 安全区） + 悬浮添加按钮 */
  padding: 8px 20px calc(170px + env(safe-area-inset-bottom));
  box-sizing: border-box;
  overflow-x: hidden;
}

.bg-blob {
  position: absolute;
  bottom: -60px;
  right: -80px;
  width: 240px;
  height: 240px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(13, 186, 156, 0.18), rgba(46, 214, 178, 0.04) 70%);
  filter: blur(34px);
  pointer-events: none;
}

/* 统计概览 */
.stat-banner {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 120px;
  padding: 0 22px;
  border-radius: var(--radius-md);
  background: var(--grad-brand);
  box-shadow: var(--shadow-float);
  margin-top: 6px;

  .stat-label {
    font-size: 11px;
    color: #e6fff7;
  }

  .stat-num-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-top: 4px;

    .stat-num {
      font-size: 32px;
      font-weight: 700;
      color: #fff;
    }

    .stat-unit {
      font-size: 13px;
      color: #e6fff7;
    }
  }

  .stat-week {
    font-size: 11px;
    color: #e6fff7;
    margin-top: 4px;
  }

  .stat-right {
    width: 130px;

    .mastery-num {
      font-size: 20px;
      font-weight: 700;
      color: #fff;
    }

    .mastery-label {
      font-size: 10px;
      color: #e6fff7;
      margin-top: 2px;
    }

    .mastery-track {
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.3);
      margin-top: 8px;
      overflow: hidden;

      .mastery-fill {
        display: block;
        height: 100%;
        border-radius: 3px;
        background: #fff;
      }
    }
  }
}

/* 今日学习入口横幅 */
.today-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 78px;
  padding: 0 18px;
  border-radius: var(--radius-md);
  background: var(--grad-brand);
  box-shadow: var(--shadow-float);
  margin: 14px 0 10px;
  cursor: pointer;
  transition: transform 0.15s ease;

  &:active {
    transform: scale(0.98);
  }

  .today-left {
    .today-tag {
      display: inline-flex;
      align-items: center;
      height: 22px;
      padding: 0 10px;
      border-radius: var(--radius-pill);
      background: rgba(255, 255, 255, 0.22);
      color: #fff;
      font-size: 10px;
      font-weight: 600;
    }

    .today-row {
      display: flex;
      align-items: baseline;
      gap: 6px;
      margin-top: 7px;

      .today-num {
        font-size: 20px;
        font-weight: 700;
        color: #fff;
        line-height: 1;
      }

      .today-label {
        font-size: 11px;
        color: #e6fff7;
      }

      .today-sep {
        color: rgba(255, 255, 255, 0.5);
        font-size: 12px;
      }
    }
  }

  .today-go {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    border-radius: 17px;
    background: #fff;
    color: var(--c-primary);
    font-size: 12px;
    font-weight: 600;
    flex-shrink: 0;
  }
}

/* 熟练度等级 */
.level-bar {
  position: relative;
  display: flex;
  gap: 4px;
  height: 56px;
  padding: 8px;
  border-radius: var(--radius-sm);
  background: var(--c-card);
  box-shadow: var(--shadow-card);
  margin: 14px 0 10px;
  box-sizing: border-box;

  .level-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    border-radius: 10px;

    .level-code {
      font-size: 11px;
      font-weight: 700;
    }

    .level-name {
      font-size: 10px;
    }
  }

  .lv-1 {
    background: rgba(250, 158, 51, 0.12);
    color: var(--c-orange-text);
  }

  .lv-2 {
    background: rgba(245, 199, 64, 0.14);
    color: var(--c-gold-text);
  }

  .lv-3 {
    background: rgba(13, 186, 156, 0.15);
    color: var(--c-primary-deep);
  }

  .lv-4 {
    background: rgba(10, 107, 92, 0.15);
    color: var(--c-primary-deep);
  }
}

.search-wrap {
  position: relative;
  padding: 2px 0 6px;

  :deep(.van-search__content) {
    background: var(--c-card);
    box-shadow: var(--shadow-card);
  }
}

.chip-row {
  position: relative;
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.loading-wrap {
  padding: 60px 0;
  display: flex;
  justify-content: center;
}

.item-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.word-card {
  padding: 14px;
  border-radius: 18px;
  background: var(--c-card);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: transform 0.15s ease;
  box-sizing: border-box;

  &:active {
    transform: scale(0.98);
  }

  .item-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;

    .item-content {
      font-size: 18px;
      font-weight: 600;
      color: var(--c-text);
    }

    .item-phonetic-row {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-top: 4px;

      .item-phonetic {
        font-size: 11px;
        color: var(--c-text-faint);
      }

      .item-meaning {
        font-size: 11px;
        color: var(--c-text-sub);
      }
    }

    .item-level {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 26px;
      padding: 0 10px;
      border-radius: 13px;
      font-size: 11px;
      font-weight: 600;
      flex-shrink: 0;

      .lv-icon {
        display: flex;
      }
    }

    .level-1 {
      background: rgba(250, 158, 51, 0.18);
      color: var(--c-orange-text);
    }

    .level-2 {
      background: rgba(245, 199, 64, 0.18);
      color: var(--c-gold-text);
    }

    .level-3 {
      background: rgba(13, 186, 156, 0.18);
      color: var(--c-primary-deep);
    }

    .level-4 {
      background: rgba(10, 107, 92, 0.18);
      color: var(--c-primary-deep);
    }
  }

  .mastery-track {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--c-divider);
    margin-top: 12px;
    overflow: hidden;

    .mastery-fill {
      display: block;
      height: 100%;
      border-radius: 3px;
      transition: width 0.6s ease;
    }
  }

  .item-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 10px;

    .review-label {
      font-size: 10px;
      color: var(--c-text-faint);
    }

    .sound-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(127, 224, 200, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
  }
}

.load-more,
.load-end {
  text-align: center;
  padding: 14px;
  font-size: 13px;
  color: var(--c-text-sub);
}

.load-more {
  color: var(--c-primary);
  cursor: pointer;
}

.empty {
  padding: 70px 0;
  text-align: center;

  .empty-icon {
    margin-bottom: 10px;
  }

  .empty-text {
    font-size: 15px;
    color: var(--c-text);
    font-weight: 500;
  }

  .empty-sub {
    font-size: 12px;
    color: var(--c-text-sub);
    margin-top: 6px;
  }
}

.add-area {
  position: fixed;
  bottom: calc(104px + env(safe-area-inset-bottom));
  left: 28px;
  right: 28px;
  z-index: 10;
}

.add-bar {
  height: 48px;
  background: var(--grad-brand);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 8px 24px rgba(13, 186, 156, 0.32);
  cursor: pointer;
  transition: transform 0.15s ease;

  &:active {
    transform: scale(0.97);
  }

  .add-text {
    font-size: 15px;
    color: #fff;
    font-weight: 600;
  }
}

/* 弹窗通用（同步设计稿风格：白底大圆角 + 顶部手柄 + 标题图标） */
.add-popup,
.review-popup {
  background: #fff;
  border-radius: 24px 24px 0 0;
  padding: 12px 20px calc(24px + env(safe-area-inset-bottom));
  padding-bottom: 28px;

  .popup-handle {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--c-divider);
    margin: 0 auto 16px;
  }

  .popup-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }

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

  .popup-title-icon-gold {
    background: linear-gradient(135deg, #f5c740, #fa9e33);
    box-shadow: 0 4px 10px rgba(245, 199, 64, 0.3);
  }

  .popup-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--c-text);
  }

  .popup-sub {
    font-size: 12px;
    color: var(--c-text-sub);
    margin-bottom: 14px;
  }
}

/* 添加弹窗输入框 */
.add-popup {
  .popup-input-wrap {
    position: relative;

    .popup-input {
      width: 100%;
      height: 52px;
      border: 1.5px solid var(--c-border);
      border-radius: 14px;
      background: var(--c-mint-bg);
      padding: 0 60px 0 16px;
      font-size: 14px;
      color: var(--c-text);
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.2s ease;

      &:focus {
        border-color: var(--c-primary);
      }

      &::placeholder {
        color: var(--c-text-faint);
      }
    }

    .popup-input-count {
      position: absolute;
      right: 14px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 11px;
      color: var(--c-text-faint);
    }
  }
}

/* 弹窗操作按钮 */
.popup-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;

  .popup-btn {
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
  }

  .popup-btn-cancel {
    background: var(--c-mint-bg);
    color: var(--c-text-sub);
  }

  .popup-btn-confirm {
    background: var(--grad-brand);
    color: #fff;
    box-shadow: 0 6px 16px rgba(13, 186, 156, 0.3);

    &.disabled {
      opacity: 0.45;
      pointer-events: none;
    }
  }
}

/* 复习弹窗 */
.review-popup {
  .popup-meaning {
    font-size: 15px;
    color: var(--c-text);
    font-weight: 600;
    margin-bottom: 4px;
  }

  .popup-sub {
    margin-bottom: 16px;
  }

  .review-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .review-opt {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 52px;
    padding: 0 16px;
    border-radius: 14px;
    border: 1.5px solid transparent;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.15s ease;

    &:active {
      transform: scale(0.98);
    }

    .opt-label {
      font-size: 14px;
      font-weight: 600;
    }

    .opt-arrow {
      display: flex;
      align-items: center;
      color: currentColor;
      opacity: 0.6;
    }
  }

  .opt-again {
    background: rgba(242, 149, 138, 0.12);
    border-color: rgba(242, 149, 138, 0.4);
    color: var(--c-red-text);
  }

  .opt-hard {
    background: rgba(245, 199, 64, 0.12);
    border-color: rgba(245, 199, 64, 0.4);
    color: var(--c-gold-text);
  }

  .opt-good {
    background: rgba(127, 224, 200, 0.16);
    border-color: rgba(13, 186, 156, 0.35);
    color: var(--c-primary-deep);
  }

  .opt-easy {
    background: rgba(13, 186, 156, 0.14);
    border-color: var(--c-primary);
    color: var(--c-primary-deep);
  }
}
</style>
