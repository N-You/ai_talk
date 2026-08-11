// API 基础配置（按平台区分：H5 用 localhost，小程序用 127.0.0.1，真机调试改为电脑局域网 IP）
// #ifdef H5
const BASE_URL = "http://localhost:8002";
const WS_URL = "ws://localhost:8002";
// #endif
// #ifdef MP-WEIXIN
const BASE_URL = "http://127.0.0.1:8002";
const WS_URL = "ws://127.0.0.1:8002";
// #endif
// #ifndef H5 || MP-WEIXIN
const BASE_URL = "http://localhost:8002";
const WS_URL = "ws://localhost:8002";
// #endif

export { WS_URL };

interface RequestOptions {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  data?: any;
  header?: Record<string, string>;
}

// Token 管理
let token: string | null = null;

export function setToken(t: string) {
  token = t;
  uni.setStorageSync("token", t);
}

export function getToken(): string {
  if (!token) {
    token = uni.getStorageSync("token") || null;
  }
  return token || "";
}

// 通用请求方法
async function request<T = any>(options: RequestOptions): Promise<T> {
  const { url, method = "GET", data } = options;

  const header: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const t = getToken();
  if (t) {
    header["Authorization"] = `Bearer ${t}`;
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}${url}`,
      method,
      header,
      data,
      success: (res: any) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T);
        } else {
          if (res.statusCode === 401) {
            // 跳转登录
            uni.reLaunch({ url: "/pages/index/index" });
          }
          reject(res.data);
        }
      },
      fail: (err) => {
        uni.showToast({ title: "网络异常", icon: "none" });
        reject(err);
      },
    });
  });
}

// ── API 接口 ──────────────────────────────────

// 认证
export const authApi = {
  login: (nickname: string) =>
    request<{ access_token: string; user: any }>({
      url: "/api/auth/login",
      method: "POST",
      data: { nickname },
    }),
  register: (nickname: string) =>
    request<{ access_token: string; user: any }>({
      url: "/api/auth/register",
      method: "POST",
      data: { nickname },
    }),
};

// 用户
export const userApi = {
  getProfile: () => request<any>({ url: "/api/user/profile" }),
  updateProfile: (data: any) =>
    request<any>({ url: "/api/user/profile", method: "PUT", data }),
  getSettings: () => request<any>({ url: "/api/user/settings" }),
  updateSettings: (data: { apiKey?: string; apiBase?: string; model?: string }) =>
    request<any>({ url: "/api/user/settings", method: "PUT", data }),
};

// 场景
export const scenarioApi = {
  list: (category?: string) =>
    request<any[]>({
      url: `/api/scenarios${category ? `?category=${category}` : ""}`,
    }),
  detail: (id: number) => request<any>({ url: `/api/scenarios/${id}` }),
};

// 对话
export const conversationApi = {
  create: (scenarioId: number) =>
    request<any>({ url: "/api/conversations", method: "POST", data: { scenario_id: scenarioId } }),
  list: () => request<any[]>({ url: "/api/conversations" }),
  detail: (id: number) => request<any>({ url: `/api/conversations/${id}` }),
  end: (id: number, data: any) =>
    request<any>({ url: `/api/conversations/${id}/end`, method: "PUT", data }),
};

// 学习库
export const learningApi = {
  list: (params?: { page?: number; size?: number; type?: string; status?: string }) => {
    let qs = "";
    if (params) {
      qs = "?" + Object.entries(params)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v}`)
        .join("&");
    }
    return request<any>({ url: `/api/learning-items${qs}` });
  },
  add: (content: string) =>
    request<any>({ url: "/api/learning-items", method: "POST", data: { content } }),
  detail: (id: number) => request<any>({ url: `/api/learning-items/${id}` }),
  delete: (id: number) =>
    request<any>({ url: `/api/learning-items/${id}`, method: "DELETE" }),
  review: (id: number, result: string) =>
    request<any>({
      url: `/api/learning-items/${id}/review`,
      method: "POST",
      data: { result },
    }),
};
