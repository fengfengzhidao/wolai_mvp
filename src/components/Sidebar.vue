<script setup>
import { onBeforeUnmount, ref } from "vue";
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

const emit = defineEmits(["create-page", "select-page", "delete-page"]);
const contextMenu = ref({
  isOpen: false,
  pageId: null,
  x: 0,
  y: 0,
});

function openContextMenu(event, pageId) {
  contextMenu.value = {
    isOpen: true,
    pageId,
    x: event.clientX,
    y: event.clientY,
  };
  window.addEventListener("click", closeContextMenu, { once: true });
}

function closeContextMenu() {
  contextMenu.value.isOpen = false;
}

function requestDeletePage() {
  const pageId = contextMenu.value.pageId;
  closeContextMenu();

  if (!pageId) {
    return;
  }

  const confirmed = window.confirm("确定要删除这个页面吗？");
  if (confirmed) {
    emit("delete-page", pageId);
  }
}

onBeforeUnmount(() => {
  window.removeEventListener("click", closeContextMenu);
});
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
          @contextmenu.prevent="openContextMenu($event, page.id)"
        >
          <span class="page-title">{{ page.title.trim() || "未命名页面" }}</span>
          <span class="page-time">{{ formatTime(page.updatedAt) }}</span>
        </button>
      </div>
      <p v-if="pages.length === 0" class="empty-list is-visible">还没有页面</p>
    </section>

    <div
      v-if="contextMenu.isOpen"
      class="context-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      @click.stop
    >
      <button class="context-menu-item is-danger" type="button" @click="requestDeletePage">
        删除页面
      </button>
    </div>
  </aside>
</template>
