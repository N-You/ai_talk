import { createRouter, createWebHashHistory } from "vue-router";

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

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · AI English Tutor` : "AI English Tutor";
});

export default router;
