<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";

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
  "toggle-block",
  "change-block-type",
  "insert-block-after",
  "paste-blocks",
  "delete-empty-block",
]);
const blockInputs = ref([]);
const focusedBlockId = ref(null);
const isPointerSelecting = ref(false);
const pointerStart = ref(null);
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

function getBlockPlaceholder(block) {
  const placeholders = {
    paragraph: "输入内容，回车新建块",
    heading1: "标题",
    heading2: "小标题",
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

async function focusBlock(blockId) {
  await nextTick();
  const input = blockInputs.value.find((item) => item?.dataset.blockId === blockId);
  input?.focus();
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
      handleEnter(block);
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

function handleEnter(block) {
  if (!block) {
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

function handleEditorPointerDown(event) {
  if (event.button !== 0) {
    return;
  }

  pointerStart.value = {
    x: event.clientX,
    y: event.clientY,
  };
  isPointerSelecting.value = false;
}

function handleDocumentPointerMove(event) {
  if (!pointerStart.value) {
    return;
  }

  const deltaX = Math.abs(event.clientX - pointerStart.value.x);
  const deltaY = Math.abs(event.clientY - pointerStart.value.y);

  if (deltaX > 4 || deltaY > 4) {
    isPointerSelecting.value = true;
  }
}

function handleDocumentPointerUp() {
  pointerStart.value = null;

  window.setTimeout(() => {
    isPointerSelecting.value = window.getSelection()?.toString().length > 0;
  }, 0);
}

function handleDocumentPointerDown(event) {
  if (!slashMenu.value.isOpen) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    closeSlashMenu();
    return;
  }

  const activeBlockInput = target.closest("[data-block-id]");
  const isActiveBlock =
    activeBlockInput?.dataset.blockId === slashMenu.value.blockId;

  if (!target.closest(".slash-menu") && !isActiveBlock) {
    closeSlashMenu();
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
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  document.addEventListener("pointermove", handleDocumentPointerMove);
  document.addEventListener("pointerup", handleDocumentPointerUp);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
  document.removeEventListener("pointermove", handleDocumentPointerMove);
  document.removeEventListener("pointerup", handleDocumentPointerUp);
});
</script>

<template>
  <div
    class="block-editor"
    aria-label="块编辑区"
    @pointerdown="handleEditorPointerDown"
  >
    <div v-for="block in blocks" :key="block.id" class="block-shell">
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
        <input
          v-if="block.type !== 'code'"
          ref="blockInputs"
          :data-block-id="block.id"
          class="text-block"
          :class="`is-${block.type}`"
          type="text"
          :value="block.text"
          :placeholder="getBlockPlaceholder(block)"
          :disabled="disabled"
          @focus="focusedBlockId = block.id"
          @blur="focusedBlockId = null"
          @input="handleInput($event, block.id)"
          @keydown="handleKeydown($event, block.id)"
          @paste="handlePaste($event, block.id)"
        />
        <textarea
          v-else
          ref="blockInputs"
          :data-block-id="block.id"
          class="text-block code-block"
          :class="`is-${block.type}`"
          :value="block.text"
          :placeholder="getBlockPlaceholder(block)"
          :disabled="disabled"
          rows="4"
          spellcheck="false"
          @focus="focusedBlockId = block.id"
          @blur="focusedBlockId = null"
          @input="handleInput($event, block.id)"
          @keydown="handleKeydown($event, block.id)"
        />
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
  </div>
</template>
