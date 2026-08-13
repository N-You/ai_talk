import router from "@/router";
import { showToast } from "vant";

// API 基础配置（H5：走同源相对路径，由 vite/nginx 代理 /api 与 /ws 到后端）
const BASE_URL = "";
export const WS_URL = `${location.protocol === "https:" ? "wss://" : "ws://"}${location.host}`;

interface RequestOptions {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  data?: any;
}

// Token 管理（localStorage 持久化）
const TOKEN_KEY = "token";
let token: string | null = null;

export function setToken(t: string) {
  token = t;
  localStorage.setItem(TOKEN_KEY, t);
}

export function getToken(): string {
  if (token === null) {
    token = localStorage.getItem(TOKEN_KEY);
  }
  return token || "";
}

export function clearToken() {
  token = null;
  localStorage.removeItem(TOKEN_KEY);
}

// 通用请求方法（fetch 封装）
async function request<T = any>(options: RequestOptions): Promise<T> {
  const { url, method = "GET", data } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const t = getToken();
  if (t) headers["Authorization"] = `Bearer ${t}`;

  let resp: Response;
  try {
    resp = await fetch(`${BASE_URL}${url}`, {
      method,
      headers,
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  } catch {
    showToast("网络异常，请检查连接");
    throw new Error("network error");
  }

  if (resp.status === 401) {
    clearToken();
    router.replace("/profile");
    throw new Error("unauthorized");
  }

  const text = await resp.text();
  const json = text ? JSON.parse(text) : null;

  if (resp.status >= 200 && resp.status < 300) return json as T;
  throw json ?? new Error(`HTTP ${resp.status}`);
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
      qs =
        "?" +
        Object.entries(params)
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

// 语音 (ASR: 录音文件 -> 文本)
export const speechApi = {
  transcribe: async (
    input: { filePath?: string; file?: Blob | any; mimeType?: string },
    language?: string,
  ) => {
    const t = getToken();
    const form = new FormData();

    if (input.file) {
      const ext = (input.mimeType ?? "audio/webm").split("/")[1]?.split(";")[0] || "webm";
      form.append("file", input.file, `record_${Date.now()}.${ext}`);
    } else if (input.filePath) {
      const blob = await fetch(input.filePath).then((r) => r.blob());
      form.append("file", blob, `record_${Date.now()}.${blob.type.split("/")[1] || "webm"}`);
    }
    if (language) form.append("language", language);

    const resp = await fetch(`${BASE_URL}/api/speech/transcribe`, {
      method: "POST",
      headers: t ? { Authorization: `Bearer ${t}` } : {},
      body: form,
    });
    const data = await resp.json().catch(() => ({}));
    if (resp.status >= 200 && resp.status < 300) return data;
    if (resp.status === 401) {
      clearToken();
      router.replace("/profile");
    }
    throw data;
  },
  // TTS: 文本 -> 音频 Blob
  synthesize: async (text: string, voice?: string): Promise<Blob> => {
    const t = getToken();
    const resp = await fetch(`${BASE_URL}/api/speech/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
      body: JSON.stringify({ text, voice }),
    });
    if (resp.status === 401) {
      clearToken();
      router.replace("/profile");
    }
    if (!resp.ok) throw new Error("tts failed");
    return resp.blob();
  },
};
