<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";

defineProps({
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
});

const blockTypeOptions = [
  {
    type: "paragraph",
    label: "正文",
    description: "普通文本块",
  },
  {
    type: "heading1",
    label: "一级标题",
    description: "大标题",
  },
  {
    type: "heading2",
    label: "二级标题",
    description: "小标题",
  },
  {
    type: "bullet",
    label: "无序列表",
    description: "项目符号列表",
  },
  {
    type: "numbered",
    label: "有序列表",
    description: "编号列表",
  },
  {
    type: "todo",
    label: "待办",
    description: "可勾选任务",
  },
];

function getBlockPlaceholder(blockId) {
  if (focusedBlockId.value !== blockId || isPointerSelecting.value) {
    return "";
  }

  return "输入内容，回车新建块";
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

function handleInput(event, blockId) {
  const value = event.target.value;
  emit("update-block", blockId, value);

  if (value === "/") {
    openSlashMenu(blockId);
    return;
  }

  if (slashMenu.value.blockId === blockId) {
    closeSlashMenu();
  }
}

function handleKeydown(event, blockId) {
  if (!slashMenu.value.isOpen || slashMenu.value.blockId !== blockId) {
    if (event.key === "Enter") {
      event.preventDefault();
      emit("insert-block-after", blockId);
    }

    if (event.key === "Backspace") {
      handleBackspace(event, blockId);
    }

    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    slashMenu.value.selectedIndex =
      (slashMenu.value.selectedIndex + 1) % blockTypeOptions.length;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    slashMenu.value.selectedIndex =
      (slashMenu.value.selectedIndex - 1 + blockTypeOptions.length) %
      blockTypeOptions.length;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    selectBlockType(blockTypeOptions[slashMenu.value.selectedIndex].type);
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeSlashMenu();
  }
}

function openSlashMenu(blockId) {
  slashMenu.value = {
    isOpen: true,
    blockId,
    selectedIndex: 0,
  };
}

function closeSlashMenu() {
  slashMenu.value.isOpen = false;
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
        <span v-else-if="block.type === 'numbered'" class="block-marker">1.</span>
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
          ref="blockInputs"
          :data-block-id="block.id"
          class="text-block"
          :class="`is-${block.type}`"
          type="text"
          :value="block.text"
          :placeholder="getBlockPlaceholder(block.id)"
          :disabled="disabled"
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
          v-for="(option, index) in blockTypeOptions"
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
      </div>
    </div>
  </div>
</template>
