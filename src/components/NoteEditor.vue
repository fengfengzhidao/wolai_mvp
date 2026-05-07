<script setup>
import "@toast-ui/editor/dist/toastui-editor.css";
import Editor from "@toast-ui/editor";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { formatTime } from "../utils/formatTime";

const props = defineProps({
  page: {
    type: Object,
    default: null,
  },
  saveStatus: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(["update-page"]);
const titleInput = ref(null);
const editorRoot = ref(null);
let markdownEditor = null;
let isSyncingEditor = false;

const title = computed({
  get() {
    return props.page?.title || "";
  },
  set(value) {
    emit("update-page", { title: value });
  },
});

watch(
  () => props.page?.id,
  async () => {
    await nextTick();
    syncEditorContent();
    if (props.page?.title === "未命名页面") {
      titleInput.value?.focus();
      titleInput.value?.select();
    }
  },
);

watch(
  () => props.page?.content,
  () => {
    syncEditorContent();
  },
);

onMounted(() => {
  markdownEditor = new Editor({
    el: editorRoot.value,
    height: "520px",
    initialEditType: "markdown",
    initialValue: props.page?.content || "",
    previewStyle: "vertical",
    usageStatistics: false,
    toolbarItems: [
      ["heading", "bold", "italic", "strike"],
      ["hr", "quote"],
      ["ul", "ol", "task"],
      ["code", "codeblock"],
    ],
  });

  markdownEditor.on("change", () => {
    if (isSyncingEditor) {
      return;
    }

    emit("update-page", {
      content: markdownEditor.getMarkdown(),
    });
  });
});

onBeforeUnmount(() => {
  markdownEditor?.destroy();
});

function syncEditorContent() {
  if (!markdownEditor) {
    return;
  }

  const nextContent = props.page?.content || "";
  if (markdownEditor.getMarkdown() === nextContent) {
    return;
  }

  isSyncingEditor = true;
  markdownEditor.setMarkdown(nextContent);
  isSyncingEditor = false;
}
</script>

<template>
  <section class="editor-pane" aria-label="页面编辑区">
    <div class="editor-inner">
      <div class="editor-meta">
        <span>{{ page ? `更新于 ${formatTime(page.updatedAt)}` : "尚未保存" }}</span>
        <span class="editor-status">{{ saveStatus }}</span>
      </div>
      <input
        ref="titleInput"
        v-model="title"
        class="title-input"
        type="text"
        placeholder="未命名页面"
        autocomplete="off"
        :disabled="!page"
      />
      <div class="markdown-editor-wrap">
        <div ref="editorRoot" class="markdown-editor"></div>
      </div>
    </div>
  </section>
</template>
