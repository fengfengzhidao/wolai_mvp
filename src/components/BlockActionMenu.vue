<script setup>
defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  blockTypes: {
    type: Array,
    default: () => [],
  },
  currentType: {
    type: String,
    default: "paragraph",
  },
  canMoveUp: {
    type: Boolean,
    default: false,
  },
  canMoveDown: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  "close",
  "change-type",
  "move-up",
  "move-down",
  "duplicate",
  "delete",
]);

function getBlockTypeValue(blockType) {
  return typeof blockType === "string" ? blockType : blockType.type;
}

function getBlockTypeLabel(blockType) {
  return typeof blockType === "string" ? blockType : blockType.label || blockType.type;
}

function changeType(blockType) {
  const type = getBlockTypeValue(blockType);

  if (!type) {
    return;
  }

  emit("change-type", type);
  emit("close");
}

function moveUp() {
  emit("move-up");
  emit("close");
}

function moveDown() {
  emit("move-down");
  emit("close");
}

function duplicateBlock() {
  emit("duplicate");
  emit("close");
}

function deleteBlock() {
  emit("delete");
  emit("close");
}
</script>

<template>
  <div
    v-if="isOpen"
    class="block-action-menu"
    role="menu"
    @mousedown.prevent
  >
    <div class="block-action-menu-group">
      <div class="block-action-menu-submenu">
        <button
          class="block-action-menu-item block-action-menu-submenu-trigger"
          type="button"
          aria-haspopup="menu"
        >
          转换为
        </button>
        <div class="block-action-menu-submenu-content" role="menu">
          <button
            v-for="blockType in blockTypes"
            :key="getBlockTypeValue(blockType)"
            class="block-action-menu-item"
            :class="{ 'is-active': getBlockTypeValue(blockType) === currentType }"
            type="button"
            role="menuitemradio"
            :aria-checked="getBlockTypeValue(blockType) === currentType"
            @click="changeType(blockType)"
          >
            {{ getBlockTypeLabel(blockType) }}
          </button>
        </div>
      </div>
    </div>

    <div class="block-action-menu-group">
      <button
        class="block-action-menu-item"
        type="button"
        role="menuitem"
        :disabled="!canMoveUp"
        @click="moveUp"
      >
        上移
      </button>
      <button
        class="block-action-menu-item"
        type="button"
        role="menuitem"
        :disabled="!canMoveDown"
        @click="moveDown"
      >
        下移
      </button>
      <button
        class="block-action-menu-item"
        type="button"
        role="menuitem"
        @click="duplicateBlock"
      >
        复制
      </button>
      <button
        class="block-action-menu-item is-danger"
        type="button"
        role="menuitem"
        @click="deleteBlock"
      >
        删除
      </button>
    </div>
  </div>
</template>
