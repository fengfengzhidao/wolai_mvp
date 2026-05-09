<script setup>
import { onMounted, ref } from "vue";
import AuthView from "./components/AuthView.vue";
import Sidebar from "./components/Sidebar.vue";
import NoteEditor from "./components/NoteEditor.vue";
import { useNotes } from "./composables/useNotes";
import { authRepository } from "./repositories/authRepository";

const currentUser = ref(null);
const authStatus = ref("checking");
const workspaceKey = ref(0);

const {
  sortedPages,
  activePage,
  saveStatus,
  reloadNotes,
  createNewPage,
  createChildPage,
  createSiblingPageAfter,
  selectPage,
  deletePage,
  renamePage,
  duplicatePage,
  movePage,
  movePageToParent,
  updateActivePage,
  updateActivePageIcon,
} = useNotes(undefined, { autoInitialize: false });

onMounted(async () => {
  try {
    currentUser.value = await authRepository.getCurrentUser();
    if (currentUser.value) {
      await reloadNotes();
    }
  } catch {
    currentUser.value = null;
  } finally {
    authStatus.value = "ready";
  }
});

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
  <main v-if="authStatus === 'checking'" class="auth-shell">
    <section class="auth-panel">
      <p class="auth-kicker">个人笔记工作台</p>
      <h1>正在进入...</h1>
    </section>
  </main>
  <AuthView
    v-else-if="!currentUser"
    @login="login"
    @register="register"
  />
  <main v-else :key="workspaceKey" class="app-shell">
    <Sidebar
      :pages="sortedPages"
      :active-page-id="activePage?.id || null"
      :user="currentUser"
      @create-page="createNewPage"
      @create-child-page="createChildPage"
      @create-sibling-page-after="createSiblingPageAfter"
      @select-page="selectPage"
      @delete-page="deletePage"
      @rename-page="renamePage"
      @duplicate-page="duplicatePage"
      @move-page="movePage"
      @move-page-to-parent="movePageToParent"
      @logout="logout"
    />
    <NoteEditor
      :page="activePage"
      :pages="sortedPages"
      :save-status="saveStatus"
      @update-page="updateActivePage"
      @select-page="selectPage"
      @create-child-page="createChildPage"
      @delete-page="deletePage"
      @update-page-icon="updateActivePageIcon"
    />
  </main>
</template>
