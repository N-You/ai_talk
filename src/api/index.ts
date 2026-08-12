// API 基础配置（按平台区分：H5 走同源相对路径，由 nginx/vite 代理 /api 与 /ws；小程序用 127.0.0.1，真机调试改为电脑局域网 IP）
// #ifdef H5
const BASE_URL = "";
const WS_URL = `${location.protocol === "https:" ? "wss://" : "ws://"}${location.host}`;
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

// 语音 (ASR: 录音文件 -> 文本)
// 后端端点: POST /api/speech/transcribe (multipart, 字段名 file), JWT 鉴权
// H5 用原生 fetch + FormData (uniapp alpha 版 H5 的 uploadFile+Blob 直传有丢内容 bug);
// App/小程序用 uni.uploadFile (filePath)
// #ifdef H5
export const speechApi = {
  transcribe: async (
    input: { filePath?: string; file?: Blob | any; mimeType?: string },
    language?: string,
  ) => {
    const t = getToken();
    const form = new FormData();

    if (input.file) {
      const ext =
        (input.mimeType ?? "audio/webm").split("/")[1]?.split(";")[0] || "webm";
      form.append("file", input.file, `record_${Date.now()}.${ext}`);
    } else if (input.filePath) {
      // blob: URL 或 data URL -> 转 Blob
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
    if (resp.status === 401) uni.reLaunch({ url: "/pages/index/index" });
    throw data;
  },
  // TTS: 文本 -> 音频 Blob (H5 用 Blob URL 播放)
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
    if (resp.status === 401) uni.reLaunch({ url: "/pages/index/index" });
    if (!resp.ok) throw new Error("tts failed");
    return resp.blob();
  },
};
// #endif
// #ifndef H5
export const speechApi = {
  transcribe: (
    input: { filePath?: string; file?: Blob | any; mimeType?: string },
    language?: string,
  ) =>
    new Promise<any>((resolve, reject) => {
      const header: Record<string, string> = {};
      const t = getToken();
      if (t) header["Authorization"] = `Bearer ${t}`;

      const options: any = {
        url: `${BASE_URL}/api/speech/transcribe`,
        name: "file",
        header,
        formData: language ? { language } : {},
        success: (res: any) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(res.data));
            } catch {
              resolve(res.data);
            }
          } else {
            if (res.statusCode === 401) {
              uni.reLaunch({ url: "/pages/index/index" });
            }
            try {
              reject(JSON.parse(res.data));
            } catch {
              reject(res.data);
            }
          }
        },
        fail: (err) => reject(err),
      };

      if (input.filePath) {
        options.filePath = input.filePath;
      } else if (input.file) {
        // 非 H5 无 Blob 直传, 理论不会走到; 保留防御
        options.file = input.file;
        options.fileType = "audio";
      }
      uni.uploadFile(options);
    }),
  // TTS: 文本 -> 音频 (小程序/App 用 arraybuffer, 后续接 uni.createInnerAudioContext)
  synthesize: (text: string, voice?: string) =>
    new Promise<any>((resolve, reject) => {
      const header: Record<string, string> = { "Content-Type": "application/json" };
      const t = getToken();
      if (t) header["Authorization"] = `Bearer ${t}`;
      uni.request({
        url: `${BASE_URL}/api/speech/tts`,
        method: "POST",
        header,
        data: { text, voice },
        responseType: "arraybuffer",
        success: (res: any) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else {
            if (res.statusCode === 401) uni.reLaunch({ url: "/pages/index/index" });
            reject(res.data);
          }
        },
        fail: reject,
      });
    }),
};
// #endif
