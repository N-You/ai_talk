/**
 * 语言配置表 —— 语音识别（ASR）/ 语音合成（TTS）的多语言支持（2026-08-22）。
 *
 * 设计原则（渐进披露 + 配置化）：
 * - 默认"自动识别"（auto，2026-08-22 修复）：中英混说是中文母语学习者常态。
 *   强制 language=en 会把中文"听译"成英文；后端已用 language_hints=["en","zh"]
 *   （候选语种提示，SPEECH_ASR_LANGUAGE_HINTS）兼顾"短英文词"与"中文"
 * - 纯单语种场景（几乎只说英语/中文）可在「我的」页切 en/zh，强制提升准确率
 * - 新增语言 = 在 LANGUAGE_CONFIGS 加一行，零代码改动
 *
 * 面向中文母语群体：词义解释（meaningLang）固定为 zh（后端 explain-word 已写死中文释义），
 * 即"用中文解释目标语言词汇"。
 */
export interface LanguageConfig {
  /** 存储值：写入 user.settings.language 的 code */
  code: string;
  /** 界面显示名（中文） */
  label: string;
  /** 传给 DashScope asr_options.language 的语言码（undefined/空 = 自动检测）。
   *  官方文档：单一语种显式指定可提升准确率；中英混合留空。 */
  asrLang?: string;
  /** 该语言的推荐 TTS 音色 id（可选；留空用后端默认音色，避免引入未验证的音色） */
  ttsVoice?: string;
  /** 词义解释的目标语言（本产品面向中文母语，固定 zh） */
  meaningLang: string;
}

export const LANGUAGE_CONFIGS: LanguageConfig[] = [
  { code: "auto", label: "自动识别", asrLang: undefined, meaningLang: "zh" },
  { code: "en", label: "英语", asrLang: "en", meaningLang: "zh" },
  { code: "zh", label: "中文", asrLang: "zh", meaningLang: "zh" },
  // ── 未来扩展示例（加一行即可，无需改任何逻辑）──
  // { code: "ja", label: "日语", asrLang: "ja", meaningLang: "zh" },
  // { code: "ko", label: "韩语", asrLang: "ko", meaningLang: "zh" },
  // { code: "fr", label: "法语", asrLang: "fr", meaningLang: "zh" },
];

/** 按 code 取语言配置；未知 code 回退"自动识别" */
export function getLanguageConfig(code?: string): LanguageConfig {
  return LANGUAGE_CONFIGS.find((l) => l.code === code) ?? LANGUAGE_CONFIGS[0];
}

/** 解析出传给 ASR 的语言码：auto/未知 → undefined（自动检测）；否则返回语言码 */
export function resolveAsrLang(code?: string): string | undefined {
  return getLanguageConfig(code).asrLang;
}
