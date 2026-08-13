<template>
  <div class="learning-page">
    <!-- 搜索栏 -->
    <div class="search-wrap">
      <van-search v-model="searchText" placeholder="搜索单词或表达..." shape="round" @update:model-value="onSearch" />
    </div>

    <!-- 状态 Tabs -->
    <van-tabs v-model:active="activeTab" color="#4A90D9" @change="onTabChange">
      <van-tab v-for="t in tabs" :key="t.key" :name="t.key" :title="t.label" />
    </van-tabs>

    <!-- 加载中 -->
    <div v-if="loading" class="loading-wrap">
      <van-loading size="24" color="#4A90D9" vertical>加载中...</van-loading>
    </div>

    <!-- 学习列表 -->
    <div v-else class="item-list">
      <div v-for="item in items" :key="item.id" class="card learning-item" @click="showReview(item)">
        <div class="item-header">
          <span class="item-content">{{ item.content }}</span>
          <van-tag size="small" :type="typeColor(item.type)">{{ typeLabel(item.type) }}</van-tag>
        </div>
        <div class="item-meaning" v-if="item.meaning">{{ item.meaning }}</div>
        <div class="item-phonetic" v-if="item.phonetic">{{ item.phonetic }}</div>
        <div class="item-footer">
          <van-progress
            :percentage="Math.round(item.mastery)"
            stroke-width="6"
            :color="masteryColor(item.mastery)"
            style="flex: 1"
          />
          <span class="mastery-label">{{ masteryLabel(item.mastery) }}</span>
          <span class="review-label" v-if="item.next_review_at">{{ formatReviewTime(item.next_review_at) }}</span>
        </div>
      </div>

      <!-- 加载更多 -->
      <div class="load-more" v-if="hasMore" @click="loadMore">加载更多</div>
      <div class="load-end" v-else-if="items.length > 0">— 已全部加载 —</div>

      <!-- 空状态 -->
      <div class="empty" v-if="items.length === 0">
        <div class="empty-icon">📚</div>
        <div class="empty-text">还没有学习内容</div>
        <div class="empty-sub">在对话中点击「💡 记录表达」，或点击下方添加</div>
      </div>
    </div>

    <!-- 添加按钮 -->
    <div class="add-area">
      <div class="add-bar" @click="showAddPopup">
        <span class="add-icon">＋</span>
        <span class="add-text">添加单词或短语</span>
      </div>
    </div>

    <!-- 添加弹窗 -->
    <van-popup v-model:show="showAdd" position="bottom" round :style="{ padding: '20px' }">
      <div class="add-popup">
        <div class="popup-title">添加学习内容</div>
        <van-field v-model="newContent" placeholder="输入单词或短语，如 reservation" clearable />
        <div class="popup-actions">
          <van-button size="large" plain type="default" @click="showAdd = false">取消</van-button>
          <van-button size="large" type="primary" @click="addItem">AI 自动补充</van-button>
        </div>
      </div>
    </van-popup>

    <!-- 复习弹窗 -->
    <van-popup v-model:show="showReviewPopup" position="bottom" round :style="{ padding: '20px' }">
      <div class="review-popup">
        <div class="popup-title">复习：{{ currentItem?.content }}</div>
        <div class="popup-meaning" v-if="currentItem?.meaning">{{ currentItem.meaning }}</div>
        <div class="popup-sub">还记得吗？</div>
        <div class="review-grid">
          <van-button v-for="opt in reviewOptions" :key="opt.key" size="large" :type="opt.type" block @click="submitReview(opt.key)">
            {{ opt.label }}
          </van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { showToast, showSuccessToast } from "vant";
import { learningApi } from "@/api";

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

const typeLabelMap: Record<string, string> = {
  WORD: "单词",
  PHRASE: "短语",
  SENTENCE: "句子",
  EXPRESSION: "表达",
};

const typeColorMap: Record<string, string> = {
  WORD: "primary",
  PHRASE: "success",
  SENTENCE: "warning",
  EXPRESSION: "danger",
};

const reviewOptions = [
  { key: "again", label: "忘记", type: "danger" },
  { key: "hard", label: "模糊", type: "warning" },
  { key: "good", label: "认识", type: "success" },
  { key: "easy", label: "熟练", type: "primary" },
];

const searchText = ref("");
const activeTab = ref("all");
const items = ref<LearningItem[]>([]);
const loading = ref(true);
const page = ref(1);
const hasMore = ref(false);
const total = ref(0);
const searchTimer = ref<number | null>(null);

const showAdd = ref(false);
const newContent = ref("");

const showReviewPopup = ref(false);
const currentItem = ref<LearningItem | null>(null);

const typeLabel = (t: string) => typeLabelMap[t] || t;
const typeColor = (t: string) => (typeColorMap[t] || "default") as any;

const masteryColor = (m: number) => {
  if (m >= 80) return "#52c41a";
  if (m >= 50) return "#faad14";
  return "#ff4d4f";
};

const masteryLabel = (m: number) => (m >= 80 ? "已掌握" : `掌握度 ${Math.round(m)}%`);

onMounted(() => {
  fetchItems();
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

function onTabChange(name: string | number) {
  activeTab.value = String(name);
  page.value = 1;
  items.value = [];
  fetchItems();
}

async function fetchItems() {
  loading.value = true;
  try {
    const params: any = { page: page.value, size: 20 };
    if (activeTab.value !== "all") params.status = activeTab.value;
    if (searchText.value.trim()) params.search = searchText.value.trim();

    const res = await learningApi.list(params);
    items.value = page.value === 1 ? res.items || [] : items.value.concat(res.items || []);
    total.value = res.total;
    hasMore.value = items.value.length < total.value;
  } catch (e) {
    console.error("Failed to load items:", e);
  } finally {
    loading.value = false;
  }
}

function loadMore() {
  page.value++;
  fetchItems();
}

function showReview(item: LearningItem) {
  currentItem.value = item;
  showReviewPopup.value = true;
}

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

function showAddPopup() {
  newContent.value = "";
  showAdd.value = true;
}

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
  min-height: 100vh;
  background: #f5f6fa;
  padding-bottom: 90px;
}

.search-wrap {
  background: #fff;
  padding: 8px 0;
}

.loading-wrap {
  padding: 100px 0;
  display: flex;
  justify-content: center;
}

.learning-item {
  margin: 10px 14px;
  border-radius: 14px;
  cursor: pointer;
  transition: transform 0.15s;

  &:active {
    transform: scale(0.98);
  }
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.item-content {
  font-size: 17px;
  font-weight: 600;
  color: #333;
}

.item-meaning {
  font-size: 13px;
  color: #666;
}

.item-phonetic {
  font-size: 11px;
  color: #b0b0b0;
  margin-top: 2px;
}

.item-footer {
  display: flex;
  align-items: center;
  margin-top: 10px;
  gap: 10px;
}

.mastery-label,
.review-label {
  font-size: 11px;
  color: #999;
  white-space: nowrap;
}

.load-more,
.load-end {
  text-align: center;
  padding: 14px;
  font-size: 13px;
  color: #999;
}

.load-more {
  color: #4a90d9;
  cursor: pointer;
}

.empty {
  padding: 100px 0;
  text-align: center;

  .empty-icon {
    font-size: 48px;
    margin-bottom: 10px;
  }

  .empty-text {
    font-size: 15px;
    color: #333;
    font-weight: 500;
  }

  .empty-sub {
    font-size: 12px;
    color: #999;
    margin-top: 6px;
  }
}

.add-area {
  position: fixed;
  bottom: 70px;
  left: 0;
  right: 0;
  padding: 10px 28px;
  background: linear-gradient(transparent, #f5f6fa 40%);
}

.add-bar {
  height: 46px;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  border-radius: 23px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 8px 24px rgba(74, 144, 217, 0.3);
  cursor: pointer;

  .add-icon {
    font-size: 22px;
    color: #fff;
    font-weight: 300;
  }

  .add-text {
    font-size: 15px;
    color: #fff;
    font-weight: 500;
  }
}

.add-popup,
.review-popup {
  .popup-title {
    font-size: 17px;
    font-weight: 600;
    color: #333;
    margin-bottom: 12px;
    text-align: center;
  }
}

.popup-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;

  :deep(.van-button) {
    flex: 1;
  }
}

.review-popup {
  text-align: center;

  .popup-meaning {
    font-size: 14px;
    color: #666;
    margin-bottom: 6px;
  }

  .popup-sub {
    font-size: 12px;
    color: #999;
    margin-bottom: 14px;
  }

  .review-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;

    :deep(.van-button) {
      width: 100%;
    }
  }
}
</style>
