<template>
  <view class="learning-page">
    <!-- 搜索栏 -->
    <view class="search-wrap">
      <wd-search
        v-model="searchText"
        placeholder="搜索单词或表达..."
        shape="round"
        hide-cancel
      />
    </view>

    <!-- 状态 Tabs -->
    <wd-tabs
      class="status-tabs"
      :model-value="activeTab"
      active-color="#4A90D9"
      @change="onTabChange"
    >
      <wd-tab v-for="t in tabs" :key="t.key" :name="t.key" :title="t.label" />
    </wd-tabs>

    <!-- 加载中 -->
    <view v-if="loading" class="loading-wrap">
      <wd-loading size="32rpx" color="#4A90D9" />
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 学习列表 -->
    <scroll-view class="item-list" scroll-y v-else>
      <view
        v-for="item in items"
        :key="item.id"
        class="card learning-item"
        @click="showReview(item)"
      >
        <view class="item-header">
          <text class="item-content">{{ item.content }}</text>
          <wd-tag size="small" :type="typeColor(item.type)">{{ typeLabel(item.type) }}</wd-tag>
        </view>
        <text class="item-meaning" v-if="item.meaning">{{ item.meaning }}</text>
        <text class="item-phonetic" v-if="item.phonetic">{{ item.phonetic }}</text>
        <view class="item-footer">
          <wd-progress
            :value="Math.round(item.mastery)"
            stroke-width="6"
            :color="masteryColor(item.mastery)"
            style="flex: 1"
          />
          <text class="mastery-label">{{ masteryLabel(item.mastery) }}</text>
          <text class="review-label" v-if="item.next_review_at">{{ formatReviewTime(item.next_review_at) }}</text>
        </view>
      </view>

      <!-- 加载更多 -->
      <view class="load-more" v-if="hasMore" @click="loadMore">加载更多</view>
      <view class="load-end" v-else-if="items.length > 0">— 已全部加载 —</view>

      <!-- 空状态 -->
      <view class="empty" v-if="items.length === 0">
        <text class="empty-icon">📚</text>
        <text class="empty-text">还没有学习内容</text>
        <text class="empty-sub">在对话中点击「💡 记录表达」，或点击下方添加</text>
      </view>
    </scroll-view>

    <!-- 添加按钮 -->
    <view class="add-area safe-bottom">
      <view class="add-bar" @click="showAddPopup">
        <text class="add-icon">＋</text>
        <text class="add-text">添加单词或短语</text>
      </view>
    </view>

    <!-- 添加弹窗 -->
    <wd-popup v-model="showAdd" position="bottom" :safe-area-inset-bottom="true">
      <view class="add-popup">
        <text class="popup-title">添加学习内容</text>
        <wd-input
          v-model="newContent"
          placeholder="输入单词或短语，如 reservation"
          clearable
          border
        />
        <view class="popup-actions">
          <wd-button size="large" plain type="info" @click="showAdd = false">取消</wd-button>
          <wd-button size="large" type="primary" @click="addItem">AI 自动补充</wd-button>
        </view>
      </view>
    </wd-popup>

    <!-- 复习弹窗 -->
    <wd-popup v-model="showReviewPopup" position="bottom" :safe-area-inset-bottom="true">
      <view class="review-popup safe-bottom">
        <text class="popup-title">复习：{{ currentItem?.content }}</text>
        <text class="popup-meaning" v-if="currentItem?.meaning">{{ currentItem.meaning }}</text>
        <text class="popup-sub">还记得吗？</text>
        <view class="review-grid">
          <wd-button
            v-for="opt in reviewOptions"
            :key="opt.key"
            size="large"
            :type="opt.type"
            @click="submitReview(opt.key)"
          >
            {{ opt.label }}
          </wd-button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
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

const showAdd = ref(false);
const newContent = ref("");

const showReviewPopup = ref(false);
const currentItem = ref<LearningItem | null>(null);

const typeLabel = (t: string) => typeLabelMap[t] || t;
const typeColor = (t: string) => (typeColorMap[t] || "info") as any;

const masteryColor = (m: number) => {
  if (m >= 80) return "#52c41a";
  if (m >= 50) return "#faad14";
  return "#ff4d4f";
};

const masteryLabel = (m: number) => (m >= 80 ? "已掌握" : `掌握度 ${Math.round(m)}%`);

onMounted(() => {
  fetchItems();
});

watch(searchText, () => {
  page.value = 1;
  items.value = [];
  fetchItems();
});

function onTabChange(e: any) {
  activeTab.value = e.name || e.detail?.name || e;
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
    // 更新本地列表
    const idx = items.value.findIndex((i) => i.id === currentItem.value!.id);
    if (idx > -1) {
      items.value[idx] = { ...items.value[idx], mastery: updated.mastery, next_review_at: updated.next_review_at };
    }
    showReviewPopup.value = false;
    uni.showToast({ title: "已记录", icon: "success" });
  } catch (e) {
    uni.showToast({ title: "操作失败", icon: "none" });
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
    uni.showToast({ title: "已添加，AI 补充中...", icon: "success" });
    page.value = 1;
    items.value = [];
    fetchItems();
  } catch (e) {
    uni.showToast({ title: "添加失败", icon: "none" });
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
  display: flex;
  flex-direction: column;
}

.search-wrap {
  background: #fff;
  padding: 16rpx 24rpx;
}

.status-tabs {
  background: #fff;
}

.loading-wrap {
  padding: 160rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;

  .loading-text {
    font-size: 26rpx;
    color: #999;
  }
}

.item-list {
  flex: 1;
  padding-bottom: 140rpx;
}

.learning-item {
  margin: 16rpx 24rpx;
  border-radius: 20rpx;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}

.item-content {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.item-meaning {
  font-size: 26rpx;
  color: #666;
  display: block;
}

.item-phonetic {
  font-size: 22rpx;
  color: #b0b0b0;
  display: block;
  margin-top: 2rpx;
}

.item-footer {
  display: flex;
  align-items: center;
  margin-top: 16rpx;
  gap: 16rpx;
}

.mastery-label,
.review-label {
  font-size: 22rpx;
  color: #999;
  white-space: nowrap;
}

.load-more,
.load-end {
  text-align: center;
  padding: 24rpx;
  font-size: 26rpx;
  color: #999;
}

.load-more {
  color: #4a90d9;
}

.empty {
  padding: 160rpx 0;
  text-align: center;

  .empty-icon {
    font-size: 80rpx;
    display: block;
    margin-bottom: 16rpx;
  }

  .empty-text {
    display: block;
    font-size: 30rpx;
    color: #333;
    font-weight: 500;
  }

  .empty-sub {
    display: block;
    font-size: 24rpx;
    color: #999;
    margin-top: 8rpx;
  }
}

// 添加按钮
.add-area {
  position: fixed;
  bottom: 120rpx;
  left: 0;
  right: 0;
  padding: 16rpx 48rpx;
  background: linear-gradient(transparent, #f5f6fa 40%);
}

.add-bar {
  height: 88rpx;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  box-shadow: 0 8rpx 24rpx rgba(74, 144, 217, 0.3);

  .add-icon {
    font-size: 40rpx;
    color: #fff;
    font-weight: 300;
  }

  .add-text {
    font-size: 28rpx;
    color: #fff;
    font-weight: 500;
  }
}

// 弹窗
.add-popup,
.review-popup {
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
}

.popup-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 32rpx;

  :deep(wd-button) {
    flex: 1;
  }
}

.review-popup {
  text-align: center;

  .popup-meaning {
    display: block;
    font-size: 28rpx;
    color: #666;
    margin-bottom: 8rpx;
  }

  .popup-sub {
    display: block;
    font-size: 24rpx;
    color: #999;
    margin-bottom: 0;
  }
}

.review-grid {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 24rpx;

  :deep(wd-button) {
    width: 100%;
  }
}
</style>
