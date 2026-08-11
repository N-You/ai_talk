<template>
  <view class="home-page">
    <!-- 渐变问候区 -->
    <view class="hero-section">
      <view class="hero-top">
        <view>
          <view class="greeting-wave">👋</view>
          <text class="greeting-text">Hello, {{ nickname }}!</text>
          <text class="greeting-sub">今天也练习 10 分钟吧</text>
        </view>
        <view class="hero-avatar" @click="goProfile">🧑‍🎓</view>
      </view>

      <!-- 开始练习大按钮 -->
      <view class="btn-start" @click="quickStart">
        <text class="btn-start-icon">🎙️</text>
        <text class="btn-start-text">开始练习</text>
        <text class="btn-start-sub">Start Speaking Now</text>
      </view>
    </view>

    <!-- 学习数据 -->
    <view class="card data-card">
      <view class="data-item">
        <text class="data-num">{{ wordCount }}</text>
        <text class="data-label">📚 生词</text>
      </view>
      <view class="data-divider"></view>
      <view class="data-item">
        <text class="data-num">{{ chatCount }}</text>
        <text class="data-label">💬 对话</text>
      </view>
      <view class="data-divider"></view>
      <view class="data-item">
        <text class="data-num">{{ streak }}</text>
        <text class="data-label">🔥 连续天</text>
      </view>
    </view>

    <!-- 今日目标 -->
    <view class="card">
      <view class="goal-header">
        <text class="section-title">今日目标</text>
        <wd-tag type="primary" size="small">{{ progress }}%</wd-tag>
      </view>
      <wd-progress :value="progress" stroke-width="8" color="linear-gradient(90deg,#4a90d9,#52c41a)" />
      <text class="goal-sub">已完成 {{ progress / 100 * 10 }} / 10 分钟练习</text>
    </view>

    <!-- 推荐场景 -->
    <view class="scenario-section">
      <view class="section-header">
        <text class="section-title">推荐场景</text>
        <text class="more-link" @click="quickStart">全部 ›</text>
      </view>
      <view class="scenario-grid">
        <view
          v-for="scene in featuredScenes"
          :key="scene.id"
          class="scenario-card"
          @click="goChat(scene)"
        >
          <text class="scenario-icon">{{ scene.icon }}</text>
          <text class="scenario-name">{{ scene.name }}</text>
          <text class="scenario-diff">{{ scene.diff }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { getToken } from "@/api";

const nickname = ref("Learner");
const streak = ref(7);
const progress = ref(70);
const wordCount = ref(128);
const chatCount = ref(12);

const featuredScenes = ref([
  { id: 1, icon: "☕", name: "咖啡店", diff: "入门" },
  { id: 4, icon: "✈️", name: "机场", diff: "初级" },
  { id: 3, icon: "🏨", name: "酒店", diff: "初级" },
  { id: 7, icon: "💼", name: "面试", diff: "中级" },
  { id: 11, icon: "💻", name: "站会", diff: "初级" },
  { id: 6, icon: "💬", name: "日常", diff: "入门" },
]);

const quickStart = () => {
  uni.switchTab({ url: "/pages/scenarios/index" });
};

const goProfile = () => {
  uni.switchTab({ url: "/pages/profile/index" });
};

const goChat = (scene: any) => {
  uni.navigateTo({ url: `/pages/chat/index?scenarioId=${scene.id}&scenarioName=${scene.name}` });
};
</script>

<style lang="scss" scoped>
.home-page {
  min-height: 100vh;
  background: #f5f6fa;
  padding-bottom: 40rpx;
}

// 问候区
.hero-section {
  background: linear-gradient(135deg, #4a90d9, #6db3f2);
  border-radius: 0 0 32rpx 32rpx;
  padding: 48rpx 32rpx 56rpx;
}

.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.greeting-wave {
  font-size: 44rpx;
  margin-bottom: 8rpx;
}

.greeting-text {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4rpx;
}

.greeting-sub {
  display: block;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.75);
}

.hero-avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44rpx;
}

.btn-start {
  margin-top: 40rpx;
  background: #fff;
  border-radius: 20rpx;
  padding: 32rpx 40rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.12);

  .btn-start-icon {
    font-size: 52rpx;
  }

  .btn-start-text {
    flex: 1;
    font-size: 34rpx;
    font-weight: 700;
    color: #333;
  }

  .btn-start-sub {
    font-size: 22rpx;
    color: #999;
  }
}

// 卡片基础
.card {
  background: #fff;
  border-radius: 16rpx;
  margin: 20rpx 24rpx 0;
  padding: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

// 数据卡
.data-card {
  margin-top: -28rpx;
  display: flex;
  align-items: center;
  position: relative;
  z-index: 1;
  border-radius: 20rpx;
}

.data-item {
  flex: 1;
  text-align: center;
  padding: 8rpx 0;

  .data-num {
    display: block;
    font-size: 40rpx;
    font-weight: 700;
    color: #4a90d9;
  }

  .data-label {
    display: block;
    font-size: 22rpx;
    color: #999;
    margin-top: 4rpx;
  }
}

.data-divider {
  width: 1rpx;
  height: 56rpx;
  background: #f0f0f0;
}

// 目标卡
.goal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.goal-sub {
  display: block;
  font-size: 22rpx;
  color: #999;
  margin-top: 12rpx;
}

// 场景区
.scenario-section {
  padding: 24rpx 24rpx 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;

  .more-link {
    font-size: 24rpx;
    color: #4a90d9;
  }
}

.scenario-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.scenario-card {
  width: calc(33.33% - 12rpx);
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx 12rpx;
  text-align: center;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  transition: transform 0.15s;

  &:active {
    transform: scale(0.96);
  }

  .scenario-icon {
    display: block;
    font-size: 44rpx;
    margin-bottom: 8rpx;
  }

  .scenario-name {
    display: block;
    font-size: 26rpx;
    color: #333;
    font-weight: 500;
  }

  .scenario-diff {
    display: block;
    font-size: 20rpx;
    color: #b0b0b0;
    margin-top: 4rpx;
  }
}
</style>
