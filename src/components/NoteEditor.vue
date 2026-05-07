<script setup>
import { computed, nextTick, ref, watch } from "vue";
import BlockEditor from "./BlockEditor.vue";
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
const blockEditor = ref(null);

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
    if (props.page?.title === "未命名页面") {
      titleInput.value?.focus();
      titleInput.value?.select();
    }
  },
);

function updateBlock(blockId, text) {
  const shortcut = getBlockShortcut(text);
  const blocks =
    props.page?.blocks.map((block) =>
      block.id === blockId
        ? {
            ...block,
            type: shortcut?.type || block.type,
            text: shortcut?.text ?? text,
          }
        : block,
    ) || [];

  emit("update-page", {
    blocks,
    content: blocks.map((block) => block.text).join("\n\n"),
  });
}

function getBlockShortcut(text) {
  const shortcuts = [
    { marker: "# ", type: "heading1" },
    { marker: "## ", type: "heading2" },
    { marker: "- ", type: "bullet" },
    { marker: "1. ", type: "numbered" },
  ];

  const shortcut = shortcuts.find((item) => text === item.marker);

  if (!shortcut) {
    return null;
  }

  return {
    type: shortcut.type,
    text: "",
  };
}

async function insertBlockAfter(blockId) {
  const nextBlock = {
    id: crypto.randomUUID(),
    type: "paragraph",
    text: "",
  };
  const blocks = [];

  for (const block of props.page?.blocks || []) {
    blocks.push(block);
    if (block.id === blockId) {
      blocks.push(nextBlock);
    }
  }

  emit("update-page", {
    blocks,
    content: blocks.map((block) => block.text).join("\n\n"),
  });

  await nextTick();
  blockEditor.value?.focusBlock(nextBlock.id);
}

async function deleteEmptyBlock(blockId) {
  const currentBlocks = props.page?.blocks || [];

  if (currentBlocks.length <= 1) {
    return;
  }

  const blockIndex = currentBlocks.findIndex((block) => block.id === blockId);
  const previousBlock = currentBlocks[Math.max(0, blockIndex - 1)];
  const blocks = currentBlocks.filter((block) => block.id !== blockId);

  emit("update-page", {
    blocks,
    content: blocks.map((block) => block.text).join("\n\n"),
  });

  await nextTick();
  blockEditor.value?.focusBlock(previousBlock?.id || blocks[0]?.id);
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
      <BlockEditor
        ref="blockEditor"
        :blocks="page?.blocks || []"
        :disabled="!page"
        @update-block="updateBlock"
        @insert-block-after="insertBlockAfter"
        @delete-empty-block="deleteEmptyBlock"
      />
    </div>
  </section>
</template>
