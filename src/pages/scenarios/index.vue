<template>
  <view class="scenarios-page">
    <!-- 分类 Tabs -->
    <wd-tabs
      class="category-tabs"
      :model-value="activeCategory"
      active-color="#4A90D9"
      @change="onTabChange"
    >
      <wd-tab
        v-for="cat in categories"
        :key="cat.key"
        :name="cat.key"
        :title="cat.label"
      />
    </wd-tabs>

    <!-- 加载中 -->
    <view v-if="loading" class="loading-wrap">
      <wd-loading size="32rpx" color="#4A90D9" />
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 场景列表 -->
    <view v-else class="scenario-list">
      <view
        v-for="scene in filteredScenes"
        :key="scene.id"
        class="card scenario-item"
        @click="goChat(scene)"
      >
        <view class="scenario-icon-wrap">
          <text class="scenario-icon">{{ scene.icon }}</text>
        </view>
        <view class="scenario-center">
          <view class="scenario-name-row">
            <text class="scenario-name">{{ scene.name }}</text>
            <wd-tag v-if="scene.category" size="small" plain :type="tagType(scene.category)">
              {{ catLabel(scene.category) }}
            </wd-tag>
          </view>
          <text class="scenario-desc" v-if="scene.description">{{ scene.description }}</text>
          <view class="scenario-stars">
            <text v-for="i in 5" :key="i" class="star" :class="{ filled: i <= scene.difficulty }">★</text>
            <text class="diff-label">{{ diffLabel(scene.difficulty) }}</text>
          </view>
        </view>
        <view class="scenario-right">
          <text class="arrow">›</text>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="!loading && filteredScenes.length === 0" class="empty">
      <text class="empty-icon">🗂️</text>
      <text class="empty-text">暂未找到场景</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { scenarioApi } from "@/api";

interface Scenario {
  id: number;
  name: string;
  category: string;
  description: string | null;
  difficulty: number;
  icon: string | null;
}

const categories = [
  { key: "all", label: "全部" },
  { key: "life", label: "生活" },
  { key: "work", label: "职场" },
  { key: "programmer", label: "程序员" },
];

const catLabelMap: Record<string, string> = {
  life: "生活",
  work: "职场",
  programmer: "程序员",
};

const activeCategory = ref("all");
const scenarios = ref<Scenario[]>([]);
const loading = ref(true);

const filteredScenes = computed(() => {
  if (activeCategory.value === "all") return scenarios.value;
  return scenarios.value.filter((s) => s.category === activeCategory.value);
});

const catLabel = (key: string) => catLabelMap[key] || key;

const tagType = (key: string) => {
  if (key === "life") return "success" as const;
  if (key === "work") return "warning" as const;
  if (key === "programmer") return "primary" as const;
  return "info" as const;
};

const diffLabel = (d: number) => {
  const map: Record<number, string> = { 1: "入门", 2: "初级", 3: "中级", 4: "进阶", 5: "高级" };
  return map[d] || "";
};

const onTabChange = (e: any) => {
  activeCategory.value = e.name || e.detail?.name || e;
};

onMounted(async () => {
  try {
    const data = await scenarioApi.list();
    scenarios.value = data || [];
  } catch (e) {
    console.error("Failed to load scenarios:", e);
  } finally {
    loading.value = false;
  }
});

const goChat = (scene: Scenario) => {
  uni.navigateTo({
    url: `/pages/chat/index?scenarioId=${scene.id}&scenarioName=${scene.name}`,
  });
};
</script>

<style lang="scss" scoped>
.scenarios-page {
  min-height: 100vh;
  background: #f5f6fa;
  padding-bottom: 40rpx;
}

.category-tabs {
  position: sticky;
  top: 0;
  z-index: 10;
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

.scenario-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin: 16rpx 24rpx;
  border-radius: 20rpx;
  transition: transform 0.15s;

  &:active {
    transform: scale(0.98);
  }
}

.scenario-icon-wrap {
  width: 88rpx;
  height: 88rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, #eaf2ff, #f5f9ff);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .scenario-icon {
    font-size: 44rpx;
  }
}

.scenario-center {
  flex: 1;
  min-width: 0;
}

.scenario-name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;

  .scenario-name {
    font-size: 30rpx;
    font-weight: 600;
    color: #333;
  }
}

.scenario-desc {
  font-size: 24rpx;
  color: #999;
  margin-top: 4rpx;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scenario-stars {
  margin-top: 6rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;

  .star {
    font-size: 24rpx;
    color: #e0e0e0;

    &.filled {
      color: #faad14;
    }
  }

  .diff-label {
    font-size: 22rpx;
    color: #b0b0b0;
  }
}

.scenario-right {
  .arrow {
    font-size: 40rpx;
    color: #ccc;
  }
}

.empty {
  padding: 160rpx 0;
  text-align: center;

  .empty-icon {
    font-size: 72rpx;
    display: block;
    margin-bottom: 16rpx;
  }

  .empty-text {
    font-size: 28rpx;
    color: #999;
  }
}
</style>
