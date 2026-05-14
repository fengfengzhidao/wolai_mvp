<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import PageTreeNode from "./PageTreeNode.vue";
import SearchDialog from "./SearchDialog.vue";

const EXPANDED_PAGE_IDS_KEY = "wolai_mvp_expanded_page_ids";

const props = defineProps({
  pages: {
    type: Array,
    required: true,
  },
  activePageId: {
    type: String,
    default: null,
  },
  user: {
    type: Object,
    default: null,
  },
  collapsed: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  "create-page",
  "create-child-page",
  "create-sibling-page-after",
  "select-page",
  "delete-page",
  "rename-page",
  "duplicate-page",
  "move-page",
  "open-today-quick-note",
  "open-search-result",
  "collapse-sidebar",
  "logout",
]);
const isSearchOpen = ref(false);
const isSettingsOpen = ref(false);
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
const expandedPageIds = ref(getInitialExpandedPageIds(props.pages));

const pageTree = computed(() => buildPageTree(props.pages));
const currentMenuPage = computed(() =>
  props.pages.find((page) => page.id === contextMenu.value.pageId) || null,
);

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

function getInitialExpandedPageIds(pages) {
  try {
    const storedIds = JSON.parse(localStorage.getItem(EXPANDED_PAGE_IDS_KEY) || "[]");
    if (Array.isArray(storedIds)) {
      const validPageIds = new Set(pages.map((page) => page.id));
      return new Set(storedIds.filter((pageId) => validPageIds.has(pageId)));
    }
  } catch {
    // Keep the first-run default below.
  }

  return getParentIds(pages);
}

function persistExpandedPageIds() {
  localStorage.setItem(
    EXPANDED_PAGE_IDS_KEY,
    JSON.stringify([...expandedPageIds.value]),
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
  persistExpandedPageIds();
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

function toggleSearch(event) {
  event.stopPropagation();
  isSearchOpen.value = !isSearchOpen.value;

  if (isSearchOpen.value) {
    closeSettings();
  }
}

function closeSearch() {
  isSearchOpen.value = false;
}

function toggleSettings(event) {
  event.stopPropagation();
  isSettingsOpen.value = !isSettingsOpen.value;

  if (isSettingsOpen.value) {
    closeSearch();
    window.addEventListener("click", closeSettings, { once: true });
  }
}

function closeSettings() {
  isSettingsOpen.value = false;
}

function requestTodayQuickNote() {
  closeSearch();
  closeSettings();
  emit("open-today-quick-note");
}

function openSearchResult(result) {
  closeSearch();
  emit("open-search-result", result);
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
  persistExpandedPageIds();
}

function requestCreateSiblingPageAfter() {
  const pageId = contextMenu.value.pageId;
  closeContextMenu();

  if (pageId) {
    emit("create-sibling-page-after", pageId);
  }
}

function requestRenamePage() {
  const page = currentMenuPage.value;
  closeContextMenu();

  if (!page) {
    return;
  }

  const nextTitle = window.prompt("页面名称", page.title || "未命名页面");
  if (nextTitle !== null) {
    emit("rename-page", page.id, nextTitle);
  }
}

function requestDuplicatePage() {
  const pageId = contextMenu.value.pageId;
  closeContextMenu();

  if (pageId) {
    emit("duplicate-page", pageId);
  }
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
    persistExpandedPageIds();
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
  window.removeEventListener("click", closeSettings);
});

watch(
  () => props.pages.map((page) => page.id).join("|"),
  () => {
    const validPageIds = new Set(props.pages.map((page) => page.id));
    expandedPageIds.value = new Set(
      [...expandedPageIds.value].filter((pageId) => validPageIds.has(pageId)),
    );
    persistExpandedPageIds();
  },
);
</script>

<template>
  <aside class="sidebar" :class="{ 'is-collapsed': collapsed }">
    <header class="sidebar-header">
      <div>
        <p class="workspace-label">个人空间</p>
        <h1>枫枫笔记</h1>
        <p v-if="user" class="sidebar-user">{{ user.username }}</p>
      </div>
      <button
        class="sidebar-collapse-button"
        type="button"
        title="收起侧边栏"
        aria-label="收起侧边栏"
        @click="$emit('collapse-sidebar')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5h16M4 12h16M4 19h16" />
        </svg>
      </button>
    </header>

    <section class="sidebar-actions" aria-label="操作区域">
      <button
        class="sidebar-icon-button"
        type="button"
        title="新建页面"
        aria-label="新建页面"
        @click="$emit('create-page')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button
        class="sidebar-icon-button"
        :class="{ 'is-active': isSearchOpen }"
        type="button"
        title="搜索"
        aria-label="搜索"
        @click="toggleSearch"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
      </button>
      <button
        class="sidebar-icon-button"
        type="button"
        title="今日速记"
        aria-label="今日速记"
        @click="requestTodayQuickNote"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13 2 4 14h7l-1 8 10-13h-7l1-7Z" />
        </svg>
      </button>
      <div class="settings-action-wrap">
        <button
          class="sidebar-icon-button"
          :class="{ 'is-active': isSettingsOpen }"
          type="button"
          title="个人设置"
          aria-label="个人设置"
          @click="toggleSettings"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="19" cy="12" r="1.5" />
          </svg>
        </button>
        <div v-if="isSettingsOpen" class="settings-popover" @click.stop>
          <p class="settings-label">当前账号</p>
          <p class="settings-username">{{ user?.username || "未登录" }}</p>
          <button class="settings-logout" type="button" @click="$emit('logout')">
            退出登录
          </button>
        </div>
      </div>
      <SearchDialog
        v-if="isSearchOpen"
        :pages="pages"
        @close="closeSearch"
        @open-result="openSearchResult"
      />
    </section>

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
      <button class="context-menu-item" type="button" @click="requestRenamePage">
        重命名
      </button>
      <button class="context-menu-item" type="button" @click="requestCreateSiblingPageAfter">
        在下方新建
      </button>
      <button class="context-menu-item" type="button" @click="requestCreateChildPage">
        新建子页面
      </button>
      <button class="context-menu-item" type="button" @click="requestDuplicatePage">
        复制页面
      </button>
      <button class="context-menu-item is-danger" type="button" @click="requestDeletePage">
        删除页面
      </button>
    </div>
  </aside>
</template>
