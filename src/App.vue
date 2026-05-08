<script setup>
import Sidebar from "./components/Sidebar.vue";
import NoteEditor from "./components/NoteEditor.vue";
import { useNotes } from "./composables/useNotes";

const {
  sortedPages,
  activePage,
  saveStatus,
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
} = useNotes();
</script>

<template>
  <main class="app-shell">
    <Sidebar
      :pages="sortedPages"
      :active-page-id="activePage?.id || null"
      @create-page="createNewPage"
      @create-child-page="createChildPage"
      @create-sibling-page-after="createSiblingPageAfter"
      @select-page="selectPage"
      @delete-page="deletePage"
      @rename-page="renamePage"
      @duplicate-page="duplicatePage"
      @move-page="movePage"
      @move-page-to-parent="movePageToParent"
    />
    <NoteEditor
      :page="activePage"
      :pages="sortedPages"
      :save-status="saveStatus"
      @update-page="updateActivePage"
      @select-page="selectPage"
      @create-child-page="createChildPage"
      @delete-page="deletePage"
    />
  </main>
</template>
