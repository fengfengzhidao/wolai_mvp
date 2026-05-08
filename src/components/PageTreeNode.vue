<script setup>
import { computed } from "vue";
import CalendarPageIcon from "./CalendarPageIcon.vue";
import { formatTime } from "../utils/formatTime";

const props = defineProps({
  page: {
    type: Object,
    required: true,
  },
  activePageId: {
    type: String,
    default: null,
  },
  expandedPageIds: {
    type: Set,
    required: true,
  },
  draggingPageId: {
    type: String,
    default: null,
  },
  dropTarget: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits([
  "select-page",
  "open-menu",
  "toggle-expanded",
  "page-drag-start",
  "page-drag-over",
  "page-drop",
  "page-drag-end",
]);

const hasChildren = computed(() => props.page.children.length > 0);
const isExpanded = computed(() => props.expandedPageIds.has(props.page.id));
const dropPosition = computed(() =>
  props.dropTarget?.pageId === props.page.id ? props.dropTarget.position : null,
);

function openMenu(event, pageId) {
  emit("open-menu", event, pageId);
}

function getDropPosition(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const offsetY = event.clientY - rect.top;
  const topZone = rect.height * 0.28;
  const bottomZone = rect.height * 0.72;

  if (offsetY < topZone) {
    return "before";
  }

  if (offsetY > bottomZone) {
    return "after";
  }

  return "inside";
}

function handleDragStart(event) {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", props.page.id);
  emit("page-drag-start", props.page.id);
}

function handleDragOver(event) {
  emit("page-drag-over", event, props.page.id, getDropPosition(event));
}

function handleDrop(event) {
  emit("page-drop", event, props.page.id, getDropPosition(event));
}

function forwardPageDragOver(event, pageId, position) {
  emit("page-drag-over", event, pageId, position);
}

function forwardPageDrop(event, pageId, position) {
  emit("page-drop", event, pageId, position);
}
</script>

<template>
  <div
    class="page-tree-node"
    :class="{ 'is-dragging': page.id === draggingPageId }"
  >
    <div
      class="page-list-item"
      :class="{
        'is-active': page.id === activePageId,
        'is-drop-before': dropPosition === 'before',
        'is-drop-inside': dropPosition === 'inside',
        'is-drop-after': dropPosition === 'after',
      }"
      draggable="true"
      role="button"
      tabindex="0"
      @click="$emit('select-page', page.id)"
      @keydown.enter.prevent="$emit('select-page', page.id)"
      @contextmenu.prevent="openMenu($event, page.id)"
      @dragstart.stop="handleDragStart"
      @dragover.stop="handleDragOver"
      @drop.stop="handleDrop"
      @dragend.stop="$emit('page-drag-end')"
    >
      <span class="page-item-main">
        <button
          v-if="hasChildren"
          class="page-expand-button"
          type="button"
          :aria-label="isExpanded ? '收起子页面' : '展开子页面'"
          @click.stop="$emit('toggle-expanded', page.id)"
          @contextmenu.prevent.stop="openMenu($event, page.id)"
        >
          {{ isExpanded ? "▾" : "▸" }}
        </button>
        <span v-else class="page-expand-spacer"></span>
        <CalendarPageIcon
          v-if="page.icon?.type === 'calendar'"
          :icon="page.icon"
          size="small"
        />
        <span v-else class="page-icon-spacer"></span>
        <span class="page-title">{{ page.title.trim() || "未命名页面" }}</span>
      </span>
      <span class="page-time">{{ formatTime(page.updatedAt) }}</span>
    </div>

    <div v-if="hasChildren && isExpanded" class="page-tree-children">
      <PageTreeNode
        v-for="child in page.children"
        :key="child.id"
        :page="child"
        :active-page-id="activePageId"
        :expanded-page-ids="expandedPageIds"
        :dragging-page-id="draggingPageId"
        :drop-target="dropTarget"
        @select-page="$emit('select-page', $event)"
        @open-menu="openMenu"
        @toggle-expanded="$emit('toggle-expanded', $event)"
        @page-drag-start="$emit('page-drag-start', $event)"
        @page-drag-over="forwardPageDragOver"
        @page-drop="forwardPageDrop"
        @page-drag-end="$emit('page-drag-end')"
      />
    </div>
  </div>
</template>
