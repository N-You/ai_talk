import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { userApi, setToken as saveToken, getToken } from "@/api";

export const useUserStore = defineStore("user", () => {
  const isLoggedIn = ref(false);
  const nickname = ref("Learner");
  const avatar = ref("");
  const level = ref("beginner");
  const streak = ref(0);

  const isAuthenticated = computed(() => isLoggedIn.value && !!getToken());

  async function fetchProfile() {
    try {
      const profile = await userApi.getProfile();
      nickname.value = profile.nickname;
      avatar.value = profile.avatar || "";
      level.value = profile.level;
      isLoggedIn.value = true;
    } catch {
      isLoggedIn.value = false;
    }
  }

  function login(token: string, user: any) {
    saveToken(token);
    nickname.value = user?.nickname || "Learner";
    avatar.value = user?.avatar || "";
    level.value = user?.level || "beginner";
    isLoggedIn.value = true;
  }

  function logout() {
    saveToken("");
    isLoggedIn.value = false;
    nickname.value = "Learner";
    avatar.value = "";
    level.value = "beginner";
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
