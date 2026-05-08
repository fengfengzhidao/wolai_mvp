<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import BlockActionMenu from "./BlockActionMenu.vue";
import CodeBlock from "./CodeBlock.vue";

const props = defineProps({
  blocks: {
    type: Array,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  "update-block",
  "change-block-language",
  "toggle-block",
  "change-block-type",
  "insert-block-after",
  "insert-block-before",
  "paste-blocks",
  "delete-empty-block",
  "move-block-to-position",
  "duplicate-block",
  "delete-blocks",
]);
const blockInputs = ref([]);
const focusedBlockId = ref(null);
const isPointerSelecting = ref(false);
const pointerStart = ref(null);
const pointerCurrent = ref(null);
const pointerStartedInEditable = ref(false);
const selectedBlockIds = ref([]);
const selectionStartPoint = ref(null);
const dragBlockId = ref(null);
const didDropBlock = ref(false);
const blockMenu = ref({
  isOpen: false,
  blockId: null,
  x: 0,
  y: 0,
});
const imageMenu = ref({
  isOpen: false,
  blockId: null,
  image: null,
  x: 0,
  y: 0,
});
const previewImage = ref(null);
const slashMenu = ref({
  isOpen: false,
  blockId: null,
  selectedIndex: 0,
  query: "",
});

const blockTypeOptions = [
  {
    type: "paragraph",
    label: "正文",
    description: "普通文本块",
    keywords: ["text", "p"],
  },
  {
    type: "heading1",
    label: "一级标题",
    description: "大标题",
    keywords: ["h1", "title", "biaoti"],
  },
  {
    type: "heading2",
    label: "二级标题",
    description: "小标题",
    keywords: ["h2", "subtitle", "biaoti"],
  },
  {
    type: "heading3",
    label: "三级标题",
    description: "章节标题",
    keywords: ["h3", "biaoti"],
  },
  {
    type: "heading4",
    label: "四级标题",
    description: "小节标题",
    keywords: ["h4", "biaoti"],
  },
  {
    type: "heading5",
    label: "五级标题",
    description: "段落标题",
    keywords: ["h5", "biaoti"],
  },
  {
    type: "heading6",
    label: "六级标题",
    description: "辅助标题",
    keywords: ["h6", "biaoti"],
  },
  {
    type: "bullet",
    label: "无序列表",
    description: "项目符号列表",
    keywords: ["ul", "list", "bullet"],
  },
  {
    type: "numbered",
    label: "有序列表",
    description: "编号列表",
    keywords: ["ol", "list", "number"],
  },
  {
    type: "todo",
    label: "待办",
    description: "可勾选任务",
    keywords: ["task", "check", "todo"],
  },
  {
    type: "code",
    label: "代码",
    description: "多行代码块",
    keywords: ["code", "pre", "```"],
  },
];

const listBlockTypes = ["bullet", "numbered"];

const filteredBlockTypeOptions = computed(() => {
  const query = slashMenu.value.query.trim().toLowerCase();

  if (!query) {
    return blockTypeOptions;
  }

  return blockTypeOptions.filter((option) => {
    const searchableText = [
      option.type,
      option.label,
      option.description,
      ...option.keywords,
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(query);
  });
});

const blockTypeMenuItems = computed(() =>
  blockTypeOptions.map((option) => ({
    type: option.type,
    label: option.label,
  })),
);

const selectionBoxStyle = computed(() => {
  if (!isPointerSelecting.value || !selectionStartPoint.value || !pointerCurrent.value) {
    return null;
  }

  const left = Math.min(selectionStartPoint.value.x, pointerCurrent.value.x);
  const top = Math.min(selectionStartPoint.value.y, pointerCurrent.value.y);
  const width = Math.abs(selectionStartPoint.value.x - pointerCurrent.value.x);
  const height = Math.abs(selectionStartPoint.value.y - pointerCurrent.value.y);

  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
  };
});

function getBlockPlaceholder(block) {
  const placeholders = {
    paragraph: "输入内容，回车新建块",
    heading1: "标题",
    heading2: "小标题",
    heading3: "三级标题",
    heading4: "四级标题",
    heading5: "五级标题",
    heading6: "六级标题",
    bullet: "列表项",
    numbered: "列表项",
    todo: "待办事项",
    code: "输入代码",
  };

  if (focusedBlockId.value !== block.id || isPointerSelecting.value) {
    return "";
  }

  return placeholders[block.type] || placeholders.paragraph;
}

function getNumberedIndex(blockId) {
  const blockIndex = props.blocks.findIndex((block) => block.id === blockId);

  if (blockIndex === -1) {
    return 1;
  }

  let numberedIndex = 1;

  for (let index = blockIndex - 1; index >= 0; index -= 1) {
    if (props.blocks[index].type !== "numbered") {
      break;
    }

    numberedIndex += 1;
  }

  return numberedIndex;
}

function isBlockSelected(blockId) {
  return selectedBlockIds.value.includes(blockId);
}

function clearBlockSelection() {
  selectedBlockIds.value = [];
}

async function focusBlock(blockId) {
  await nextTick();
  focusBlockAt(blockId, "start");
}

async function focusBlockAt(blockId, position = "start") {
  focusedBlockId.value = blockId;
  await nextTick();
  const input = blockInputs.value.find(
    (item) => item?.dataset?.blockId === blockId || item?.$el?.dataset?.blockId === blockId,
  );
  if (input?.focusEditor) {
    input.focusEditor(position);
    return;
  }

  resizeBlockInput(input);
  input?.focus();
  if (input instanceof HTMLTextAreaElement) {
    const cursorPosition = position === "end" ? input.value.length : 0;
    input.setSelectionRange(cursorPosition, cursorPosition);
    requestAnimationFrame(() => resizeBlockInput(input));
  }
}

function hasMarkdownPreview(block) {
  return block.type !== "code" && parseMarkdownPreview(block.text).some(
    (token) => token.type !== "text",
  );
}

function getImageBlockToken(block) {
  if (block.type === "code") {
    return null;
  }

  const tokens = parseMarkdownPreview(block.text);
  const imageTokens = tokens.filter((token) => token.type === "image" && token.url);
  const hasOtherContent = tokens.some((token) =>
    token.type === "text" ? token.value.trim() !== "" : token.type !== "image",
  );

  return imageTokens.length === 1 && !hasOtherContent ? imageTokens[0] : null;
}

function parseMarkdownPreview(text) {
  const sourceText = typeof text === "string" ? text : "";
  const tokens = [];
  const markdownPattern =
    /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|`([^`\n]+)`|\*\*([^*\n]+)\*\*/g;
  let cursor = 0;
  let match = markdownPattern.exec(sourceText);

  while (match) {
    if (match.index > cursor) {
      tokens.push({
        type: "text",
        value: sourceText.slice(cursor, match.index),
      });
    }

    if (match[1] !== undefined) {
      tokens.push({
        type: "image",
        alt: match[1],
        url: sanitizeMarkdownUrl(match[2]),
      });
    } else if (match[3] !== undefined) {
      tokens.push({
        type: "link",
        label: match[3],
        url: sanitizeMarkdownUrl(match[4]),
      });
    } else if (match[5] !== undefined) {
      tokens.push({
        type: "inlineCode",
        value: match[5],
      });
    } else {
      tokens.push({
        type: "strong",
        value: match[6],
      });
    }

    cursor = markdownPattern.lastIndex;
    match = markdownPattern.exec(sourceText);
  }

  if (cursor < sourceText.length) {
    tokens.push({
      type: "text",
      value: sourceText.slice(cursor),
    });
  }

  return tokens;
}

function sanitizeMarkdownUrl(url) {
  const trimmedUrl = String(url || "").trim();

  if (/^javascript:/i.test(trimmedUrl)) {
    return "";
  }

  return trimmedUrl;
}

function focusPreviewBlock(event, blockId) {
  if (event.target.closest("a")) {
    return;
  }

  focusBlockAt(blockId, "end");
}

function selectImageBlock(blockId) {
  closeBlockMenu();
  closeImageMenu();
  selectedBlockIds.value = [blockId];
}

function openImagePreview(image) {
  closeImageMenu();
  previewImage.value = image;
}

function closeImagePreview() {
  previewImage.value = null;
}

function openImageMenu(event, blockId, image) {
  event.preventDefault();
  event.stopPropagation();
  selectImageBlock(blockId);
  closeBlockMenu();
  imageMenu.value = {
    isOpen: true,
    blockId,
    image,
    x: event.clientX,
    y: event.clientY,
  };
}

function closeImageMenu() {
  imageMenu.value.isOpen = false;
}

async function copyImageLink() {
  const url = imageMenu.value.image?.url;
  closeImageMenu();

  if (!url) {
    return;
  }

  await navigator.clipboard?.writeText(url);
}

function editImageBlock() {
  const blockId = imageMenu.value.blockId;
  closeImageMenu();

  if (blockId) {
    focusBlockAt(blockId, "end");
  }
}

function deleteImageBlock() {
  const blockId = imageMenu.value.blockId;
  closeImageMenu();

  if (blockId) {
    emit("delete-blocks", [blockId]);
  }
}

function downloadImage() {
  const image = imageMenu.value.image;
  closeImageMenu();

  if (!image?.url) {
    return;
  }

  const link = document.createElement("a");
  link.href = image.url;
  link.download = image.alt || "image";
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function updateCodeBlock(blockId, text) {
  emit("update-block", blockId, text);
}

function changeCodeBlockLanguage(blockId, language) {
  emit("change-block-language", blockId, language);
}

function resizeBlockInput(input) {
  if (!(input instanceof HTMLTextAreaElement) || input.classList.contains("code-block")) {
    return;
  }

  input.style.height = "auto";
  input.style.height = `${input.scrollHeight}px`;
}

async function handleTextBlockFocus(event, blockId) {
  focusedBlockId.value = blockId;
  await nextTick();
  resizeBlockInput(event.target);
}

async function resizeAllBlockInputs() {
  await nextTick();
  blockInputs.value.forEach((input) => resizeBlockInput(input));
}

function handleBackspace(event, blockId) {
  if (event.target.value !== "" || event.target.selectionStart !== 0) {
    return;
  }

  event.preventDefault();
  emit("delete-empty-block", blockId);
}

function handlePaste(event, blockId) {
  const pastedText = event.clipboardData?.getData("text/plain") || "";

  if (!pastedText.includes("\n")) {
    return;
  }

  event.preventDefault();
  emit("paste-blocks", blockId, {
    text: pastedText,
    selectionStart: event.target.selectionStart,
    selectionEnd: event.target.selectionEnd,
  });
}

function handleInput(event, blockId) {
  const value = event.target.value;
  const block = props.blocks.find((item) => item.id === blockId);
  resizeBlockInput(event.target);
  emit("update-block", blockId, value);

  if (block?.type === "code") {
    return;
  }

  if (value.startsWith("/")) {
    openSlashMenu(blockId, value.slice(1));
    return;
  }

  if (slashMenu.value.blockId === blockId) {
    closeSlashMenu();
  }
}

function handleKeydown(event, blockId) {
  const block = props.blocks.find((item) => item.id === blockId);

  if (!slashMenu.value.isOpen || slashMenu.value.blockId !== blockId) {
    if (block?.type === "code") {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        emit("insert-block-after", blockId);
      }

      if (event.key === "Backspace") {
        handleBackspace(event, blockId);
      }

      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      handleEnter(block, event.target);
    }

    if (event.key === "ArrowUp" && isAtTextStart(event.target)) {
      event.preventDefault();
      focusAdjacentBlock(blockId, "previous");
    }

    if (event.key === "ArrowDown" && isAtTextEnd(event.target)) {
      event.preventDefault();
      focusAdjacentBlock(blockId, "next");
    }

    if (event.key === "Backspace") {
      handleBackspace(event, blockId);
    }

    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (filteredBlockTypeOptions.value.length === 0) {
      return;
    }

    slashMenu.value.selectedIndex =
      (slashMenu.value.selectedIndex + 1) % filteredBlockTypeOptions.value.length;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (filteredBlockTypeOptions.value.length === 0) {
      return;
    }

    slashMenu.value.selectedIndex =
      (slashMenu.value.selectedIndex - 1 + filteredBlockTypeOptions.value.length) %
      filteredBlockTypeOptions.value.length;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    const selectedOption = filteredBlockTypeOptions.value[slashMenu.value.selectedIndex];
    if (selectedOption) {
      selectBlockType(selectedOption.type);
    }
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeSlashMenu();
  }
}

function isAtTextStart(target) {
  return (
    target instanceof HTMLTextAreaElement &&
    target.selectionStart === 0 &&
    target.selectionEnd === 0
  );
}

function isAtTextEnd(target) {
  return (
    target instanceof HTMLTextAreaElement &&
    target.selectionStart === target.value.length &&
    target.selectionEnd === target.value.length
  );
}

function focusAdjacentBlock(blockId, direction) {
  const blockIndex = props.blocks.findIndex((block) => block.id === blockId);

  if (blockIndex === -1) {
    return;
  }

  const nextBlock =
    direction === "previous"
      ? props.blocks[blockIndex - 1]
      : props.blocks[blockIndex + 1];

  if (!nextBlock) {
    return;
  }

  focusBlockAt(nextBlock.id, direction === "previous" ? "end" : "start");
}

function handleEnter(block, target) {
  if (!block) {
    return;
  }

  if (isAtTextStart(target)) {
    emit("insert-block-before", block.id);
    return;
  }

  if (listBlockTypes.includes(block.type)) {
    if (block.text.trim() === "") {
      emit("change-block-type", block.id, "paragraph");
      return;
    }

    emit("insert-block-after", block.id, block.type);
    return;
  }

  if (block.type === "code") {
    emit("insert-block-after", block.id);
    return;
  }

  emit("insert-block-after", block.id);
}

function openSlashMenu(blockId, query = "") {
  slashMenu.value = {
    isOpen: true,
    blockId,
    selectedIndex: 0,
    query,
  };
}

function closeSlashMenu() {
  slashMenu.value.isOpen = false;
  slashMenu.value.query = "";
}

function openBlockMenu(event, blockId) {
  event.preventDefault();
  event.stopPropagation();
  clearBlockSelection();
  closeImageMenu();
  blockMenu.value = {
    isOpen: true,
    blockId,
    x: event.clientX,
    y: event.clientY,
  };
}

function closeBlockMenu() {
  blockMenu.value.isOpen = false;
}

async function duplicateBlock() {
  const blockId = blockMenu.value.blockId;
  closeBlockMenu();

  if (blockId) {
    emit("duplicate-block", blockId);
  }
}

function deleteMenuBlock() {
  const blockId = blockMenu.value.blockId;
  closeBlockMenu();

  if (blockId) {
    emit("delete-blocks", [blockId]);
  }
}

async function selectMenuBlockType(type) {
  const blockId = blockMenu.value.blockId;
  closeBlockMenu();

  if (!blockId) {
    return;
  }

  emit("change-block-type", blockId, type);
  await focusBlock(blockId);
}

function deleteSelectedBlocks() {
  if (selectedBlockIds.value.length === 0) {
    return;
  }

  emit("delete-blocks", selectedBlockIds.value);
  clearBlockSelection();
}

function startBlockSelection(event) {
  pointerStartedInEditable.value = false;
  pointerStart.value = {
    x: event.clientX,
    y: event.clientY,
  };
  pointerCurrent.value = pointerStart.value;
  selectionStartPoint.value = pointerStart.value;
  isPointerSelecting.value = false;
}

function isBlockSelectionStartZone(event, target) {
  if (event.button !== 0 || !(target instanceof Element)) {
    return false;
  }

  if (target.closest(".block-action-menu, .image-action-menu, .slash-menu")) {
    return false;
  }

  const editorPane = target.closest(".editor-pane");
  const editorInner = target.closest(".editor-pane")?.querySelector(".editor-inner");

  if (!editorPane || !editorInner) {
    return false;
  }

  const paneRect = editorPane.getBoundingClientRect();
  const innerRect = editorInner.getBoundingClientRect();
  const gutterRight = innerRect.left - 12;

  return (
    event.clientX >= paneRect.left &&
    event.clientX <= gutterRight &&
    event.clientY >= paneRect.top &&
    event.clientY <= paneRect.bottom
  );
}

function handleDocumentPointerMove(event) {
  if (!pointerStart.value) {
    return;
  }

  const horizontalDelta = event.clientX - pointerStart.value.x;
  const deltaX = Math.abs(horizontalDelta);
  const deltaY = Math.abs(event.clientY - pointerStart.value.y);
  pointerCurrent.value = {
    x: event.clientX,
    y: event.clientY,
  };

  if (horizontalDelta <= 2) {
    isPointerSelecting.value = false;
    return;
  }

  if (deltaX > 2 || deltaY > 2) {
    isPointerSelecting.value = true;
  }
}

function handleDocumentPointerUp(event) {
  if (!pointerStart.value && !selectionStartPoint.value) {
    return;
  }

  const startPoint = selectionStartPoint.value;
  const endPoint = {
    x: event.clientX,
    y: event.clientY,
  };
  const movedFarEnough =
    startPoint &&
    (Math.abs(endPoint.x - startPoint.x) > 2 ||
      Math.abs(endPoint.y - startPoint.y) > 2);
  const shouldSelectBlocks =
    movedFarEnough && startPoint && !didDropBlock.value && endPoint.x - startPoint.x > 2;

  pointerCurrent.value = endPoint;
  pointerStart.value = null;

  window.setTimeout(() => {
    if (shouldSelectBlocks) {
      selectBlocksInPointerRange(startPoint);
    }

    selectionStartPoint.value = null;
    pointerCurrent.value = null;
    pointerStartedInEditable.value = false;
    didDropBlock.value = false;
    isPointerSelecting.value = false;
  }, 0);
}

function selectBlocksInPointerRange(startPoint) {
  const selection = window.getSelection();

  if (selection?.toString()) {
    selection.removeAllRanges();
  }

  const blockShells = Array.from(document.querySelectorAll(".block-shell"));
  const endPoint = pointerCurrent.value || startPoint;
  const selectionRect = {
    left: Math.min(startPoint.x, endPoint.x) - 8,
    right: Math.max(startPoint.x, endPoint.x) + 8,
    top: Math.min(startPoint.y, endPoint.y) - 8,
    bottom: Math.max(startPoint.y, endPoint.y) + 8,
  };

  selectedBlockIds.value = blockShells
    .filter((shell) => {
      const rect = shell.getBoundingClientRect();
      return (
        rect.left < selectionRect.right &&
        rect.right > selectionRect.left &&
        rect.top < selectionRect.bottom &&
        rect.bottom > selectionRect.top
      );
    })
    .map((shell) => shell.dataset.blockId)
    .filter(Boolean);
}

function handleBlockDragStart(event, blockId) {
  if (pointerStartedInEditable.value || event.target.closest("input, textarea")) {
    event.preventDefault();
    return;
  }

  dragBlockId.value = blockId;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", blockId);
}

function handleBlockDragOver(event, blockId) {
  if (!dragBlockId.value || dragBlockId.value === blockId) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function handleBlockDrop(event, blockId) {
  event.preventDefault();

  if (
    pointerStartedInEditable.value ||
    !dragBlockId.value ||
    dragBlockId.value === blockId
  ) {
    dragBlockId.value = null;
    return;
  }

  const targetRect = event.currentTarget.getBoundingClientRect();
  const position =
    event.clientY > targetRect.top + targetRect.height / 2 ? "after" : "before";

  emit("move-block-to-position", dragBlockId.value, blockId, position);
  didDropBlock.value = true;
  dragBlockId.value = null;
}

function handleBlockDragEnd() {
  dragBlockId.value = null;
}

function handleDocumentKeydown(event) {
  if (event.key === "Escape" && previewImage.value) {
    event.preventDefault();
    closeImagePreview();
    return;
  }

  if (event.key !== "Backspace" || selectedBlockIds.value.length === 0) {
    return;
  }

  const target = event.target;
  if (
    target instanceof HTMLElement &&
    target.closest(".block-action-menu, .image-action-menu, .slash-menu")
  ) {
    return;
  }

  event.preventDefault();
  deleteSelectedBlocks();
}

function handleDocumentPointerDown(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    closeSlashMenu();
    closeBlockMenu();
    closeImageMenu();
    return;
  }

  if (isBlockSelectionStartZone(event, target)) {
    startBlockSelection(event);
  } else {
    pointerStart.value = null;
    pointerCurrent.value = null;
    selectionStartPoint.value = null;
    isPointerSelecting.value = false;
  }

  if (slashMenu.value.isOpen) {
    const activeBlockInput = target.closest("[data-block-id]");
    const isActiveBlock =
      activeBlockInput?.dataset.blockId === slashMenu.value.blockId;

    if (!target.closest(".slash-menu") && !isActiveBlock) {
      closeSlashMenu();
    }
  }

  if (
    event.button === 0 &&
    selectedBlockIds.value.length > 0 &&
    !target.closest(".block-shell") &&
    !target.closest(".block-action-menu") &&
    !target.closest(".image-action-menu") &&
    !target.closest(".slash-menu")
  ) {
    clearBlockSelection();
  }

  if (
    blockMenu.value.isOpen &&
    !target.closest(".block-action-menu") &&
    !target.closest(".block-shell")
  ) {
    closeBlockMenu();
  }

  if (
    imageMenu.value.isOpen &&
    !target.closest(".image-action-menu") &&
    !target.closest(".block-shell")
  ) {
    closeImageMenu();
  }
}

async function selectBlockType(type) {
  const blockId = slashMenu.value.blockId;
  closeSlashMenu();

  if (!blockId) {
    return;
  }

  emit("change-block-type", blockId, type);
  await focusBlock(blockId);
}

defineExpose({
  focusBlock,
});

onMounted(() => {
  resizeAllBlockInputs();
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  document.addEventListener("pointermove", handleDocumentPointerMove);
  document.addEventListener("pointerup", handleDocumentPointerUp);
  document.addEventListener("keydown", handleDocumentKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
  document.removeEventListener("pointermove", handleDocumentPointerMove);
  document.removeEventListener("pointerup", handleDocumentPointerUp);
  document.removeEventListener("keydown", handleDocumentKeydown);
});

watch(
  () => props.blocks.map((block) => `${block.id}:${block.text}`).join("|"),
  () => {
    resizeAllBlockInputs();
  },
);
</script>

<template>
  <div
    class="block-editor"
    aria-label="块编辑区"
  >
    <div
      v-if="selectionBoxStyle"
      class="block-selection-box"
      :style="selectionBoxStyle"
    ></div>

    <div
      v-for="block in blocks"
      :key="block.id"
      :data-block-id="block.id"
      class="block-shell"
      :class="{ 'is-selected': isBlockSelected(block.id) }"
      draggable="true"
      @contextmenu="openBlockMenu($event, block.id)"
      @dragstart="handleBlockDragStart($event, block.id)"
      @dragover="handleBlockDragOver($event, block.id)"
      @drop="handleBlockDrop($event, block.id)"
      @dragend="handleBlockDragEnd"
    >
      <div class="block-row" :class="`is-${block.type}`">
        <span v-if="block.type === 'bullet'" class="block-marker">•</span>
        <span v-else-if="block.type === 'numbered'" class="block-marker">
          {{ getNumberedIndex(block.id) }}.
        </span>
        <input
          v-else-if="block.type === 'todo'"
          class="todo-checkbox"
          type="checkbox"
          :checked="block.checked"
          :disabled="disabled"
          aria-label="待办状态"
          @change="$emit('toggle-block', block.id, $event.target.checked)"
        />
        <textarea
          v-if="block.type !== 'code'"
          v-show="focusedBlockId === block.id || !hasMarkdownPreview(block)"
          ref="blockInputs"
          :data-block-id="block.id"
          class="text-block"
          :class="`is-${block.type}`"
          :value="block.text"
          :placeholder="getBlockPlaceholder(block)"
          :disabled="disabled"
          rows="1"
          @focus="handleTextBlockFocus($event, block.id)"
          @blur="focusedBlockId = null"
          @input="handleInput($event, block.id)"
          @keydown="handleKeydown($event, block.id)"
          @paste="handlePaste($event, block.id)"
        />
        <div
          v-if="block.type !== 'code' && focusedBlockId !== block.id && getImageBlockToken(block)"
          class="image-block-preview"
          role="button"
          tabindex="0"
          title="双击预览图片"
          @click.stop="selectImageBlock(block.id)"
          @dblclick.stop="openImagePreview(getImageBlockToken(block))"
          @contextmenu="openImageMenu($event, block.id, getImageBlockToken(block))"
          @keydown.enter.prevent="openImagePreview(getImageBlockToken(block))"
        >
          <img
            class="image-block-asset"
            :src="getImageBlockToken(block).url"
            :alt="getImageBlockToken(block).alt"
            draggable="false"
          />
          <span v-if="getImageBlockToken(block).alt" class="image-block-caption">
            {{ getImageBlockToken(block).alt }}
          </span>
        </div>
        <div
          v-if="
            block.type !== 'code' &&
            focusedBlockId !== block.id &&
            hasMarkdownPreview(block) &&
            !getImageBlockToken(block)
          "
          class="markdown-block-preview"
          :class="`is-${block.type}`"
          role="button"
          tabindex="0"
          @click="focusPreviewBlock($event, block.id)"
          @keydown.enter.prevent="focusBlockAt(block.id, 'end')"
        >
          <template
            v-for="(token, tokenIndex) in parseMarkdownPreview(block.text)"
            :key="`${block.id}-${tokenIndex}`"
          >
            <span v-if="token.type === 'text'">{{ token.value }}</span>
            <code
              v-else-if="token.type === 'inlineCode'"
              class="markdown-preview-code"
            >
              {{ token.value }}
            </code>
            <strong
              v-else-if="token.type === 'strong'"
              class="markdown-preview-strong"
            >
              {{ token.value }}
            </strong>
            <a
              v-else-if="token.type === 'link' && token.url"
              class="markdown-preview-link"
              :href="token.url"
              target="_blank"
              rel="noreferrer"
            >
              {{ token.label }}
            </a>
            <img
              v-else-if="token.type === 'image' && token.url"
              class="markdown-preview-image"
              :src="token.url"
              :alt="token.alt"
            />
          </template>
        </div>
        <CodeBlock
          v-if="block.type === 'code'"
          ref="blockInputs"
          :block="block"
          :disabled="disabled"
          :data-block-id="block.id"
          @update-code="updateCodeBlock"
          @change-language="changeCodeBlockLanguage"
          @insert-block-after="$emit('insert-block-after', block.id)"
          @focus-adjacent="focusAdjacentBlock"
          @focus="focusedBlockId = block.id"
          @blur="focusedBlockId = null"
        />
      </div>
      <BlockActionMenu
        :is-open="blockMenu.isOpen && blockMenu.blockId === block.id"
        :block-types="blockTypeMenuItems"
        :current-type="block.type"
        :style="{ left: `${blockMenu.x}px`, top: `${blockMenu.y}px` }"
        @close="closeBlockMenu"
        @change-type="selectMenuBlockType"
        @duplicate="duplicateBlock"
        @delete="deleteMenuBlock"
      />
      <div
        v-if="imageMenu.isOpen && imageMenu.blockId === block.id"
        class="image-action-menu"
        :style="{ left: `${imageMenu.x}px`, top: `${imageMenu.y}px` }"
        role="menu"
        @mousedown.prevent
      >
        <button class="image-action-menu-item" type="button" role="menuitem" @click="openImagePreview(imageMenu.image)">
          全屏查看
        </button>
        <button class="image-action-menu-item" type="button" role="menuitem" @click="copyImageLink">
          复制链接
        </button>
        <button class="image-action-menu-item" type="button" role="menuitem" @click="downloadImage">
          下载
        </button>
        <button class="image-action-menu-item" type="button" role="menuitem" @click="editImageBlock">
          编辑图片
        </button>
        <button class="image-action-menu-item is-danger" type="button" role="menuitem" @click="deleteImageBlock">
          删除
        </button>
      </div>
      <div
        v-if="slashMenu.isOpen && slashMenu.blockId === block.id"
        class="slash-menu"
        @mousedown.prevent
      >
        <button
          v-for="(option, index) in filteredBlockTypeOptions"
          :key="option.type"
          class="slash-menu-item"
          :class="{ 'is-selected': index === slashMenu.selectedIndex }"
          type="button"
          @mouseenter="slashMenu.selectedIndex = index"
          @click="selectBlockType(option.type)"
        >
          <span class="slash-menu-label">{{ option.label }}</span>
          <span class="slash-menu-description">{{ option.description }}</span>
        </button>
        <div v-if="filteredBlockTypeOptions.length === 0" class="slash-menu-empty">
          没有匹配的块类型
        </div>
      </div>
    </div>
    <div
      v-if="previewImage"
      class="image-preview-overlay"
      role="dialog"
      aria-modal="true"
      @click="closeImagePreview"
    >
      <button
        class="image-preview-close"
        type="button"
        aria-label="关闭图片预览"
        @click.stop="closeImagePreview"
      >
        ×
      </button>
      <img
        class="image-preview-asset"
        :src="previewImage.url"
        :alt="previewImage.alt"
        @click.stop
      />
    </div>
  </div>
</template>
