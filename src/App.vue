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
  selectPage,
  deletePage,
  movePage,
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
      @select-page="selectPage"
      @delete-page="deletePage"
      @move-page="movePage"
    />
    <NoteEditor
      :page="activePage"
      :save-status="saveStatus"
      @update-page="updateActivePage"
    />
  </main>
</template>
