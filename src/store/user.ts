import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { userApi, setToken as saveToken, getToken, clearToken } from "@/api";

/**
 * 用户全局状态（Pinia setup store）。
 * 目前页面各自管理登录态（历史实现），本 store 为后续统一收敛的落点；
 * isAuthenticated 结合内存态与 token 双重判断。
 */
export const useUserStore = defineStore("user", () => {
  const isLoggedIn = ref(false);
  const nickname = ref("Learner");
  const avatar = ref("");
  const level = ref("beginner");
  const streak = ref(0);

  const isAuthenticated = computed(() => isLoggedIn.value && !!getToken());

  /** 拉取服务端用户资料并同步到本地状态（登录后调用） */
  async function fetchProfile() {
    try {
      const profile = await userApi.getProfile();
      nickname.value = profile.nickname;
      avatar.value = profile.avatar || "";
      level.value = profile.level;
      streak.value = profile.streak || 0;
      isLoggedIn.value = true;
    } catch {
      isLoggedIn.value = false;
    }
  }

  /** 登录：保存 token + 写入用户信息 */
  function login(token: string, user: any) {
    saveToken(token);
    nickname.value = user?.nickname || "Learner";
    avatar.value = user?.avatar || "";
    level.value = user?.level || "beginner";
    isLoggedIn.value = true;
  }

  /** 登出：清 token + 重置本地状态 */
  function logout() {
    clearToken();
    isLoggedIn.value = false;
    nickname.value = "Learner";
    avatar.value = "";
    level.value = "beginner";
    streak.value = 0;
  }

  return {
    isLoggedIn,
    nickname,
    avatar,
    level,
    streak,
    isAuthenticated,
    fetchProfile,
    login,
    logout,
  };
});
