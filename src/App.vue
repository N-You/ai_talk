<template>
  <div class="app-shell">
    <router-view v-slot="{ Component }">
      <keep-alive v-if="$route.meta.tab">
        <component :is="Component" />
      </keep-alive>
      <component v-else :is="Component" />
    </router-view>

    <!-- 底部 TabBar（胶囊样式，还原设计稿） -->
    <nav v-if="$route.meta.tab" class="app-tabbar">
      <div class="tabbar-pill">
        <template v-for="tab in tabs" :key="tab.to">
          <router-link :to="tab.to" class="tab-item" :class="{ active: isActive(tab.to) }">
            <span class="tab-icon" v-html="isActive(tab.to) ? tab.iconActive : tab.icon"></span>
            <span class="tab-label">{{ tab.label }}</span>
          </router-link>
        </template>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from "vue-router";

const route = useRoute();

const tabs = [
  {
    to: "/home",
    label: "首页",
    icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 9.5L10 3.5L17 9.5V16.5C17 16.8 16.8 17 16.5 17H12.5V12.5H7.5V17H3.5C3.2 17 3 16.8 3 16.5V9.5Z" stroke="#9DB8B1" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    iconActive:
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 9.5L10 3.5L17 9.5V16.5C17 16.8 16.8 17 16.5 17H12.5V12.5H7.5V17H3.5C3.2 17 3 16.8 3 16.5V9.5Z" fill="#FFFFFF"/></svg>',
  },
  {
    to: "/scenarios",
    label: "练习",
    icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="7.5" stroke="#9DB8B1" stroke-width="1.8"/><path d="M10 5.5V10L13 12" stroke="#9DB8B1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    iconActive:
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="7.5" stroke="#FFFFFF" stroke-width="2"/><path d="M10 5.5V10L13 12" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  },
  {
    to: "/learning",
    label: "生词本",
    icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 3.5H14.5C15.9 3.5 17 4.6 17 6V17C17 17.3 16.8 17.5 16.5 17.5H5.5C4.7 17.5 4 16.8 4 16V3.5Z" stroke="#9DB8B1" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 7H13.5M7 10H13.5" stroke="#9DB8B1" stroke-width="1.8" stroke-linecap="round"/></svg>',
    iconActive:
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 3.5H14.5C15.9 3.5 17 4.6 17 6V17C17 17.3 16.8 17.5 16.5 17.5H5.5C4.7 17.5 4 16.8 4 16V3.5Z" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 7H13.5M7 10H13.5" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/></svg>',
  },
  {
    to: "/profile",
    label: "我的",
    icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="6.5" r="3.2" stroke="#9DB8B1" stroke-width="1.8"/><path d="M3.5 17C4.5 13.8 7 12.5 10 12.5C13 12.5 15.5 13.8 16.5 17" stroke="#9DB8B1" stroke-width="1.8" stroke-linecap="round"/></svg>',
    iconActive:
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="6.5" r="3.2" stroke="#FFFFFF" stroke-width="1.8"/><path d="M3.5 17C4.5 13.8 7 12.5 10 12.5C13 12.5 15.5 13.8 16.5 17" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/></svg>',
  },
];

function isActive(to: string) {
  return route.path === to;
}
</script>

<style lang="scss">
@use "./styles/theme.scss";

html,
body {
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB",
    "Microsoft YaHei", sans-serif;
  font-size: 14px;
  color: var(--c-text);
  background-color: var(--c-mint-bg);
  -webkit-font-smoothing: antialiased;
}

.app-shell {
  height: 100%;
}

/* 底部胶囊 TabBar */
.app-tabbar {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: calc(16px + env(safe-area-inset-bottom));
  z-index: 999;

  .tabbar-pill {
    display: flex;
    align-items: center;
    height: 66px;
    padding: 6px;
    border-radius: 33px;
    background: #fff;
    box-shadow: var(--shadow-tab);
  }

  .tab-item {
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border-radius: 27px;
    color: var(--c-text-faint);
    text-decoration: none;
    transition: all 0.2s ease;

    .tab-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 20px;
    }

    .tab-label {
      font-size: 10px;
      letter-spacing: 0.3px;
    }

    &.active {
      background: var(--c-primary);
      color: #fff;
      box-shadow: 0 6px 16px rgba(13, 186, 156, 0.35);

      .tab-label {
        font-weight: 600;
      }
    }
  }
}
</style>
