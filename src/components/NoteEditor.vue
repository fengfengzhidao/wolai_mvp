<script setup>
import { computed, nextTick, ref, watch } from "vue";
import BlockEditor from "./BlockEditor.vue";
import { formatTime } from "../utils/formatTime";
import { normalizeCodeLanguage } from "../utils/codeLanguages";
import {
  changeBlockType as changeBlocksType,
  createBlock,
  deleteBlocks as deleteBlocksByIds,
  duplicateBlock as duplicateBlockById,
  getContentFromBlocks,
  insertBlockAfter as insertBlockAfterId,
  moveBlockToPosition,
  toggleBlockChecked,
  updateBlockLanguage,
  updateBlockText,
} from "../utils/blockOperations";

const props = defineProps({
  page: {
    type: Object,
    default: null,
  },
  pages: {
    type: Array,
    default: () => [],
  },
  saveStatus: {
    type: String,
    required: true,
  },
});

const emit = defineEmits([
  "update-page",
  "select-page",
  "create-child-page",
  "delete-page",
]);
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

const breadcrumbs = computed(() => {
  if (!props.page) {
    return [{ id: null, title: "个人空间" }];
  }

  const pageById = new Map(props.pages.map((page) => [page.id, page]));
  const path = [];
  let currentPage = props.page;

  while (currentPage) {
    path.unshift({
      id: currentPage.id,
      title: getPageTitle(currentPage),
    });
    currentPage = currentPage.parentId ? pageById.get(currentPage.parentId) : null;
  }

  return [{ id: null, title: "个人空间" }, ...path];
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
  const currentBlock = props.page?.blocks.find((block) => block.id === blockId);
  const shortcut = getBlockShortcut(text);
  const blocks = shortcut && currentBlock?.type !== "code"
    ? changeBlocksType(props.page?.blocks || [], blockId, shortcut.type, shortcut.text)
    : updateBlockText(props.page?.blocks || [], blockId, text);

  emit("update-page", {
    blocks,
    content: getContentFromBlocks(blocks),
  });
}

function getPageTitle(page) {
  return page?.title?.trim() || "未命名页面";
}

function selectBreadcrumb(pageId) {
  if (pageId && pageId !== props.page?.id) {
    emit("select-page", pageId);
  }
}

function requestCreateChildPage() {
  if (props.page?.id) {
    emit("create-child-page", props.page.id);
  }
}

function requestDeletePage() {
  if (!props.page?.id) {
    return;
  }

  const confirmed = window.confirm("确定要删除当前页面吗？");
  if (confirmed) {
    emit("delete-page", props.page.id);
  }
}

function changeBlockLanguage(blockId, language) {
  const blocks = updateBlockLanguage(props.page?.blocks || [], blockId, language);

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
    { marker: "###### ", type: "heading6" },
    { marker: "##### ", type: "heading5" },
    { marker: "#### ", type: "heading4" },
    { marker: "### ", type: "heading3" },
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
  let codeLanguage = "plaintext";

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("```")) {
      if (codeLines) {
        blocks.push(
          createBlock("code", codeLines.join("\n"), {
            language: codeLanguage,
          }),
        );
        codeLines = null;
        codeLanguage = "plaintext";
      } else {
        codeLines = [];
        codeLanguage = normalizeCodeLanguage(trimmedLine.slice(3));
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
    blocks.push(
      createBlock("code", codeLines.join("\n"), {
        language: codeLanguage,
      }),
    );
  }

  return blocks.length > 0 ? blocks : [createBlock("paragraph", text)];
}

function parsePastedLine(line) {
  const trimmedLine = line.trim();

  if (!trimmedLine) {
    return null;
  }

  const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.*)$/);
  if (headingMatch) {
    return createBlock(`heading${headingMatch[1].length}`, headingMatch[2]);
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

async function moveBlockToTarget(blockId, targetBlockId, position) {
  const blocks = moveBlockToPosition(
    props.page?.blocks || [],
    blockId,
    targetBlockId,
    position,
  );

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
    <header class="editor-topbar">
      <nav class="editor-breadcrumbs" aria-label="页面路径">
        <template
          v-for="(crumb, index) in breadcrumbs"
          :key="crumb.id || 'workspace'"
        >
          <button
            class="editor-breadcrumb"
            type="button"
            :disabled="!crumb.id || crumb.id === page?.id"
            @click="selectBreadcrumb(crumb.id)"
          >
            {{ crumb.title }}
          </button>
          <span
            v-if="index < breadcrumbs.length - 1"
            class="editor-breadcrumb-separator"
            aria-hidden="true"
          >
            ›
          </span>
        </template>
      </nav>
      <div class="editor-actions" aria-label="页面操作">
        <span class="editor-topbar-status">{{ saveStatus }}</span>
        <button
          class="editor-action-button"
          type="button"
          :disabled="!page"
          title="新建子页面"
          @click="requestCreateChildPage"
        >
          ＋
        </button>
        <button
          class="editor-action-button"
          type="button"
          :disabled="!page"
          title="删除当前页面"
          @click="requestDeletePage"
        >
          ×
        </button>
      </div>
    </header>
    <div class="editor-inner">
      <div class="editor-meta">
        <span>{{ page ? `更新于 ${formatTime(page.updatedAt)}` : "尚未保存" }}</span>
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
        @change-block-language="changeBlockLanguage"
        @toggle-block="toggleBlock"
        @change-block-type="changeBlockType"
        @insert-block-after="insertBlockAfter"
        @paste-blocks="pasteBlocks"
        @delete-empty-block="deleteEmptyBlock"
        @move-block-to-position="moveBlockToTarget"
        @duplicate-block="duplicateBlock"
        @delete-blocks="deleteBlocks"
      />
    </div>
  </section>
</template>
