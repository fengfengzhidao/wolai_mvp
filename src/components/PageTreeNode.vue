<script setup>
import { computed } from "vue";
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
});

const emit = defineEmits(["select-page", "open-menu", "toggle-expanded"]);

const hasChildren = computed(() => props.page.children.length > 0);
const isExpanded = computed(() => props.expandedPageIds.has(props.page.id));

function openMenu(event, pageId) {
  emit("open-menu", event, pageId);
}
</script>

<template>
  <div class="page-tree-node">
    <div
      class="page-list-item"
      :class="{ 'is-active': page.id === activePageId }"
      role="button"
      tabindex="0"
      @click="$emit('select-page', page.id)"
      @keydown.enter.prevent="$emit('select-page', page.id)"
      @contextmenu.prevent="openMenu($event, page.id)"
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
        @select-page="$emit('select-page', $event)"
        @open-menu="openMenu"
        @toggle-expanded="$emit('toggle-expanded', $event)"
      />
    </div>
  </div>
</template>
