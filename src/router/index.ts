import { createRouter, createWebHashHistory } from "vue-router";

/**
 * 路由配置（hash 模式，H5 静态部署无需服务端 rewrite）：
 * - meta.tab = true 的页面显示底部 TabBar 并被 keep-alive 缓存
 * - meta.title 用于 afterEach 统一设置 document.title
 */
const routes = [
  { path: "/", redirect: "/home" },
  {
    path: "/home",
    name: "home",
    component: () => import("@/pages/home.vue"),
    meta: { tab: true, title: "首页" },
  },
  {
    path: "/scenarios",
    name: "scenarios",
    component: () => import("@/pages/scenarios.vue"),
    meta: { tab: true, title: "场景" },
  },
  {
    path: "/learning",
    name: "learning",
    component: () => import("@/pages/learning.vue"),
    meta: { tab: true, title: "学习库" },
  },
  {
    path: "/profile",
    name: "profile",
    component: () => import("@/pages/profile.vue"),
    meta: { tab: true, title: "我的" },
  },
  {
    path: "/chat",
    name: "chat",
    component: () => import("@/pages/chat.vue"),
    meta: { tab: false, title: "AI 对话" },
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

/** 路由切换后统一设置浏览器标题："{页面名} · AI English Tutor" */
router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · AI English Tutor` : "AI English Tutor";
});

export default router;
