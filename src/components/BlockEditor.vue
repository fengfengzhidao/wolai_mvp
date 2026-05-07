<script setup>
import { nextTick, ref } from "vue";

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

const emit = defineEmits(["update-block", "insert-block-after", "delete-empty-block"]);
const blockInputs = ref([]);

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

defineExpose({
  focusBlock,
});
</script>

<template>
  <div class="block-editor" aria-label="块编辑区">
    <div
      v-for="block in blocks"
      :key="block.id"
      class="block-row"
      :class="`is-${block.type}`"
    >
      <span v-if="block.type === 'bullet'" class="block-marker">•</span>
      <span v-else-if="block.type === 'numbered'" class="block-marker">1.</span>
      <input
        v-else-if="block.type === 'todo'"
        class="todo-checkbox"
        type="checkbox"
        :checked="block.checked"
        :disabled="disabled"
        aria-label="待办状态"
      />
      <input
        ref="blockInputs"
        :data-block-id="block.id"
        class="text-block"
        :class="`is-${block.type}`"
        type="text"
        :value="block.text"
        placeholder="输入内容，回车新建块"
        :disabled="disabled"
        @input="$emit('update-block', block.id, $event.target.value)"
        @keydown.enter.prevent="$emit('insert-block-after', block.id)"
        @keydown.backspace="handleBackspace($event, block.id)"
      />
    </div>
  </div>
</template>
