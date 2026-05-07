<script setup>
import { formatTime } from "../utils/formatTime";

defineProps({
  pages: {
    type: Array,
    required: true,
  },
  activePageId: {
    type: String,
    default: null,
  },
});

defineEmits(["create-page", "select-page"]);
</script>

<template>
  <aside class="sidebar">
    <header class="sidebar-header">
      <div>
        <p class="workspace-label">个人空间</p>
        <h1>wolai_mvp</h1>
      </div>
      <button class="new-page-button" type="button" @click="$emit('create-page')">
        新建
      </button>
    </header>

    <section class="page-list-panel" aria-label="页面列表">
      <p class="section-title">页面</p>
      <div class="page-list">
        <button
          v-for="page in pages"
          :key="page.id"
          class="page-list-item"
          :class="{ 'is-active': page.id === activePageId }"
          type="button"
          @click="$emit('select-page', page.id)"
        >
          <span class="page-title">{{ page.title.trim() || "未命名页面" }}</span>
          <span class="page-time">{{ formatTime(page.updatedAt) }}</span>
        </button>
      </div>
      <p v-if="pages.length === 0" class="empty-list is-visible">还没有页面</p>
    </section>
  </aside>
</template>
