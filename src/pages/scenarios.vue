<template>
  <div class="scenarios-page">
    <!-- 分类 Tabs -->
    <van-tabs v-model:active="activeCategory" color="#4A90D9" sticky>
      <van-tab v-for="cat in categories" :key="cat.key" :name="cat.key" :title="cat.label" />
    </van-tabs>

    <!-- 加载中 -->
    <div v-if="loading" class="loading-wrap">
      <van-loading size="24" color="#4A90D9" vertical>加载中...</van-loading>
    </div>

    <!-- 场景列表 -->
    <div v-else class="scenario-list">
      <div v-for="scene in filteredScenes" :key="scene.id" class="card scenario-item" @click="goChat(scene)">
        <div class="scenario-icon-wrap">
          <span class="scenario-icon">{{ scene.icon }}</span>
        </div>
        <div class="scenario-center">
          <div class="scenario-name-row">
            <span class="scenario-name">{{ scene.name }}</span>
            <van-tag v-if="scene.category" plain :type="tagType(scene.category)">{{ catLabel(scene.category) }}</van-tag>
          </div>
          <div class="scenario-desc" v-if="scene.description">{{ scene.description }}</div>
          <div class="scenario-stars">
            <span v-for="i in 5" :key="i" class="star" :class="{ filled: i <= scene.difficulty }">★</span>
            <span class="diff-label">{{ diffLabel(scene.difficulty) }}</span>
          </div>
        </div>
        <div class="scenario-right">
          <van-icon name="arrow" color="#ccc" size="18" />
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && filteredScenes.length === 0" class="empty">
      <div class="empty-icon">🗂️</div>
      <div class="empty-text">暂未找到场景</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { scenarioApi } from "@/api";

interface Scenario {
  id: number;
  name: string;
  category: string;
  description: string | null;
  difficulty: number;
  icon: string | null;
}

const router = useRouter();

const categories = [
  { key: "all", label: "全部" },
  { key: "life", label: "生活" },
  { key: "work", label: "职场" },
  { key: "programmer", label: "程序员" },
];

const catLabelMap: Record<string, string> = {
  life: "生活",
  work: "职场",
  programmer: "程序员",
};

const activeCategory = ref("all");
const scenarios = ref<Scenario[]>([]);
const loading = ref(true);

const filteredScenes = computed(() => {
  if (activeCategory.value === "all") return scenarios.value;
  return scenarios.value.filter((s) => s.category === activeCategory.value);
});

const catLabel = (key: string) => catLabelMap[key] || key;

const tagType = (key: string) => {
  if (key === "life") return "success" as const;
  if (key === "work") return "warning" as const;
  if (key === "programmer") return "primary" as const;
  return "default" as const;
};

const diffLabel = (d: number) => {
  const map: Record<number, string> = { 1: "入门", 2: "初级", 3: "中级", 4: "进阶", 5: "高级" };
  return map[d] || "";
};

onMounted(async () => {
  try {
    const data = await scenarioApi.list();
    scenarios.value = data || [];
  } catch (e) {
    console.error("Failed to load scenarios:", e);
  } finally {
    loading.value = false;
  }
});

const goChat = (scene: Scenario) => {
  router.push({ path: "/chat", query: { scenarioId: scene.id, scenarioName: scene.name } });
};
</script>

<style lang="scss" scoped>
.scenarios-page {
  min-height: 100vh;
  background: #f5f6fa;
  padding-bottom: 60px;
}

.loading-wrap {
  padding: 100px 0;
  display: flex;
  justify-content: center;
}

.scenario-item {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 10px 14px;
  border-radius: 14px;
  cursor: pointer;
  transition: transform 0.15s;

  &:active {
    transform: scale(0.98);
  }
}

.scenario-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, #eaf2ff, #f5f9ff);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .scenario-icon {
    font-size: 26px;
  }
}

.scenario-center {
  flex: 1;
  min-width: 0;
}

.scenario-name-row {
  display: flex;
  align-items: center;
  gap: 8px;

  .scenario-name {
    font-size: 16px;
    font-weight: 600;
    color: #333;
  }
}

.scenario-desc {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scenario-stars {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 6px;

  .star {
    font-size: 12px;
    color: #e0e0e0;

    &.filled {
      color: #faad14;
    }
  }

  .diff-label {
    font-size: 11px;
    color: #b0b0b0;
  }
}

.scenario-right {
  display: flex;
  align-items: center;
}

.empty {
  padding: 100px 0;
  text-align: center;

  .empty-icon {
    font-size: 48px;
    margin-bottom: 10px;
  }

  .empty-text {
    font-size: 14px;
    color: #999;
  }
}
</style>
