<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import PageTreeNode from "./PageTreeNode.vue";

const props = defineProps({
  pages: {
    type: Array,
    required: true,
  },
  activePageId: {
    type: String,
    default: null,
  },
});

const emit = defineEmits([
  "create-page",
  "create-child-page",
  "select-page",
  "delete-page",
  "move-page",
]);
const contextMenu = ref({
  isOpen: false,
  pageId: null,
  x: 0,
  y: 0,
});
const dragState = ref({
  draggingPageId: null,
  dropTarget: null,
});
const expandedPageIds = ref(getParentIds(props.pages));

const pageTree = computed(() => buildPageTree(props.pages));

function buildPageTree(pages) {
  const pageById = new Map();
  const childMap = new Map();

  pages.forEach((page) => {
    pageById.set(page.id, {
      ...page,
      children: [],
    });
  });

  pageById.forEach((page) => {
    const parentId = page.parentId && pageById.has(page.parentId) ? page.parentId : null;
    const siblings = childMap.get(parentId) || [];
    siblings.push(page);
    childMap.set(parentId, siblings);
  });

  childMap.forEach((children) => {
    children.sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }

      return b.updatedAt - a.updatedAt;
    });
  });

  pageById.forEach((page) => {
    page.children = childMap.get(page.id) || [];
  });

  return childMap.get(null) || [];
}

function getParentIds(pages) {
  return new Set(
    pages
      .filter((page) => pages.some((child) => child.parentId === page.id))
      .map((page) => page.id),
  );
}

function toggleExpanded(pageId) {
  const nextExpandedPageIds = new Set(expandedPageIds.value);

  if (nextExpandedPageIds.has(pageId)) {
    nextExpandedPageIds.delete(pageId);
  } else {
    nextExpandedPageIds.add(pageId);
  }

  expandedPageIds.value = nextExpandedPageIds;
}

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

function requestCreateChildPage() {
  const pageId = contextMenu.value.pageId;
  closeContextMenu();

  if (!pageId) {
    return;
  }

  emit("create-child-page", pageId);
  expandedPageIds.value = new Set([...expandedPageIds.value, pageId]);
}

function isDescendantPage(pageId, possibleAncestorId) {
  let currentPage = props.pages.find((page) => page.id === pageId);

  while (currentPage?.parentId) {
    if (currentPage.parentId === possibleAncestorId) {
      return true;
    }

    currentPage = props.pages.find((page) => page.id === currentPage.parentId);
  }

  return false;
}

function canDropPage(targetPageId) {
  const draggingPageId = dragState.value.draggingPageId;

  return Boolean(
    draggingPageId &&
      draggingPageId !== targetPageId &&
      !isDescendantPage(targetPageId, draggingPageId),
  );
}

function handlePageDragStart(pageId) {
  closeContextMenu();
  dragState.value = {
    draggingPageId: pageId,
    dropTarget: null,
  };
}

function handlePageDragOver(event, pageId, position) {
  if (!canDropPage(pageId)) {
    return;
  }

  event.preventDefault();
  dragState.value.dropTarget = {
    pageId,
    position,
  };
}

function handlePageDrop(event, pageId, position) {
  if (!canDropPage(pageId)) {
    clearPageDrag();
    return;
  }

  event.preventDefault();
  emit("move-page", dragState.value.draggingPageId, pageId, position);

  if (position === "inside") {
    expandedPageIds.value = new Set([...expandedPageIds.value, pageId]);
  }

  clearPageDrag();
}

function clearPageDrag() {
  dragState.value = {
    draggingPageId: null,
    dropTarget: null,
  };
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
        <PageTreeNode
          v-for="page in pageTree"
          :key="page.id"
          :page="page"
          :active-page-id="activePageId"
          :expanded-page-ids="expandedPageIds"
          :dragging-page-id="dragState.draggingPageId"
          :drop-target="dragState.dropTarget"
          @select-page="$emit('select-page', $event)"
          @open-menu="openContextMenu"
          @toggle-expanded="toggleExpanded"
          @page-drag-start="handlePageDragStart"
          @page-drag-over="handlePageDragOver"
          @page-drop="handlePageDrop"
          @page-drag-end="clearPageDrag"
        />
      </div>
      <p v-if="pages.length === 0" class="empty-list is-visible">还没有页面</p>
    </section>

    <div
      v-if="contextMenu.isOpen"
      class="context-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      @click.stop
    >
      <button class="context-menu-item" type="button" @click="requestCreateChildPage">
        新建子页面
      </button>
      <button class="context-menu-item is-danger" type="button" @click="requestDeletePage">
        删除页面
      </button>
    </div>
  </aside>
</template>
