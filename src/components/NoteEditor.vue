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

function createBlock(type = "paragraph", text = "") {
  return {
    id: crypto.randomUUID(),
    type,
    text,
    checked: false,
  };
}

function getContentFromBlocks(blocks) {
  return blocks.map((block) => block.text).join("\n\n");
}

function toggleBlock(blockId, checked) {
  const blocks =
    props.page?.blocks.map((block) =>
      block.id === blockId
        ? {
            ...block,
            checked,
          }
        : block,
    ) || [];

  emit("update-page", {
    blocks,
    content: blocks.map((block) => block.text).join("\n\n"),
  });
}

function changeBlockType(blockId, type, text = "") {
  const blocks =
    props.page?.blocks.map((block) =>
      block.id === blockId
        ? {
            ...block,
            type,
            text,
            checked: type === "todo" ? block.checked : false,
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
    { marker: "[] ", type: "todo" },
    { marker: "[ ] ", type: "todo" },
    { marker: "```", type: "code" },
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

async function insertBlockAfter(blockId, type = "paragraph") {
  const nextBlock = createBlock(type);
  const blocks = [];

  for (const block of props.page?.blocks || []) {
    blocks.push(block);
    if (block.id === blockId) {
      blocks.push(nextBlock);
    }
  }

  emit("update-page", {
    blocks,
    content: getContentFromBlocks(blocks),
  });

  await nextTick();
  blockEditor.value?.focusBlock(nextBlock.id);
}

function parsePastedText(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const blocks = [];
  let codeLines = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("```")) {
      if (codeLines) {
        blocks.push(createBlock("code", codeLines.join("\n")));
        codeLines = null;
      } else {
        codeLines = [];
      }
      continue;
    }

    if (codeLines) {
      codeLines.push(line);
      continue;
    }

    const parsedBlock = parsePastedLine(line);
    if (parsedBlock) {
      blocks.push(parsedBlock);
    }
  }

  if (codeLines) {
    blocks.push(createBlock("code", codeLines.join("\n")));
  }

  return blocks.length > 0 ? blocks : [createBlock("paragraph", text)];
}

function parsePastedLine(line) {
  const trimmedLine = line.trim();

  if (!trimmedLine) {
    return null;
  }

  if (trimmedLine.startsWith("## ")) {
    return createBlock("heading2", trimmedLine.slice(3));
  }

  if (trimmedLine.startsWith("# ")) {
    return createBlock("heading1", trimmedLine.slice(2));
  }

  if (trimmedLine.startsWith("- ")) {
    return createBlock("bullet", trimmedLine.slice(2));
  }

  const numberedMatch = trimmedLine.match(/^\d+\.\s+(.*)$/);
  if (numberedMatch) {
    return createBlock("numbered", numberedMatch[1]);
  }

  const todoMatch = trimmedLine.match(/^\[(x|X| )?\]\s+(.*)$/);
  if (todoMatch) {
    return {
      ...createBlock("todo", todoMatch[2]),
      checked: todoMatch[1]?.toLowerCase() === "x",
    };
  }

  return createBlock("paragraph", line);
}

async function pasteBlocks(blockId, pasteDetail) {
  const currentBlocks = props.page?.blocks || [];
  const blockIndex = currentBlocks.findIndex((block) => block.id === blockId);

  if (blockIndex === -1) {
    return;
  }

  const currentBlock = currentBlocks[blockIndex];
  const selectionStart = pasteDetail.selectionStart ?? currentBlock.text.length;
  const selectionEnd = pasteDetail.selectionEnd ?? selectionStart;
  const beforeText = currentBlock.text.slice(0, selectionStart);
  const afterText = currentBlock.text.slice(selectionEnd);
  const pastedBlocks = parsePastedText(pasteDetail.text);
  const firstPastedBlock = pastedBlocks[0];
  const replacementBlocks = pastedBlocks.map((block, index) => {
    if (index === 0) {
      return {
        ...block,
        id: currentBlock.id,
        text: `${beforeText}${block.text}`,
      };
    }

    if (index === pastedBlocks.length - 1) {
      return {
        ...block,
        text: `${block.text}${afterText}`,
      };
    }

    return block;
  });

  if (pastedBlocks.length === 1) {
    replacementBlocks[0] = {
      ...firstPastedBlock,
      id: currentBlock.id,
      text: `${beforeText}${firstPastedBlock.text}${afterText}`,
    };
  }

  const blocks = [
    ...currentBlocks.slice(0, blockIndex),
    ...replacementBlocks,
    ...currentBlocks.slice(blockIndex + 1),
  ];

  emit("update-page", {
    blocks,
    content: getContentFromBlocks(blocks),
  });

  await nextTick();
  blockEditor.value?.focusBlock(replacementBlocks.at(-1)?.id || blockId);
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
        @toggle-block="toggleBlock"
        @change-block-type="changeBlockType"
        @insert-block-after="insertBlockAfter"
        @paste-blocks="pasteBlocks"
        @delete-empty-block="deleteEmptyBlock"
      />
    </div>
  </section>
</template>
