<script setup>
import { computed, nextTick, ref, watch } from "vue";
import BlockEditor from "./BlockEditor.vue";
import { formatTime } from "../utils/formatTime";
import {
  changeBlockType as changeBlocksType,
  createBlock,
  deleteBlocks as deleteBlocksByIds,
  duplicateBlock as duplicateBlockById,
  getContentFromBlocks,
  insertBlockAfter as insertBlockAfterId,
  moveBlock as moveBlockById,
  toggleBlockChecked,
  updateBlockText,
} from "../utils/blockOperations";

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
  const blocks = shortcut
    ? changeBlocksType(props.page?.blocks || [], blockId, shortcut.type, shortcut.text)
    : updateBlockText(props.page?.blocks || [], blockId, text);

  emit("update-page", {
    blocks,
    content: getContentFromBlocks(blocks),
  });
}

function toggleBlock(blockId, checked) {
  const blocks = toggleBlockChecked(props.page?.blocks || [], blockId, checked);

  emit("update-page", {
    blocks,
    content: getContentFromBlocks(blocks),
  });
}

function changeBlockType(blockId, type, text = "") {
  const blocks = changeBlocksType(props.page?.blocks || [], blockId, type, text);

  emit("update-page", {
    blocks,
    content: getContentFromBlocks(blocks),
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
  const { blocks, insertedBlockId } = insertBlockAfterId(
    props.page?.blocks || [],
    blockId,
    type,
  );

  emit("update-page", {
    blocks,
    content: getContentFromBlocks(blocks),
  });

  await nextTick();
  blockEditor.value?.focusBlock(insertedBlockId);
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
  const { blocks, focusBlockId } = deleteBlocksByIds(props.page?.blocks || [], [blockId]);

  emit("update-page", {
    blocks,
    content: getContentFromBlocks(blocks),
  });

  await nextTick();
  blockEditor.value?.focusBlock(focusBlockId);
}

async function moveBlock(blockId, direction) {
  const blocks = moveBlockById(props.page?.blocks || [], blockId, direction);

  emit("update-page", {
    blocks,
    content: getContentFromBlocks(blocks),
  });

  await nextTick();
  blockEditor.value?.focusBlock(blockId);
}

async function duplicateBlock(blockId) {
  const { blocks, duplicatedBlockId } = duplicateBlockById(
    props.page?.blocks || [],
    blockId,
  );

  emit("update-page", {
    blocks,
    content: getContentFromBlocks(blocks),
  });

  await nextTick();
  blockEditor.value?.focusBlock(duplicatedBlockId || blockId);
}

async function deleteBlocks(blockIds) {
  const { blocks, focusBlockId } = deleteBlocksByIds(
    props.page?.blocks || [],
    blockIds,
  );

  emit("update-page", {
    blocks,
    content: getContentFromBlocks(blocks),
  });

  await nextTick();
  blockEditor.value?.focusBlock(focusBlockId);
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
        @move-block="moveBlock"
        @duplicate-block="duplicateBlock"
        @delete-blocks="deleteBlocks"
      />
    </div>
  </section>
</template>
