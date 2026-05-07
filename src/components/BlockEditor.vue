<script setup>
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

defineEmits(["update-block"]);
</script>

<template>
  <div class="block-editor" aria-label="块编辑区">
    <input
      v-for="block in blocks"
      :key="block.id"
      class="text-block"
      type="text"
      :value="block.text"
      placeholder="输入内容，回车新建块"
      :disabled="disabled"
      @input="$emit('update-block', block.id, $event.target.value)"
    />
  </div>
</template>
