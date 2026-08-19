<template>
  <div class="review-page">
    <div class="bg-blob blob-mint"></div>
    <div class="bg-blob blob-pink"></div>

    <!-- 顶部栏 -->
    <header class="page-header">
      <div class="icon-btn" @click="goBack">
        <img :src="iconBack" width="18" height="18" alt="back" />
      </div>
      <span class="page-title">今日练习</span>
      <span class="quit-btn" @click="goBack">退出</span>
    </header>

    <!-- 今日目标条 -->
    <section class="goal-strip">
      <div class="goal-cell">
        <img :src="iconBook" width="18" height="18" alt="new" />
        <div class="goal-cell-text">
          <span class="goal-cell-num">{{ newDoneDisplay }}/{{ daily?.goal ?? 0 }}</span>
          <span class="goal-cell-label">今日新词</span>
        </div>
      </div>
      <div class="goal-cell">
        <img :src="iconClock" width="18" height="18" alt="review" />
        <div class="goal-cell-text">
          <span class="goal-cell-num">{{ daily?.reviews_due ?? 0 }}</span>
          <span class="goal-cell-label">待复习</span>
        </div>
      </div>
      <div class="goal-cell">
        <img :src="iconCheck" width="18" height="18" alt="done" />
        <div class="goal-cell-text">
          <span class="goal-cell-num">{{ reviewsDoneDisplay }}</span>
          <span class="goal-cell-label">已复习</span>
        </div>
      </div>
    </section>

    <!-- 加载中 -->
    <div v-if="phase === 'loading'" class="loading-wrap">
      <van-loading size="24" color="#0DBA9C" vertical>正在准备今天的练习...</van-loading>
    </div>

    <!-- 空状态：今天没有可练习内容 -->
    <div v-else-if="phase === 'empty'" class="empty-wrap">
      <div class="empty-card">
        <img :src="iconTrophy" width="56" height="56" alt="done" />
        <div class="empty-title">今天的任务都完成啦</div>
        <div class="empty-sub">去对话里认识新单词，或去生词本添加内容</div>
        <div class="empty-actions">
          <button class="btn-primary" @click="goHome">返回首页</button>
          <button class="btn-ghost" @click="goLearning">去生词本</button>
        </div>
      </div>
    </div>

    <!-- 答题区 -->
    <template v-else-if="phase === 'quiz'">
      <!-- 进度 -->
      <div class="progress-row">
        <div class="progress-track">
          <span class="progress-fill" :style="{ width: progressPercent + '%' }"></span>
        </div>
        <span class="progress-text">{{ index + 1 }}/{{ queue.length }}</span>
      </div>

      <!-- 单词卡片 -->
      <section class="word-card" ref="cardRef">
        <span class="mode-chip" :class="current?.is_new ? 'chip-new' : 'chip-review'">
          {{ current?.is_new ? "今日新词" : "复习" }}
        </span>
        <div class="word-body" @click="playSound">
          <div class="word-en">{{ current?.content }}</div>
          <div class="word-phonetic" v-if="current?.phonetic">{{ current.phonetic }}</div>
          <button class="sound-btn" @click.stop="playSound">
            <img :src="iconSound" width="20" height="20" alt="sound" :class="{ spinning: pronouncing }" />
          </button>
        </div>
        <div class="word-hint">选出这个词的意思</div>
      </section>

      <!-- 选项 -->
      <section class="option-list">
        <button
          v-for="(opt, i) in current?.options ?? []"
          :key="i"
          class="option-btn"
          :class="optionClass(i)"
          :disabled="feedback !== null"
          @click="answer(i)"
        >
          <span class="option-letter">{{ letters[i] }}</span>
          <span class="option-text">{{ opt }}</span>
          <img
            v-if="feedback && i === current?.answer_index"
            :src="iconCheck" width="16" height="16" alt="ok"
          />
          <img
            v-else-if="feedback === 'wrong' && i === chosenIndex"
            :src="iconCross" width="16" height="16" alt="no"
          />
        </button>
      </section>

      <!-- 反馈条 -->
      <transition name="fb">
        <div v-if="feedback" class="feedback-bar" :class="feedback">
          <span class="fb-icon">
            <img :src="feedback === 'correct' ? iconCheck : iconCross" width="16" height="16" alt="" />
          </span>
          <span class="fb-text">
            {{ feedback === "correct" ? correctTip : `正确答案：${current?.options[current?.answer_index ?? 0]}` }}
          </span>
        </div>
      </transition>
    </template>

    <!-- 完成页 -->
    <template v-else-if="phase === 'done'">
      <div class="done-wrap">
        <div class="done-trophy" ref="trophyRef">
          <img :src="iconTrophy" width="72" height="72" alt="trophy" />
          <img class="spark s1" :src="iconSpark" width="26" height="26" alt="" />
          <img class="spark s2" :src="iconStar" width="20" height="20" alt="" />
          <img class="spark s3" :src="iconSpark" width="20" height="20" alt="" />
        </div>
        <div class="done-title">今日练习完成！</div>
        <div class="done-sub">间隔重复会帮你把单词记牢</div>

        <div class="done-stats">
          <div class="stat-row">
            <span class="stat-key">
              <img :src="iconBook" width="16" height="16" alt="" /> 今日新词
            </span>
            <span class="stat-val">
              {{ Math.min(newDoneDisplay, daily?.goal ?? newDoneDisplay) }}/{{ daily?.goal ?? 0 }}
              <span class="stat-bar"><span class="stat-fill" :style="{ width: newGoalPercent + '%' }"></span></span>
            </span>
          </div>
          <div class="stat-row">
            <span class="stat-key">
              <img :src="iconClock" width="16" height="16" alt="" /> 本次复习
            </span>
            <span class="stat-val">{{ stats.reviewsDone }} 词</span>
          </div>
          <div class="stat-row">
            <span class="stat-key">
              <img :src="iconStar" width="16" height="16" alt="" /> 答题正确率
            </span>
            <span class="stat-val">{{ accuracy }}%</span>
          </div>
        </div>

        <div class="done-actions">
          <button class="btn-primary" @click="goHome">完成</button>
          <button class="btn-ghost" @click="playAgain">再练一轮</button>
          <button class="btn-ghost" @click="goLearning">去生词本</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { showConfirmDialog, showToast } from "vant";
import gsap from "gsap";
import { learningApi, speechApi } from "@/api";
import iconBack from "@/assets/icons/icon-back.svg";
import iconSound from "@/assets/icons/icon-sound.svg";
import iconTrophy from "@/assets/icons/icon-trophy.svg";
import iconStar from "@/assets/icons/icon-star.svg";
import iconCheck from "@/assets/icons/icon-check.svg";
import iconCross from "@/assets/icons/icon-cross.svg";
import iconSpark from "@/assets/icons/icon-spark.svg";
import iconBook from "@/assets/icons/icon-book-open.svg";
import iconClock from "@/assets/icons/icon-clock-review.svg";

/** 一道意思匹配题：id=user_learning.id，is_new 决定答对后走 learn 还是 review */
interface QuizItem {
  id: number;
  content: string;
  phonetic: string | null;
  is_new: boolean;
  options: string[];
  answer_index: number;
}

interface DailyPlan {
  goal: number;
  new_done: number;
  new_total: number;
  reviews_due: number;
  reviews_done: number;
  mastered_total: number;
  streak_days: number;
  today_words: any[];
}

const router = useRouter();
const letters = ["A", "B", "C", "D"];

const phase = ref<"loading" | "quiz" | "done" | "empty">("loading");
const daily = ref<DailyPlan | null>(null);
const queue = ref<QuizItem[]>([]);
const index = ref(0);
const feedback = ref<null | "correct" | "wrong">(null);
const chosenIndex = ref(-1);
const wrongItems = ref<QuizItem[]>([]);
const round = ref(0); // 错题重练轮数（最多 1 轮）
const pronouncing = ref(false);

/** 本次会话统计（正确/错误/新学/复习数） */
const stats = ref({ correct: 0, wrong: 0, newLearned: 0, reviewsDone: 0 });

const cardRef = ref<HTMLElement | null>(null);
const trophyRef = ref<HTMLElement | null>(null);

const current = computed(() => queue.value[index.value] ?? null);
const progressPercent = computed(() =>
  queue.value.length ? Math.round(((index.value + (feedback.value ? 1 : 0)) / queue.value.length) * 100) : 0,
);
/** 今日新词已学总数 = 进入页面时已学的 + 本次答对的新词（封顶 goal） */
const newDoneDisplay = computed(() =>
  Math.min((daily.value?.new_done ?? 0) + stats.value.newLearned, daily.value?.goal ?? Infinity),
);
const reviewsDoneDisplay = computed(() => (daily.value?.reviews_done ?? 0) + stats.value.reviewsDone);
const newGoalPercent = computed(() =>
  daily.value?.goal ? Math.round((newDoneDisplay.value / daily.value.goal) * 100) : 0,
);
const accuracy = computed(() => {
  const t = stats.value.correct + stats.value.wrong;
  return t ? Math.round((stats.value.correct / t) * 100) : 100;
});

const correctTips = ["答对啦！", "记得很牢！", "太棒了！", "就是这个意思！"];

/** 反馈条文案：答对随机夸一句 */
const correctTip = computed(
  () => correctTips[Math.floor(Math.random() * correctTips.length)],
);

/** 选项按钮反馈样式：答对后正确项绿底；答错后选中项红底 + 正确项绿底 */
function optionClass(i: number) {
  if (!feedback.value) return "";
  if (i === current.value?.answer_index) return "opt-right";
  if (feedback.value === "wrong" && i === chosenIndex.value) return "opt-wrong";
  return "opt-dim";
}

/** 发音：TTS 合成并播放（防重复点击） */
async function playSound() {
  const q = current.value;
  if (!q || pronouncing.value) return;
  pronouncing.value = true;
  try {
    const blob = await speechApi.synthesize(q.content);
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play();
  } catch {
    showToast("发音失败");
  } finally {
    pronouncing.value = false;
  }
}

/**
 * 作答：
 * - 答对：新词 → learn（今日进度+1，次日进复习队列）；复习词 → review(good)（3 天后复习）
 * - 答错：复习词 → review(again)（降熟练度，10 分钟后重来）；新词不提交，进错题下一轮重练
 * 接口调用不阻塞 UI（错误静默，避免打断节奏）。
 */
async function answer(i: number) {
  if (feedback.value) return;
  const q = current.value!;
  chosenIndex.value = i;
  const ok = i === q.answer_index;
  feedback.value = ok ? "correct" : "wrong";

  if (ok) {
    stats.value.correct++;
    try {
      if (q.is_new) {
        await learningApi.learn(q.id);
        stats.value.newLearned++;
      } else {
        await learningApi.review(q.id, "good");
        stats.value.reviewsDone++;
      }
    } catch {
      /* 网络失败不打断练习 */
    }
  } else {
    stats.value.wrong++;
    wrongItems.value.push(q);
    if (!q.is_new) {
      try {
        await learningApi.review(q.id, "again");
      } catch {
        /* 静默 */
      }
    }
  }

  window.setTimeout(next, 950);
}

/** 下一题：题目耗尽后若还有错题则重练一轮，否则进入结果页 */
function next() {
  feedback.value = null;
  chosenIndex.value = -1;
  index.value++;
  if (index.value >= queue.value.length) {
    if (wrongItems.value.length && round.value < 1) {
      queue.value = wrongItems.value.map((q) => ({ ...q }));
      wrongItems.value = [];
      index.value = 0;
      round.value++;
      animateCard();
      return;
    }
    finish();
    return;
  }
  animateCard();
}

/** 结果页：GSAP 奖杯弹入 */
function finish() {
  phase.value = "done";
  requestAnimationFrame(() => {
    if (!trophyRef.value) return;
    gsap.fromTo(
      trophyRef.value,
      { scale: 0.4, opacity: 0, rotate: -8 },
      { scale: 1, opacity: 1, rotate: 0, duration: 0.6, ease: "back.out(2)" },
    );
    gsap.fromTo(".spark", { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, stagger: 0.12, delay: 0.35 });
  });
}

/** 单词卡/选项 GSAP 入场（每题重放） */
function animateCard() {
  requestAnimationFrame(() => {
    if (!cardRef.value) return;
    gsap.fromTo(
      cardRef.value,
      { opacity: 0, y: 24, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "power2.out" },
    );
    const options = cardRef.value!.parentElement!.querySelectorAll(".option-btn");
    gsap.fromTo(
      options,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.3, stagger: 0.05, delay: 0.1, ease: "power2.out" },
    );
  });
}

/** 加载：拉取今日计划 + 复习/新词题目，拼成队列（先复习后新词） */
onMounted(async () => {
  try {
    const d = await learningApi.daily();
    const r = await learningApi.quiz("review", 10);
    const n = await learningApi.quiz("new", Math.max(1, d.goal - d.new_done));
    daily.value = d;
    const items: QuizItem[] = [...(r.items || []), ...(n.items || [])];
    if (!items.length) {
      phase.value = "empty";
      return;
    }
    queue.value = items;
    phase.value = "quiz";
    animateCard();
  } catch {
    phase.value = "empty";
  }
});

/** 退出确认（练习中提示，防误触丢进度） */
async function goBack() {
  if (phase.value === "quiz") {
    try {
      await showConfirmDialog({
        title: "退出练习",
        message: "练习尚未完成，确定退出吗？",
        confirmButtonText: "退出",
        cancelButtonText: "继续练习",
      });
    } catch {
      return; // 用户取消
    }
  }
  router.back();
}

function goHome() {
  router.replace("/home");
}

function goLearning() {
  router.replace("/learning");
}

/** 再练一轮：清空状态重新加载（复习池会重新随机抽取） */
async function playAgain() {
  phase.value = "loading";
  stats.value = { correct: 0, wrong: 0, newLearned: 0, reviewsDone: 0 };
  queue.value = [];
  index.value = 0;
  round.value = 0;
  wrongItems.value = [];
  try {
    const d = await learningApi.daily();
    const r = await learningApi.quiz("review", 10);
    const n = await learningApi.quiz("new", Math.max(1, d.goal - d.new_done));
    daily.value = d;
    const items: QuizItem[] = [...(r.items || []), ...(n.items || [])];
    if (!items.length) {
      phase.value = "empty";
      return;
    }
    queue.value = items;
    phase.value = "quiz";
    animateCard();
  } catch {
    phase.value = "empty";
  }
}
</script>

<style lang="scss" scoped>
.review-page {
  position: relative;
  min-height: 100vh;
  background: var(--c-mint-bg);
  padding: 8px 20px calc(40px + env(safe-area-inset-bottom));
  box-sizing: border-box;
  overflow-x: hidden;
}

/* 背景装饰 */
.bg-blob {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}

.blob-mint {
  top: -60px;
  right: -70px;
  width: 240px;
  height: 240px;
  background: radial-gradient(circle at 30% 30%, rgba(13, 186, 156, 0.24), rgba(46, 214, 178, 0.05) 70%);
  filter: blur(30px);
}

.blob-pink {
  bottom: 120px;
  left: -80px;
  width: 190px;
  height: 190px;
  background: radial-gradient(circle at 60% 40%, rgba(255, 158, 181, 0.22), rgba(255, 158, 181, 0.03) 70%);
  filter: blur(34px);
}

.page-header {
  position: relative;
  z-index: 1;

  .quit-btn {
    font-size: 12px;
    color: var(--c-text-sub);
    cursor: pointer;
    padding: 8px;
  }
}

/* 今日目标条 */
.goal-strip {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 8px;
  margin: 10px 0 16px;

  .goal-cell {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 56px;
    border-radius: var(--radius-sm);
    background: var(--c-card);
    box-shadow: var(--shadow-card);

    .goal-cell-text {
      display: flex;
      flex-direction: column;
      gap: 1px;

      .goal-cell-num {
        font-size: 16px;
        font-weight: 700;
        color: var(--c-text);
        line-height: 1.1;
      }

      .goal-cell-label {
        font-size: 10px;
        color: var(--c-text-faint);
      }
    }
  }
}

.loading-wrap {
  position: relative;
  z-index: 1;
  padding: 90px 0;
  display: flex;
  justify-content: center;
}

/* 进度条 */
.progress-row {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;

  .progress-track {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    background: var(--c-divider);
    overflow: hidden;

    .progress-fill {
      display: block;
      height: 100%;
      border-radius: 4px;
      background: var(--grad-brand);
      transition: width 0.45s ease;
    }
  }

  .progress-text {
    font-size: 12px;
    font-weight: 600;
    color: var(--c-text-sub);
  }
}

/* 单词卡片 */
.word-card {
  position: relative;
  z-index: 1;
  padding: 26px 20px 20px;
  border-radius: var(--radius-lg);
  background: var(--c-card);
  box-shadow: var(--shadow-float);
  text-align: center;

  .mode-chip {
    display: inline-flex;
    align-items: center;
    height: 26px;
    padding: 0 12px;
    border-radius: var(--radius-pill);
    font-size: 11px;
    font-weight: 600;
  }

  .chip-new {
    background: rgba(255, 158, 181, 0.22);
    color: var(--c-red-text);
  }

  .chip-review {
    background: rgba(245, 199, 64, 0.2);
    color: var(--c-gold-text);
  }

  .word-body {
    position: relative;
    margin: 18px 0 6px;

    .word-en {
      font-size: 34px;
      font-weight: 700;
      color: var(--c-text);
      letter-spacing: 0.5px;
      word-break: break-word;
    }

    .word-phonetic {
      font-size: 13px;
      color: var(--c-text-faint);
      margin-top: 6px;
    }

    .sound-btn {
      position: absolute;
      top: 50%;
      right: -6px;
      transform: translateY(-50%);
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 50%;
      background: rgba(127, 224, 200, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.15s ease;

      &:active {
        transform: translateY(-50%) scale(0.9);
      }
    }
  }

  .word-hint {
    font-size: 11px;
    color: var(--c-text-faint);
    margin-top: 12px;
  }
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 选项 */
.option-list {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}

.option-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 54px;
  padding: 10px 14px;
  border-radius: 14px;
  border: 1.5px solid var(--c-border);
  background: var(--c-card);
  cursor: pointer;
  text-align: left;
  transition: transform 0.15s ease, border-color 0.2s ease, background 0.2s ease;

  &:not(:disabled):active {
    transform: scale(0.98);
  }

  &:disabled {
    cursor: default;
  }

  .option-letter {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 9px;
    background: rgba(127, 224, 200, 0.3);
    color: var(--c-primary-deep);
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .option-text {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
    color: var(--c-text);
    line-height: 1.4;
  }

  &.opt-right {
    border-color: var(--c-primary);
    background: rgba(13, 186, 156, 0.12);

    .option-letter {
      background: var(--c-primary);
      color: #fff;
    }
  }

  &.opt-wrong {
    border-color: var(--c-red);
    background: rgba(242, 149, 138, 0.14);

    .option-letter {
      background: var(--c-red);
      color: #fff;
    }
  }

  &.opt-dim {
    opacity: 0.55;
  }
}

/* 反馈条 */
.feedback-bar {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;

  &.correct {
    background: rgba(13, 186, 156, 0.12);
    color: var(--c-primary-deep);
  }

  &.wrong {
    background: rgba(242, 149, 138, 0.14);
    color: var(--c-red-text);
  }

  .fb-icon {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    .correct & {
      background: var(--c-primary);
    }

    .wrong & {
      background: var(--c-red);
    }
  }
}

.fb-enter-active,
.fb-leave-active {
  transition: all 0.25s ease;
}

.fb-enter-from,
.fb-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* 空状态 */
.empty-wrap {
  position: relative;
  z-index: 1;
  padding: 70px 0;
}

.empty-card {
  padding: 34px 22px;
  border-radius: var(--radius-lg);
  background: var(--c-card);
  box-shadow: var(--shadow-float);
  text-align: center;

  .empty-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--c-text);
    margin-top: 14px;
  }

  .empty-sub {
    font-size: 12px;
    color: var(--c-text-sub);
    margin-top: 8px;
    line-height: 1.6;
  }

  .empty-actions {
    display: flex;
    gap: 10px;
    margin-top: 22px;

    .btn-primary {
      flex: 1;
    }

    .btn-ghost {
      flex: 1;
    }
  }
}

/* 完成页 */
.done-wrap {
  position: relative;
  z-index: 1;
  padding: 40px 0;

  .done-trophy {
    position: relative;
    display: flex;
    justify-content: center;

    .spark {
      position: absolute;

      &.s1 {
        top: -6px;
        right: 22%;
      }

      &.s2 {
        top: 8px;
        left: 22%;
      }

      &.s3 {
        bottom: 4px;
        right: 30%;
      }
    }
  }

  .done-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--c-text);
    text-align: center;
    margin-top: 20px;
  }

  .done-sub {
    font-size: 12px;
    color: var(--c-text-sub);
    text-align: center;
    margin-top: 8px;
  }

  .done-stats {
    margin: 24px 0;
    padding: 18px 18px 6px;
    border-radius: var(--radius-md);
    background: var(--c-card);
    box-shadow: var(--shadow-card);

    .stat-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;

      .stat-key {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
        color: var(--c-text-sub);
      }

      .stat-val {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-size: 15px;
        font-weight: 700;
        color: var(--c-text);

        .stat-bar {
          width: 90px;
          height: 6px;
          border-radius: 3px;
          background: var(--c-divider);
          overflow: hidden;

          .stat-fill {
            display: block;
            height: 100%;
            border-radius: 3px;
            background: var(--grad-brand);
            transition: width 0.6s ease;
          }
        }
      }
    }
  }

  .done-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;

    .btn-primary,
    .btn-ghost {
      width: 100%;
    }
  }
}

.btn-ghost {
  height: 48px;
  border-radius: var(--radius-pill);
  border: 1.5px solid var(--c-border);
  background: var(--c-card);
  color: var(--c-text-sub);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease;

  &:active {
    transform: scale(0.97);
  }
}
</style>
