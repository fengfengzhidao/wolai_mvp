<script setup>
defineProps({
  selectedCount: {
    type: Number,
    required: true,
  },
})

defineEmits(['delete-selected', 'clear-selection'])
</script>

<template>
  <div v-if="selectedCount > 0" class="bulk-block-toolbar">
    <span class="bulk-block-toolbar__count">已选择 {{ selectedCount }} 个块</span>
    <div class="bulk-block-toolbar__actions">
      <button
        type="button"
        class="bulk-block-toolbar__button bulk-block-toolbar__button--delete"
        @click="$emit('delete-selected')"
      >
        删除
      </button>
      <button
        type="button"
        class="bulk-block-toolbar__button bulk-block-toolbar__button--cancel"
        @click="$emit('clear-selection')"
      >
        取消
      </button>
    </div>
  </div>
</template>
