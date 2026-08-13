<template>
  <div class="home-page">
    <!-- 渐变问候区 -->
    <div class="hero-section">
      <div class="hero-top">
        <div>
          <div class="greeting-wave">👋</div>
          <div class="greeting-text">Hello, {{ nickname }}!</div>
          <div class="greeting-sub">今天也练习 10 分钟吧</div>
        </div>
        <div class="hero-avatar" @click="goProfile">🧑‍🎓</div>
      </div>

      <!-- 开始练习大按钮 -->
      <div class="btn-start" @click="goScenarios">
        <span class="btn-start-icon">🎙️</span>
        <span class="btn-start-text">开始练习</span>
        <span class="btn-start-sub">Start Speaking Now</span>
      </div>
    </div>

    <!-- 学习数据 -->
    <div class="card data-card">
      <div class="data-item">
        <span class="data-num">{{ wordCount }}</span>
        <span class="data-label">📚 生词</span>
      </div>
      <div class="data-divider"></div>
      <div class="data-item">
        <span class="data-num">{{ chatCount }}</span>
        <span class="data-label">💬 对话</span>
      </div>
      <div class="data-divider"></div>
      <div class="data-item">
        <span class="data-num">{{ streak }}</span>
        <span class="data-label">🔥 连续天</span>
      </div>
    </div>

    <!-- 今日目标 -->
    <div class="card">
      <div class="goal-header">
        <span class="section-title">今日目标</span>
        <van-tag type="primary" size="medium">{{ progress }}%</van-tag>
      </div>
      <van-progress :percentage="progress" stroke-width="8" color="linear-gradient(90deg,#4a90d9,#52c41a)" />
      <div class="goal-sub">已完成 {{ (progress / 10).toFixed(1) }} / 10 分钟练习</div>
    </div>

    <!-- 推荐场景 -->
    <div class="scenario-section">
      <div class="section-header">
        <span class="section-title">推荐场景</span>
        <span class="more-link" @click="goScenarios">全部 ›</span>
      </div>
      <div class="scenario-grid">
        <div v-for="scene in featuredScenes" :key="scene.id" class="scenario-card" @click="goChat(scene)">
          <span class="scenario-icon">{{ scene.icon }}</span>
          <span class="scenario-name">{{ scene.name }}</span>
          <span class="scenario-diff">{{ scene.diff }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { getToken } from "@/api";

const router = useRouter();
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

onMounted(() => {
  const saved = localStorage.getItem("nickname");
  if (saved) nickname.value = saved;
});

function goScenarios() {
  router.push("/scenarios");
}

function goProfile() {
  router.push("/profile");
}

function goChat(scene: any) {
  router.push({ path: "/chat", query: { scenarioId: scene.id, scenarioName: scene.name } });
}
</script>

<style lang="scss" scoped>
.home-page {
  min-height: 100vh;
  background: #f5f6fa;
  padding-bottom: 60px;
}

.hero-section {
  background: linear-gradient(135deg, #4a90d9, #6db3f2);
  border-radius: 0 0 24px 24px;
  padding: 28px 20px 40px;
}

.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.greeting-wave {
  font-size: 30px;
  margin-bottom: 6px;
}

.greeting-text {
  font-size: 24px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
}

.greeting-sub {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.75);
}

.hero-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  cursor: pointer;
}

.btn-start {
  margin-top: 28px;
  background: #fff;
  border-radius: 14px;
  padding: 20px 24px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  transition: transform 0.15s;

  &:active {
    transform: scale(0.98);
  }

  .btn-start-icon {
    font-size: 32px;
  }

  .btn-start-text {
    flex: 1;
    font-size: 20px;
    font-weight: 600;
    color: #333;
  }

  .btn-start-sub {
    font-size: 12px;
    color: #999;
  }
}

.card {
  background: #fff;
  border-radius: 12px;
  margin: 12px 14px 0;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.section-title {
  font-size: 17px;
  font-weight: 600;
  color: #333;
}

.data-card {
  margin-top: -20px;
  display: flex;
  align-items: center;
  position: relative;
  z-index: 1;
  border-radius: 16px;
}

.data-item {
  flex: 1;
  text-align: center;
  padding: 4px 0;

  .data-num {
    display: block;
    font-size: 26px;
    font-weight: 700;
    color: #4a90d9;
  }

  .data-label {
    display: block;
    font-size: 12px;
    color: #999;
    margin-top: 2px;
  }
}

.data-divider {
  width: 1px;
  height: 36px;
  background: #f0f0f0;
}

.goal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.goal-sub {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
}

.scenario-section {
  padding: 16px 14px 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;

  .more-link {
    font-size: 13px;
    color: #4a90d9;
    cursor: pointer;
  }
}

.scenario-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.scenario-card {
  width: calc(33.33% - 8px);
  background: #fff;
  border-radius: 12px;
  padding: 14px 8px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  box-sizing: border-box;
  cursor: pointer;
  transition: transform 0.15s;

  &:active {
    transform: scale(0.96);
  }

  .scenario-icon {
    display: block;
    font-size: 28px;
    margin-bottom: 6px;
  }

  .scenario-name {
    display: block;
    font-size: 14px;
    color: #333;
    font-weight: 500;
  }

  .scenario-diff {
    display: block;
    font-size: 11px;
    color: #b0b0b0;
    margin-top: 2px;
  }
}
</style>
