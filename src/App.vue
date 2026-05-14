<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import AuthView from "./components/AuthView.vue";
import Sidebar from "./components/Sidebar.vue";
import NoteEditor from "./components/NoteEditor.vue";
import SharedPageView from "./components/SharedPageView.vue";
import { useNotes } from "./composables/useNotes";
import { authRepository } from "./repositories/authRepository";

const SIDEBAR_COLLAPSED_KEY = "fengfeng_notes_sidebar_collapsed";

const currentUser = ref(null);
const authStatus = ref("checking");
const workspaceKey = ref(0);
const shareToken = getShareTokenFromPath();
const isSidebarCollapsed = ref(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
const searchTarget = ref({
  blockId: null,
  nonce: 0,
});

const {
  sortedPages,
  activePage,
  saveStatus,
  reloadNotes,
  createNewPage,
  createChildPage,
  openTodayQuickNote,
  createSiblingPageAfter,
  selectPage,
  deletePage,
  renamePage,
  duplicatePage,
  movePage,
  undoActivePage,
  redoActivePage,
  updateActivePage,
  updateActivePageIcon,
} = useNotes(undefined, { autoInitialize: false });

onMounted(async () => {
  if (shareToken) {
    authStatus.value = "ready";
    return;
  }

  document.addEventListener("keydown", handleUndoRedoShortcut);

  try {
    currentUser.value = await authRepository.getCurrentUser();
  } catch {
    currentUser.value = null;
  } finally {
    authStatus.value = "ready";
  }

  if (currentUser.value) {
    await reloadNotes();
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleUndoRedoShortcut);
});

function getShareTokenFromPath() {
  const match = window.location.pathname.match(/^\/share\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : "";
}

function handleUndoRedoShortcut(event) {
  if (!currentUser.value || !(event.ctrlKey || event.metaKey)) {
    return;
  }

  if (event.key === "\\") {
    event.preventDefault();
    setSidebarCollapsed(!isSidebarCollapsed.value);
    return;
  }

  const target = event.target;
  if (!(target instanceof Element) || !target.closest(".editor-pane")) {
    return;
  }

  if (target.closest(".cm-editor")) {
    return;
  }

  const key = event.key.toLowerCase();
  const isUndo = key === "z" && !event.shiftKey;
  const isRedo = key === "y" || (key === "z" && event.shiftKey);

  if (!isUndo && !isRedo) {
    return;
  }

  const didRestore = isUndo ? undoActivePage() : redoActivePage();
  if (didRestore) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function openSearchResult(result) {
  searchTarget.value = {
    blockId: result?.blockId || null,
    nonce: Date.now(),
  };
  if (result?.pageId) {
    selectPage(result.pageId);
  }
}

function setSidebarCollapsed(collapsed) {
  isSidebarCollapsed.value = collapsed;
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
}

async function login(payload) {
  try {
    currentUser.value = await authRepository.login(payload.username, payload.password);
    workspaceKey.value += 1;
    await reloadNotes();
    payload.resolve();
  } catch (error) {
    payload.reject(error);
  }
}

async function register(payload) {
  try {
    currentUser.value = await authRepository.register(payload.username, payload.password);
    workspaceKey.value += 1;
    await reloadNotes();
    payload.resolve();
  } catch (error) {
    payload.reject(error);
  }
}

async function logout() {
  await authRepository.logout();
  currentUser.value = null;
  workspaceKey.value += 1;
}
</script>

<template>
  <div class="app-root">
    <SharedPageView
      v-if="shareToken"
      key="share"
      :token="shareToken"
    />
    <main v-else-if="authStatus === 'checking'" key="checking" class="auth-shell">
      <section class="auth-panel">
        <p class="auth-kicker">个人笔记工作台</p>
        <h1>正在进入...</h1>
      </section>
    </main>
    <AuthView
      v-else-if="!currentUser"
      key="auth"
      @login="login"
      @register="register"
    />
    <main
      v-else
      :key="`workspace-${workspaceKey}`"
      class="app-shell"
      :class="{ 'is-sidebar-collapsed': isSidebarCollapsed }"
    >
      <Sidebar
        :pages="sortedPages"
        :active-page-id="activePage?.id || null"
        :user="currentUser"
        :collapsed="isSidebarCollapsed"
        @create-page="createNewPage"
        @open-today-quick-note="openTodayQuickNote"
        @create-child-page="createChildPage"
        @create-sibling-page-after="createSiblingPageAfter"
        @select-page="selectPage"
        @delete-page="deletePage"
        @rename-page="renamePage"
        @duplicate-page="duplicatePage"
        @move-page="movePage"
        @logout="logout"
        @open-search-result="openSearchResult"
        @collapse-sidebar="setSidebarCollapsed(true)"
      />
      <button
        v-if="isSidebarCollapsed"
        class="sidebar-reopen-button"
        type="button"
        title="展开侧边栏"
        aria-label="展开侧边栏"
        @click="setSidebarCollapsed(false)"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5h16M4 12h16M4 19h16" />
        </svg>
      </button>
      <NoteEditor
        :page="activePage"
        :pages="sortedPages"
        :save-status="saveStatus"
        :search-target="searchTarget"
        @update-page="updateActivePage"
        @select-page="selectPage"
        @create-child-page="createChildPage"
        @delete-page="deletePage"
        @update-page-icon="updateActivePageIcon"
      />
    </main>
  </div>
</template>
