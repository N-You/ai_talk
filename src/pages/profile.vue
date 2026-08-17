<template>
  <div class="profile-page">
    <div class="bg-blob"></div>

    <!-- 顶部栏 -->
    <header class="page-header">
      <span class="page-title">我的</span>
      <div class="icon-btn" @click="noImplement">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="9" cy="9" r="2.5" stroke="#0DBA9C" stroke-width="1.6"/>
          <path d="M14.5 9L13 8M5 8L3.5 9M3.5 9L4.5 10.5M14.5 9L13.5 10.5M9 14.5V16M9 2V3.5" stroke="#0DBA9C" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </div>
    </header>

    <!-- 用户卡片 -->
    <section class="user-card" ref="userRef">
      <div class="avatar">
        <img :src="iconMascotStand" width="44" height="44" alt="avatar" />
      </div>
      <div class="user-info">
        <div class="user-name-row">
          <span class="user-name">{{ isLoggedIn ? nickname : "未登录" }}</span>
          <span class="pro-badge" v-if="isLoggedIn">PRO</span>
        </div>
        <div class="user-level">{{ isLoggedIn ? "Lv.3 进阶学习者 · 已坚持 7 天" : "登录后同步学习数据" }}</div>
        <div class="user-edit" v-if="isLoggedIn">编辑个人资料 ></div>
        <div class="user-edit" v-else @click="showLogin">点击登录 ></div>
      </div>
    </section>

    <!-- 学习目标 -->
    <section class="card goal-card" v-if="isLoggedIn">
      <div class="goal-head">
        <span class="goal-title">学习目标</span>
        <span class="goal-tip">每天一点点</span>
      </div>
      <div class="goal-row">
        <div class="goal-left">
          <div class="goal-name">每日对话时长</div>
          <div class="goal-desc">每天至少练习 15 分钟</div>
        </div>
        <div class="stepper">
          <button class="step-btn step-minus" @click="goalMinutes = Math.max(5, goalMinutes - 5)">−</button>
          <span class="step-val">{{ goalMinutes }} 分</span>
          <button class="step-btn step-plus" @click="goalMinutes = Math.min(60, goalMinutes + 5)">＋</button>
        </div>
      </div>
      <div class="goal-divider"></div>
      <div class="goal-row">
        <div class="goal-left">
          <div class="goal-name">每日新词目标</div>
          <div class="goal-desc">掌握 5 个新单词</div>
        </div>
        <div class="stepper">
          <button class="step-btn step-minus" @click="goalWords = Math.max(1, goalWords - 1)">−</button>
          <span class="step-val">{{ goalWords }} 词</span>
          <button class="step-btn step-plus" @click="goalWords = Math.min(30, goalWords + 1)">＋</button>
        </div>
      </div>
    </section>

    <!-- AI 模型配置 -->
    <section class="card ai-card">
      <div class="ai-head">
        <span class="ai-title">AI 模型配置</span>
        <span class="ai-tip">个性化你的老师</span>
      </div>

      <!-- 模型选择 -->
      <div class="model-row">
        <button
          v-for="m in models"
          :key="m.key"
          class="model-item"
          :class="{ active: aiModel === m.key }"
          @click="selectModel(m)"
        >
          <span class="model-name">{{ m.name }}</span>
          <span class="model-tag">{{ m.tag }}</span>
        </button>
        <button class="model-item model-add" @click="openSettings">
          <span class="model-add-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 3V13M3 8H13" stroke="#0DBA9C" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="model-tag">导入 API Key</span>
        </button>
      </div>

      <!-- 默认模型说明 -->
      <div class="model-hint" v-if="settingsSource === 'env' || !isLoggedIn">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="7" cy="7" r="5.5" stroke="#0DBA9C" stroke-width="1.4"/>
          <path d="M5.5 5.5C5.5 4.7 6.2 4 7 4C7.8 4 8.5 4.7 8.5 5.5C8.5 6.5 7 6.5 7 7.5" stroke="#0DBA9C" stroke-width="1.4" stroke-linecap="round"/>
          <circle cx="7" cy="9.5" r="0.5" fill="#0DBA9C"/>
        </svg>
        <span>当前使用服务端默认模型，导入 API Key 可添加自定义模型</span>
      </div>
      <div class="model-hint model-hint-user" v-else-if="settingsSource === 'user'">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2.5 7.5L5.5 10.5L11.5 4" stroke="#0DBA9C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>已使用你的自定义模型配置</span>
      </div>

      <!-- 语速滑块 -->
      <div class="setting-block">
        <div class="setting-head">
          <span class="setting-label">AI 语速</span>
          <span class="setting-value">正常 1.0x</span>
        </div>
        <van-slider v-model="speed" :min="0.5" :max="1.5" :step="0.1" :bar-height="4" active-color="#0DBA9C" />
      </div>

      <!-- 口音偏好 -->
      <div class="setting-row">
        <div class="setting-left">
          <div class="setting-label">口音偏好</div>
          <div class="setting-desc">选择 AI 老师发音风格</div>
        </div>
        <div class="accent-picker" @click="cycleAccent">
          <span>{{ accentLabel }}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 3.5L5 6.5L8 3.5" stroke="#0B3B33" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>

      <!-- 对话风格 Temperature -->
      <div class="setting-block">
        <div class="setting-head">
          <span class="setting-label">对话风格 (Temperature)</span>
          <span class="setting-value">{{ temperature }} · {{ temperatureLabel }}</span>
        </div>
        <van-slider v-model="temperature" :min="0" :max="1.5" :step="0.1" :bar-height="4" active-color="#0DBA9C" />
      </div>

      <!-- 高级配置入口 -->
      <div class="setting-row" @click="openSettings">
        <div class="setting-left">
          <div class="setting-label">API 高级配置</div>
          <div class="setting-desc">自定义 API Key / 模型地址</div>
        </div>
        <div class="arrow-right">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 3L9 7L5 11" stroke="#9DB8B1" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    </section>

    <!-- 更多设置 -->
    <section class="card list-card">
      <div class="list-item">
        <div class="list-left">
          <span class="list-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 9.5C3 7 4 5 4 4.5C4 3 5 2 7 2C9 2 10 3 10 4.5C10 5 11 7 11 9.5H3Z" stroke="#0DBA9C" stroke-width="1.4" stroke-linejoin="round"/>
              <path d="M6 11C6.2 11.6 6.6 12 7 12C7.4 12 7.8 11.6 8 11" stroke="#0DBA9C" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="list-title">学习提醒</span>
        </div>
        <div class="switch" :class="{ on: remindOn }" @click="remindOn = !remindOn">
          <span class="switch-knob"></span>
        </div>
      </div>
      <div class="list-item" @click="noImplement">
        <div class="list-left">
          <span class="list-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="6" width="8" height="6" rx="1.5" stroke="#0DBA9C" stroke-width="1.4"/>
              <path d="M5 6V4.5C5 3.5 5.5 3 7 3C8.5 3 9 3.5 9 4.5V6" stroke="#0DBA9C" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="list-title">隐私与数据</span>
        </div>
        <div class="arrow-right">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 3L9 7L5 11" stroke="#9DB8B1" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
      <div class="list-item" @click="noImplement">
        <div class="list-left">
          <span class="list-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="7" cy="7" r="5.5" stroke="#0DBA9C" stroke-width="1.4"/>
              <path d="M5.5 5.5C5.5 4.7 6.2 4 7 4C7.8 4 8.5 4.7 8.5 5.5C8.5 6.5 7 6.5 7 7.5" stroke="#0DBA9C" stroke-width="1.4" stroke-linecap="round"/>
              <circle cx="7" cy="9.5" r="0.5" fill="#0DBA9C"/>
            </svg>
          </span>
          <span class="list-title">帮助与反馈</span>
        </div>
        <div class="arrow-right">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 3L9 7L5 11" stroke="#9DB8B1" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    </section>

    <!-- 退出登录 -->
    <div class="logout-area" v-if="isLoggedIn">
      <button class="logout-btn" @click="doLogout">退出登录</button>
    </div>

    <!-- 登录弹窗 -->
    <van-popup v-model:show="showLoginPopup" position="bottom" round :style="{ padding: '20px' }">
      <div class="login-card">
        <div class="login-title">欢迎使用</div>
        <div class="login-sub">输入名字开始你的英语之旅</div>
        <van-field v-model="nickInput" placeholder="你的名字" clearable style="margin: 16px 0" />
        <van-button block size="large" type="primary" @click="doLogin">进入 AI English Tutor</van-button>
        <div class="login-hint">H5 模式，无需注册</div>
      </div>
    </van-popup>

    <!-- AI 模型配置弹窗 -->
    <van-popup v-model:show="showSettings" position="bottom" round :style="{ padding: '20px' }">
      <div class="settings-dialog">
        <div class="settings-title">API 高级配置</div>

        <div class="settings-source" v-if="settingsSource">
          <span class="settings-source-text">
            {{ settingsSource === "user" ? "当前使用你配置的模型" : settingsSource === "env" ? "当前使用服务端默认模型（.env 配置）" : "" }}
          </span>
        </div>

        <div class="settings-form">
          <div class="settings-label">API 地址</div>
          <van-field v-model="aiSettings.apiBase" placeholder="https://open.bigmodel.cn/api/paas/v4" clearable />
          <div class="settings-label">API Key</div>
          <van-field v-model="aiSettings.apiKey" placeholder="在各平台官网购买模型后获取" clearable type="password" />
          <div class="settings-label">模型名称</div>
          <van-field v-model="aiSettings.model" placeholder="glm-4.5-air" clearable />
          <div class="settings-tip">默认仅提供智谱 GLM-4.5-Air；填写 API Key 后可配置任意兼容模型（如 GPT / Claude / DeepSeek 等），保存后会自动出现在模型列表中。</div>
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
import { ref, reactive, computed, onMounted, onActivated } from "vue";
import { showToast, showSuccessToast } from "vant";
import gsap from "gsap";
import { authApi, userApi, getToken, setToken, clearToken } from "@/api";
import iconMascotStand from "@/assets/icons/mascot-stand.svg";

const isLoggedIn = ref(false);
const nickname = ref("Learner");
const goalMinutes = ref(15);
const goalWords = ref(5);
const remindOn = ref(true);
const nickInput = ref("");
const showLoginPopup = ref(false);
const showSettings = ref(false);
const settingsSource = ref(""); // env / user / none
const aiSettings = reactive({ apiBase: "", apiKey: "", model: "" });

// AI 模型选择：默认仅智谱 GLM-4.5-Air（服务端 .env 配置），
// 用户导入 API Key 后可动态加入自定义模型
const aiModel = ref("glm-4.5-air");
const models = ref([
  { key: "glm-4.5-air", name: "智谱 GLM-4.5-Air", tag: "默认", isCustom: false },
]);

// 选中模型（默认走服务端配置；自定义模型记录其 apiKey/apiBase/model）
function selectModel(m: { key: string; name: string; tag: string; isCustom: boolean }) {
  aiModel.value = m.key;
  if (m.isCustom) {
    const custom = customModels.value.find((c) => c.key === m.key);
    if (custom) {
      aiSettings.apiKey = custom.apiKey;
      aiSettings.apiBase = custom.apiBase;
      aiSettings.model = custom.model;
    }
    settingsSource.value = "user";
  } else {
    aiSettings.apiKey = "";
    aiSettings.apiBase = "";
    aiSettings.model = "";
    settingsSource.value = "env";
  }
  localStorage.setItem("selectedModel", aiModel.value);
}

// 用户已保存的自定义模型列表
const customModels = ref<
  { key: string; name: string; tag: string; apiKey: string; apiBase: string; model: string }[]
>([]);

// 将已保存的自定义模型合并进可选项
function syncCustomModels(s: { apiKey?: string; apiBase?: string; model?: string }) {
  if (!s.apiKey || !s.model) return;
  const key = s.model;
  const exists = customModels.value.some((c) => c.key === key);
  if (!exists) {
    customModels.value.push({
      key,
      name: key.length > 12 ? key.slice(0, 12) + "…" : key,
      tag: "自定义",
      apiKey: s.apiKey,
      apiBase: s.apiBase || "",
      model: s.model,
    });
    models.value = [
      { key: "glm-4.5-air", name: "智谱 GLM-4.5-Air", tag: "默认", isCustom: false },
      ...customModels.value.map((c) => ({ key: c.key, name: c.name, tag: c.tag, isCustom: true })),
    ];
  }
  // 恢复上次选中的模型
  const saved = localStorage.getItem("selectedModel");
  if (saved && models.value.some((m) => m.key === saved)) {
    aiModel.value = saved;
  }
}

// 语速 / 温度
const speed = ref(1);
const temperature = ref(0.7);
const accents = ["美式", "英式", "澳式"];
const accentIdx = ref(0);
const accentLabel = computed(() => accents[accentIdx.value % accents.length]);

const temperatureLabel = computed(() => {
  if (temperature.value < 0.4) return "严谨";
  if (temperature.value <= 1) return "平衡";
  return "发散";
});

const userRef = ref<HTMLElement | null>(null);

// GSAP：用户卡入场（每次激活重放）
function playIntro() {
  gsap.fromTo(userRef.value, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });
}

onMounted(() => {
  if (getToken()) {
    isLoggedIn.value = true;
    loadSettings();
  }
});

// keep-alive 缓存下，每次切回该 tab 重新播放入场动画（首次挂载也会触发）
onActivated(() => {
  playIntro();
});

/** 显示登录弹窗（已登录则不弹） */
function showLogin() {
  if (isLoggedIn.value) return;
  nickInput.value = "";
  showLoginPopup.value = true;
}

/** 昵称登录：保存 token + 本地昵称缓存，成功后回填 AI 配置 */
async function doLogin() {
  try {
    const name = nickInput.value.trim() || "Learner";
    const res = await authApi.login(name);
    setToken(res.access_token);
    nickname.value = res.user?.nickname || name;
    isLoggedIn.value = true;
    localStorage.setItem("nickname", nickname.value);
    showLoginPopup.value = false;
    showSuccessToast("欢迎！");
    loadSettings();
  } catch (e) {
    showToast("登录失败");
  }
}

/** 退出登录：清 token + 清本地昵称缓存 */
function doLogout() {
  isLoggedIn.value = false;
  clearToken();
  localStorage.removeItem("nickname");
  showToast("已退出");
}

/** 占位：未实现功能统一提示"开发中" */
function noImplement() {
  showToast("开发中");
}

/** 点击循环切换口音偏好（美式→英式→澳式） */
function cycleAccent() {
  accentIdx.value = (accentIdx.value + 1) % accents.length;
}

/** 打开 API 高级配置弹窗 */
function openSettings() {
  showSettings.value = true;
}

/**
 * 拉取用户 AI 配置：
 * 有自定义配置 → 回填表单 + settingsSource=user + 合并自定义模型列表；
 * 否则 settingsSource=env（服务端 .env 默认）。
 */
async function loadSettings() {
  try {
    const s = await userApi.getSettings();
    const hasUser = s.apiKey || s.apiBase || s.model;
    if (hasUser) {
      if (s.apiBase) aiSettings.apiBase = s.apiBase;
      if (s.apiKey) aiSettings.apiKey = s.apiKey;
      if (s.model) aiSettings.model = s.model;
      settingsSource.value = "user";
      syncCustomModels(s);
    } else {
      settingsSource.value = "env";
    }
  } catch (e) {
    settingsSource.value = "none";
  }
}

/** 保存 AI 配置到服务端（users.settings），并把自定义模型并入可选项 */
async function saveSettings() {
  if (!getToken()) {
    showToast("请先登录");
    return;
  }
  try {
    const payload = {
      apiKey: aiSettings.apiKey.trim(),
      apiBase: aiSettings.apiBase.trim(),
      model: aiSettings.model.trim(),
    };
    await userApi.updateSettings(payload);
    settingsSource.value = "user";
    showSettings.value = false;
    showSuccessToast("已保存");
    syncCustomModels(payload);
  } catch (e) {
    showToast("保存失败");
  }
}
</script>

<style lang="scss" scoped>
.profile-page {
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
  top: -60px;
  right: -70px;
  width: 230px;
  height: 230px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(13, 186, 156, 0.24), rgba(46, 214, 178, 0.05) 70%);
  filter: blur(30px);
  pointer-events: none;
}

/* 用户卡片 */
.user-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  height: 110px;
  padding: 18px;
  border-radius: var(--radius-md);
  background: var(--grad-brand);
  box-shadow: var(--shadow-float);
  box-sizing: border-box;

  .avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: #fff;
    color: var(--c-primary);
    font-size: 28px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(0, 60, 50, 0.2);
  }

  .user-info {
    flex: 1;
    min-width: 0;

    .user-name-row {
      display: flex;
      align-items: center;
      gap: 8px;

      .user-name {
        font-size: 18px;
        font-weight: 700;
        color: #fff;
      }

      .pro-badge {
        display: inline-flex;
        align-items: center;
        height: 18px;
        padding: 0 6px;
        border-radius: 9px;
        background: var(--c-gold);
        color: var(--c-text);
        font-size: 9px;
        font-weight: 700;
      }
    }

    .user-level {
      font-size: 11px;
      color: #e6fff7;
      margin-top: 6px;
    }

    .user-edit {
      font-size: 10px;
      color: #fff;
      margin-top: 4px;
      cursor: pointer;
    }
  }
}

/* 通用卡片 */
.card {
  position: relative;
  background: var(--c-card);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  margin-top: 16px;
  padding: 18px;
}

/* 学习目标 */
.goal-head,
.ai-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;

  .goal-title,
  .ai-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--c-text);
  }

  .goal-tip,
  .ai-tip {
    font-size: 11px;
    color: var(--c-text-sub);
  }
}

.goal-row {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .goal-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--c-text);
  }

  .goal-desc {
    font-size: 10px;
    color: var(--c-text-faint);
    margin-top: 4px;
  }

  .stepper {
    display: flex;
    align-items: center;
    height: 32px;
    border-radius: 16px;
    background: var(--c-mint-bg);

    .step-btn {
      width: 28px;
      height: 28px;
      border-radius: 14px;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: 700;
      transition: transform 0.12s ease;

      &:active {
        transform: scale(0.9);
      }
    }

    .step-minus {
      background: rgba(127, 224, 200, 0.35);
      color: var(--c-primary-deep);
    }

    .step-plus {
      background: var(--c-primary);
      color: #fff;
    }

    .step-val {
      min-width: 52px;
      text-align: center;
      font-size: 13px;
      font-weight: 600;
      color: var(--c-text);
    }
  }
}

.goal-divider {
  height: 1px;
  background: var(--c-divider);
  margin: 14px 0;
}

/* AI 配置 */
.model-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;

  .model-item {
    flex: 1 1 calc(33.33% - 8px);
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    height: 56px;
    border-radius: 12px;
    border: 1.5px solid transparent;
    background: var(--c-mint-bg);
    cursor: pointer;
    transition: all 0.18s ease;

    .model-name {
      font-size: 12px;
      font-weight: 700;
      color: var(--c-text-sub);
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 0 4px;
    }

    .model-tag {
      font-size: 9px;
      color: var(--c-text-faint);
    }

    &.active {
      background: rgba(13, 186, 156, 0.12);
      border-color: var(--c-primary);

      .model-name,
      .model-tag {
        color: var(--c-primary-deep);
      }
    }
  }

  /* 导入 API Key 入口：虚线框样式 */
  .model-add {
    background: transparent;
    border: 1.5px dashed var(--c-border);
    gap: 4px;

    .model-add-icon {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .model-tag {
      color: var(--c-primary);
      font-size: 10px;
      font-weight: 600;
    }

    &:active {
      background: rgba(13, 186, 156, 0.06);
    }
  }
}

/* 默认模型 / 自定义模型说明 */
.model-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(13, 186, 156, 0.08);
  font-size: 11px;
  color: var(--c-primary-deep);
  line-height: 1.5;

  &.model-hint-user {
    background: rgba(127, 224, 200, 0.18);
  }
}

.setting-block {
  margin-top: 16px;

  .setting-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;

    .setting-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--c-text);
    }

    .setting-value {
      font-size: 11px;
      color: var(--c-primary);
      font-weight: 500;
    }
  }
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0 2px;
  cursor: pointer;

  .setting-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--c-text);
  }

  .setting-desc {
    font-size: 10px;
    color: var(--c-text-faint);
    margin-top: 3px;
  }

  .accent-picker {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 14px;
    border-radius: 16px;
    background: var(--c-mint-bg);
    font-size: 12px;
    font-weight: 600;
    color: var(--c-text);
  }
}

.arrow-right {
  display: flex;
  align-items: center;
}

/* 更多设置 */
.list-card {
  padding: 6px 0;

  .list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 52px;
    padding: 0 14px;
    cursor: pointer;

    .list-left {
      display: flex;
      align-items: center;
      gap: 10px;

      .list-icon {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        background: rgba(127, 224, 200, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .list-title {
        font-size: 13px;
        color: var(--c-text);
      }
    }

    .switch {
      width: 44px;
      height: 26px;
      border-radius: 13px;
      background: var(--c-divider);
      display: flex;
      align-items: center;
      padding: 0 3px;
      transition: all 0.2s ease;
      cursor: pointer;

      .switch-knob {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.16);
        transition: transform 0.2s ease;
      }

      &.on {
        background: var(--c-primary);

        .switch-knob {
          transform: translateX(18px);
        }
      }
    }
  }
}

.logout-area {
  padding: 24px 0 8px;

  .logout-btn {
    width: 100%;
    height: 48px;
    border-radius: var(--radius-pill);
    border: 1.5px solid var(--c-border);
    background: var(--c-card);
    color: var(--c-red-text);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.15s ease;

    &:active {
      transform: scale(0.98);
    }
  }
}

.login-card {
  text-align: center;

  .login-title {
    font-size: 19px;
    font-weight: 700;
    color: var(--c-text);
  }

  .login-sub {
    font-size: 12px;
    color: var(--c-text-sub);
    margin-top: 6px;
  }

  .login-hint {
    font-size: 11px;
    color: var(--c-text-faint);
    margin-top: 10px;
  }
}

.settings-dialog {
  .settings-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--c-text);
    text-align: center;
    margin-bottom: 14px;
  }

  .settings-source {
    background: rgba(13, 186, 156, 0.1);
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 14px;

    .settings-source-text {
      font-size: 12px;
      color: var(--c-primary-deep);
    }
  }

  .settings-form {
    .settings-label {
      font-size: 13px;
      color: var(--c-text-sub);
      margin: 10px 0 6px;
    }

    .settings-tip {
      font-size: 11px;
      color: var(--c-text-faint);
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
