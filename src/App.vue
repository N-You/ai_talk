<template>
  <div class="app-shell">
    <router-view v-slot="{ Component }">
      <keep-alive v-if="$route.meta.tab">
        <component :is="Component" />
      </keep-alive>
      <component v-else :is="Component" />
    </router-view>

    <!-- 底部 TabBar（仅 tab 页显示） -->
    <van-tabbar
      v-if="$route.meta.tab"
      route
      active-color="#4A90D9"
      inactive-color="#999999"
      class="app-tabbar"
    >
      <van-tabbar-item replace to="/home" icon="wap-home-o">首页</van-tabbar-item>
      <van-tabbar-item replace to="/scenarios" icon="chat-o">场景</van-tabbar-item>
      <van-tabbar-item replace to="/learning" icon="bookmark-o">学习库</van-tabbar-item>
      <van-tabbar-item replace to="/profile" icon="user-o">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
// 根组件：路由出口 + 底部导航
</script>

<style lang="scss">
html, body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 14px;
  color: #333;
  background-color: #f5f6fa;
  -webkit-font-smoothing: antialiased;
}

.app-shell {
  height: 100%;
}

.app-tabbar {
  z-index: 999;
}
</style>
