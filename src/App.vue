<script setup>
import Sidebar from "./components/Sidebar.vue";
import NoteEditor from "./components/NoteEditor.vue";
import { useNotes } from "./composables/useNotes";

const {
  sortedPages,
  activePage,
  saveStatus,
  createNewPage,
  selectPage,
  deletePage,
  updateActivePage,
} = useNotes();
</script>

<template>
  <main class="app-shell">
    <Sidebar
      :pages="sortedPages"
      :active-page-id="activePage?.id || null"
      @create-page="createNewPage"
      @select-page="selectPage"
      @delete-page="deletePage"
    />
    <NoteEditor
      :page="activePage"
      :save-status="saveStatus"
      @update-page="updateActivePage"
    />
  </main>
</template>
