<template>
  <div class="profile-page">
    <!-- 用户信息 -->
    <div class="profile-header">
      <div class="avatar"><span>👤</span></div>
      <div class="nickname">{{ isLoggedIn ? nickname : "未登录" }}</div>
      <div class="level">{{ isLoggedIn ? "Level: " + level : "登录后同步学习数据" }}</div>
    </div>

    <!-- 学习统计 -->
    <div class="card stats-section">
      <div class="section-title">学习统计</div>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-num">{{ stats.totalConversations }}</span>
          <span class="stat-label">💬 总对话</span>
        </div>
        <div class="stat-item">
          <span class="stat-num">{{ stats.totalMinutes }}</span>
          <span class="stat-label">⏱️ 练习分钟</span>
        </div>
        <div class="stat-item">
          <span class="stat-num">{{ stats.totalWords }}</span>
          <span class="stat-label">📚 学习词汇</span>
        </div>
        <div class="stat-item">
          <span class="stat-num">{{ stats.streak }}</span>
          <span class="stat-label">🔥 连续天数</span>
        </div>
      </div>
    </div>

    <!-- 每日目标 -->
    <div class="card goal-section">
      <div class="goal-header">
        <span class="section-title">每日目标</span>
        <span class="goal-value">{{ goalMinutes }} 分钟</span>
      </div>
      <van-slider v-model="goalMinutes" :min="5" :max="60" :step="5" active-color="#4A90D9" />
      <div class="goal-tip">坚持每天练习，让英语成为习惯</div>
    </div>

    <!-- 导航菜单 -->
    <div class="menu-section">
      <van-cell-group inset>
        <van-cell title="🎯 学习目标设置" is-link @click="noImplement" />
        <van-cell title="🔔 提醒设置" is-link @click="noImplement" />
        <van-cell
          title="⚙️ AI 模型配置"
          is-link
          :value="aiSettings.model || '默认'"
          @click="showSettings = true"
        />
        <van-cell title="🎤 语音设置" is-link @click="noImplement" />
        <van-cell title="📊 详细学习报告" is-link @click="noImplement" />
        <van-cell title="ℹ️ 关于 AI English Tutor" is-link @click="noImplement" />
      </van-cell-group>
    </div>

    <!-- 登录区域 -->
    <div class="login-area" v-if="!isLoggedIn">
      <div class="login-card">
        <div class="login-title">👋 欢迎使用</div>
        <div class="login-sub">输入名字开始你的英语之旅</div>
        <van-field v-model="nickInput" placeholder="你的名字" clearable style="margin: 16px 0" />
        <van-button block size="large" type="primary" @click="doLogin">进入 AI English Tutor</van-button>
        <div class="login-hint">H5 模式，无需注册</div>
      </div>
    </div>
    <div class="login-area" v-else>
      <van-button block size="large" plain type="default" @click="doLogout">退出登录</van-button>
    </div>

    <!-- AI 模型配置弹窗 -->
    <van-popup v-model:show="showSettings" position="bottom" round :style="{ padding: '20px' }">
      <div class="settings-dialog">
        <div class="settings-title">AI 模型配置</div>

        <div class="settings-source" v-if="settingsSource">
          <span class="settings-source-text">
            {{ settingsSource === "user" ? "✓ 当前使用你配置的模型" : settingsSource === "env" ? "ℹ️ 当前使用服务端默认模型（.env 配置）" : "" }}
          </span>
        </div>

        <div class="settings-form">
          <div class="settings-label">API 地址</div>
          <van-field v-model="aiSettings.apiBase" placeholder="https://open.bigmodel.cn/api/paas/v4" clearable />
          <div class="settings-label">API Key</div>
          <van-field v-model="aiSettings.apiKey" placeholder="在各平台官网购买模型后获取" clearable type="password" />
          <div class="settings-label">模型名称</div>
          <van-field v-model="aiSettings.model" placeholder="glm-4.5-air" clearable />
          <div class="settings-tip">留空则使用服务端 .env 中的默认配置</div>
        </div>

        <div class="settings-actions">
          <van-button block size="large" plain type="default" @click="showSettings = false">取消</van-button>
          <van-button block size="large" type="primary" @click="saveSettings">保存配置</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { showToast, showSuccessToast } from "vant";
import { authApi, userApi, getToken, setToken, clearToken } from "@/api";

const isLoggedIn = ref(false);
const nickname = ref("Learner");
const level = ref("beginner");
const goalMinutes = ref(15);
const nickInput = ref("");
const showSettings = ref(false);
const settingsSource = ref(""); // env / user / none
const aiSettings = reactive({ apiBase: "", apiKey: "", model: "" });

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
    if (p.nickname) {
      nickname.value = p.nickname;
      localStorage.setItem("nickname", p.nickname);
    }
    if (p.level) level.value = p.level;
  } catch (e) {
    /* ignore */
  }
}

async function doLogin() {
  try {
    const name = nickInput.value.trim() || "Learner";
    const res = await authApi.login(name);
    setToken(res.access_token);
    nickname.value = res.user?.nickname || name;
    level.value = res.user?.level || "beginner";
    isLoggedIn.value = true;
    localStorage.setItem("nickname", nickname.value);
    showSuccessToast("欢迎！");
    loadSettings();
  } catch (e) {
    showToast("登录失败");
  }
}

function doLogout() {
  isLoggedIn.value = false;
  clearToken();
  showToast("已退出");
}

function noImplement() {
  showToast("开发中");
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
    showToast("请先登录");
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
    showSuccessToast("已保存");
  } catch (e) {
    showToast("保存失败");
  }
}
</script>

<style lang="scss" scoped>
.profile-page {
  min-height: 100vh;
  background: #f5f6fa;
  padding-bottom: 60px;
}

.profile-header {
  background: linear-gradient(135deg, #4a90d9, #6db3f2);
  padding: 32px 20px 28px;
  text-align: center;

  .avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    margin: 0 auto 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36px;
    border: 3px solid rgba(255, 255, 255, 0.4);
  }

  .nickname {
    font-size: 21px;
    font-weight: 700;
    color: #fff;
  }

  .level {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.75);
    margin-top: 4px;
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

.stats-section {
  margin-top: -18px;
  border-radius: 16px;
  position: relative;
  z-index: 1;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-top: 12px;
}

.stat-item {
  text-align: center;
  padding: 6px 0;

  .stat-num {
    display: block;
    font-size: 22px;
    font-weight: 700;
    color: #4a90d9;
  }

  .stat-label {
    display: block;
    font-size: 11px;
    color: #999;
    margin-top: 2px;
  }
}

.goal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;

  .goal-value {
    font-size: 14px;
    color: #4a90d9;
    font-weight: 600;
  }
}

.goal-tip {
  font-size: 11px;
  color: #999;
  margin-top: 8px;
}

.menu-section {
  margin: 14px 0 0;
}

.login-area {
  padding: 20px 14px;
}

.login-card {
  background: #fff;
  border-radius: 14px;
  padding: 24px 20px;
  text-align: center;

  .login-title {
    font-size: 19px;
    font-weight: 700;
    color: #333;
  }

  .login-sub {
    font-size: 12px;
    color: #999;
    margin-top: 6px;
  }

  .login-hint {
    font-size: 11px;
    color: #b0b0b0;
    margin-top: 10px;
  }
}

.settings-dialog {
  .settings-title {
    font-size: 18px;
    font-weight: 600;
    color: #333;
    text-align: center;
    margin-bottom: 14px;
  }

  .settings-source {
    background: #e8f4ff;
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 14px;

    .settings-source-text {
      font-size: 12px;
      color: #2b6cb0;
    }
  }

  .settings-form {
    .settings-label {
      font-size: 13px;
      color: #666;
      margin: 10px 0 6px;
    }

    .settings-tip {
      font-size: 11px;
      color: #999;
      margin-top: 10px;
    }
  }

  .settings-actions {
    display: flex;
    gap: 10px;
    margin-top: 18px;

    :deep(.van-button) {
      flex: 1;
    }
  }
}
</style>
