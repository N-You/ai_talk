<template>
  <view class="profile-page">
    <!-- 用户信息 -->
    <view class="profile-header">
      <view class="avatar">
        <text>👤</text>
      </view>
      <text class="nickname">{{ isLoggedIn ? nickname : "未登录" }}</text>
      <text class="level">{{ isLoggedIn ? "Level: " + level : "登录后同步学习数据" }}</text>
    </view>

    <!-- 学习统计 -->
    <view class="card stats-section">
      <text class="section-title">学习统计</text>
      <view class="stats-grid">
        <view class="stat-item">
          <text class="stat-num">{{ stats.totalConversations }}</text>
          <text class="stat-label">💬 总对话</text>
        </view>
        <view class="stat-item">
          <text class="stat-num">{{ stats.totalMinutes }}</text>
          <text class="stat-label">⏱️ 练习分钟</text>
        </view>
        <view class="stat-item">
          <text class="stat-num">{{ stats.totalWords }}</text>
          <text class="stat-label">📚 学习词汇</text>
        </view>
        <view class="stat-item">
          <text class="stat-num">{{ stats.streak }}</text>
          <text class="stat-label">🔥 连续天数</text>
        </view>
      </view>
    </view>

    <!-- 每日目标 -->
    <view class="card goal-section">
      <view class="goal-header">
        <text class="section-title">每日目标</text>
        <text class="goal-value">{{ goalMinutes }} 分钟</text>
      </view>
      <wd-slider v-model="goalMinutes" :min="5" :max="60" :step="5" active-color="#4A90D9" />
      <text class="goal-tip">坚持每天练习，让英语成为习惯</text>
    </view>

    <!-- 导航菜单 -->
    <view class="menu-section">
      <wd-cell-group card>
        <wd-cell title="🎯 学习目标设置" is-link @click="noImplement" />
        <wd-cell title="🔔 提醒设置" is-link @click="noImplement" />
        <wd-cell
          title="⚙️ AI 模型配置"
          is-link
          :value="aiSettings.model || '默认'"
          value-class="menu-value"
          @click="showSettings = true"
        />
        <wd-cell title="🎤 语音设置" is-link @click="noImplement" />
        <wd-cell title="📊 详细学习报告" is-link @click="noImplement" />
        <wd-cell title="ℹ️ 关于 AI English Tutor" is-link @click="noImplement" />
      </wd-cell-group>
    </view>

    <!-- 登录区域 -->
    <view class="login-area" v-if="!isLoggedIn">
      <view class="login-card">
        <text class="login-title">👋 欢迎使用</text>
        <text class="login-sub">输入名字开始你的英语之旅</text>
        <wd-input
          v-model="nickInput"
          placeholder="你的名字"
          clearable
          border
          style="margin: 24rpx 0"
        />
        <wd-button block size="large" type="primary" @click="doLogin">进入 AI English Tutor</wd-button>
        <text class="login-hint" v-if="isH5">H5 模式，无需微信授权</text>
      </view>
    </view>
    <view class="login-area" v-else>
      <wd-button block size="large" plain type="info" @click="doLogout">退出登录</wd-button>
    </view>

    <!-- AI 模型配置弹窗 -->
    <wd-popup v-model="showSettings" position="bottom" :safe-area-inset-bottom="true">
      <view class="settings-dialog">
        <text class="settings-title">AI 模型配置</text>

        <view class="settings-source" v-if="settingsSource">
          <text class="settings-source-text">
            {{ settingsSource === "user" ? "✓ 当前使用你配置的模型" : settingsSource === "env" ? "ℹ️ 当前使用服务端默认模型（.env 配置）" : "" }}
          </text>
        </view>

        <view class="settings-form">
          <text class="settings-label">API 地址</text>
          <wd-input v-model="aiSettings.apiBase" placeholder="https://open.bigmodel.cn/api/paas/v4" clearable border />
          <text class="settings-label">API Key</text>
          <wd-input v-model="aiSettings.apiKey" placeholder="在各平台官网购买模型后获取" clearable border />
          <text class="settings-label">模型名称</text>
          <wd-input v-model="aiSettings.model" placeholder="glm-4.5-air" clearable border />
          <text class="settings-tip">留空则使用服务端 .env 中的默认配置</text>
        </view>

        <view class="settings-actions">
          <wd-button block size="large" plain type="info" @click="showSettings = false">取消</wd-button>
          <wd-button block size="large" type="primary" @click="saveSettings">保存配置</wd-button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { authApi, userApi, setToken, getToken } from "@/api";

const isLoggedIn = ref(false);
const nickname = ref("Learner");
const level = ref("beginner");
const goalMinutes = ref(15);
const nickInput = ref("");
const showSettings = ref(false);
const settingsSource = ref(""); // env / user / none
const aiSettings = reactive({ apiBase: "", apiKey: "", model: "" });

// #ifdef H5
const isH5 = true;
// #endif
// #ifndef H5
const isH5 = false;
// #endif

const stats = reactive({
  totalConversations: 0,
  totalMinutes: 0,
  totalWords: 0,
  streak: 0,
});

onMounted(() => {
  if (getToken()) {
    isLoggedIn.value = true;
    loadSettings();
    loadProfile();
  }
});

async function loadProfile() {
  try {
    const p = await userApi.getProfile();
    if (p.nickname) nickname.value = p.nickname;
    if (p.level) level.value = p.level;
  } catch (e) { /* ignore */ }
}

async function doLogin() {
  try {
    // #ifdef H5
    const name = nickInput.value.trim() || "Learner";
    const res = await authApi.login(name);
    setToken(res.access_token);
    nickname.value = res.user?.nickname || name;
    level.value = res.user?.level || "beginner";
    isLoggedIn.value = true;
    uni.showToast({ title: "欢迎！", icon: "success" });
    loadSettings();
    // #endif

    // #ifdef MP-WEIXIN
    uni.login({
      provider: "weixin",
      success: async (loginRes: any) => {
        const res = await authApi.login(loginRes.code || "dev-code");
        setToken(res.access_token);
        nickname.value = res.user?.nickname || "Learner";
        level.value = res.user?.level || "beginner";
        isLoggedIn.value = true;
        uni.showToast({ title: "登录成功", icon: "success" });
        loadSettings();
      },
      fail: () => {
        uni.showToast({ title: "微信授权失败", icon: "none" });
      },
    });
    // #endif
  } catch (e) {
    uni.showToast({ title: "登录失败", icon: "none" });
  }
}

function doLogout() {
  isLoggedIn.value = false;
  setToken("");
  uni.showToast({ title: "已退出", icon: "none" });
}

function noImplement() {
  uni.showToast({ title: "开发中", icon: "none" });
}

async function loadSettings() {
  try {
    const s = await userApi.getSettings();
    const hasUser = s.apiKey || s.apiBase || s.model;
    if (hasUser) {
      if (s.apiBase) aiSettings.apiBase = s.apiBase;
      if (s.apiKey) aiSettings.apiKey = s.apiKey;
      if (s.model) aiSettings.model = s.model;
      settingsSource.value = "user";
    } else {
      settingsSource.value = "env";
    }
  } catch (e) {
    settingsSource.value = "none";
  }
}

async function saveSettings() {
  if (!getToken()) {
    uni.showToast({ title: "请先登录", icon: "none" });
    return;
  }
  try {
    await userApi.updateSettings({
      apiKey: aiSettings.apiKey.trim(),
      apiBase: aiSettings.apiBase.trim(),
      model: aiSettings.model.trim(),
    });
    settingsSource.value = "user";
    showSettings.value = false;
    uni.showToast({ title: "已保存", icon: "success" });
  } catch (e) {
    uni.showToast({ title: "保存失败", icon: "none" });
  }
}
</script>

<style lang="scss" scoped>
.profile-page {
  min-height: 100vh;
  background: #f5f6fa;
  padding-bottom: 40rpx;
}

.profile-header {
  background: linear-gradient(135deg, #4a90d9, #6db3f2);
  padding: 56rpx 32rpx 48rpx;
  text-align: center;

  .avatar {
    width: 128rpx;
    height: 128rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    margin: 0 auto 16rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 60rpx;
    border: 4rpx solid rgba(255, 255, 255, 0.4);
  }

  .nickname {
    display: block;
    font-size: 38rpx;
    font-weight: 700;
    color: #fff;
  }

  .level {
    display: block;
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.75);
    margin-top: 8rpx;
  }
}

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

.stats-section {
  margin-top: -24rpx;
  border-radius: 20rpx;
  position: relative;
  z-index: 1;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8rpx;
  margin-top: 16rpx;
}

.stat-item {
  text-align: center;
  padding: 12rpx 0;

  .stat-num {
    display: block;
    font-size: 36rpx;
    font-weight: 700;
    color: #4a90d9;
  }

  .stat-label {
    display: block;
    font-size: 22rpx;
    color: #999;
    margin-top: 4rpx;
  }
}

.goal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;

  .goal-value {
    font-size: 28rpx;
    color: #4a90d9;
    font-weight: 600;
  }
}

.goal-tip {
  display: block;
  font-size: 22rpx;
  color: #999;
  margin-top: 12rpx;
}

.menu-section {
  margin: 20rpx 24rpx 0;

  .menu-value {
    font-size: 24rpx;
    color: #999;
  }
}

.login-area {
  padding: 32rpx 24rpx;
}

.login-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 40rpx 32rpx;
  text-align: center;

  .login-title {
    display: block;
    font-size: 34rpx;
    font-weight: 700;
    color: #333;
  }

  .login-sub {
    display: block;
    font-size: 24rpx;
    color: #999;
    margin-top: 8rpx;
  }

  .login-hint {
    display: block;
    font-size: 22rpx;
    color: #b0b0b0;
    margin-top: 16rpx;
  }
}

// 配置弹窗
.settings-dialog {
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx 32rpx 48rpx;

  .settings-title {
    font-size: 34rpx;
    font-weight: 600;
    color: #333;
    text-align: center;
    display: block;
    margin-bottom: 24rpx;
  }

  .settings-source {
    background: #e8f4ff;
    border-radius: 12rpx;
    padding: 16rpx 20rpx;
    margin-bottom: 24rpx;

    .settings-source-text {
      font-size: 24rpx;
      color: #2b6cb0;
    }
  }

  .settings-form {
    .settings-label {
      font-size: 26rpx;
      color: #666;
      display: block;
      margin: 16rpx 0 8rpx;
    }

    .settings-tip {
      display: block;
      font-size: 22rpx;
      color: #999;
      margin-top: 16rpx;
    }
  }

  .settings-actions {
    display: flex;
    gap: 16rpx;
    margin-top: 32rpx;

    :deep(wd-button) {
      flex: 1;
    }
  }
}
</style>
