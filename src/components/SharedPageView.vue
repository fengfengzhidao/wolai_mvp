<script setup>
import { computed, onMounted, ref } from "vue";
import CalendarPageIcon from "./CalendarPageIcon.vue";
import { formatTime } from "../utils/formatTime";
import { shareRepository } from "../repositories/notesRepository";

const props = defineProps({
  token: {
    type: String,
    required: true,
  },
});

const page = ref(null);
const status = ref("loading");
const errorMessage = ref("");

const title = computed(() => page.value?.title?.trim() || "未命名页面");

onMounted(loadSharedPage);

async function loadSharedPage() {
  status.value = "loading";
  errorMessage.value = "";

  try {
    page.value = await shareRepository.loadSharedPage(props.token);
    status.value = page.value ? "ready" : "error";
    if (!page.value) {
      errorMessage.value = "分享不存在或已关闭";
    }
  } catch (error) {
    console.error(error);
    status.value = "error";
    errorMessage.value = "分享不存在或已关闭";
  }
}

function getBlockClass(block) {
  return `shared-block is-${block?.type || "paragraph"}`;
}

function getNumberedIndex(blocks, blockIndex) {
  let numberedIndex = 1;

  for (let index = blockIndex - 1; index >= 0; index -= 1) {
    if (blocks[index]?.type !== "numbered") {
      break;
    }
    numberedIndex += 1;
  }

  return numberedIndex;
}

function isHeading(block) {
  return /^heading[1-6]$/.test(block?.type || "");
}

function headingLevel(block) {
  return Number(block.type.replace("heading", ""));
}

function getImageBlock(block) {
  const text = typeof block?.text === "string" ? block.text.trim() : "";
  const imageMatch = text.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);

  if (!imageMatch) {
    return null;
  }

  return {
    alt: imageMatch[1],
    url: imageMatch[2],
  };
}
</script>

<template>
  <main class="shared-page-shell">
    <section v-if="status === 'loading'" class="shared-page-state">
      <p>正在打开分享...</p>
    </section>
    <section v-else-if="status === 'error'" class="shared-page-state">
      <h1>无法打开分享</h1>
      <p>{{ errorMessage }}</p>
    </section>
    <article v-else class="shared-page">
      <header class="shared-page-header">
        <p class="shared-page-brand">枫枫笔记</p>
        <div v-if="page.icon?.type === 'calendar'" class="shared-page-icon">
          <CalendarPageIcon :icon="page.icon" size="large" />
        </div>
        <h1>{{ title }}</h1>
        <p class="shared-page-meta">更新于 {{ formatTime(page.updatedAt) }}</p>
      </header>
      <div class="shared-block-list">
        <template
          v-for="(block, index) in page.blocks || []"
          :key="block.id || index"
        >
          <component
            :is="`h${headingLevel(block)}`"
            v-if="isHeading(block)"
            :class="getBlockClass(block)"
          >
            {{ block.text }}
          </component>
          <div v-else-if="block.type === 'bullet'" :class="getBlockClass(block)">
            <span class="shared-block-marker">•</span>
            <span>{{ block.text }}</span>
          </div>
          <div v-else-if="block.type === 'numbered'" :class="getBlockClass(block)">
            <span class="shared-block-marker">{{ getNumberedIndex(page.blocks || [], index) }}.</span>
            <span>{{ block.text }}</span>
          </div>
          <div v-else-if="block.type === 'todo'" :class="getBlockClass(block)">
            <span class="shared-todo-box" :class="{ 'is-checked': block.checked }">
              <svg v-if="block.checked" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 12 4 4 8-8" />
              </svg>
            </span>
            <span>{{ block.text }}</span>
          </div>
          <pre v-else-if="block.type === 'code'" :class="getBlockClass(block)"><code>{{ block.text }}</code></pre>
          <figure v-else-if="getImageBlock(block)" class="shared-image-block">
            <img :src="getImageBlock(block).url" :alt="getImageBlock(block).alt" />
            <figcaption v-if="getImageBlock(block).alt">{{ getImageBlock(block).alt }}</figcaption>
          </figure>
          <p v-else :class="getBlockClass(block)">
            {{ block.text }}
          </p>
        </template>
      </div>
    </article>
  </main>
</template>
