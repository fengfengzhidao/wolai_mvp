export function getContentFromBlocks(blocks) {
  return normalizeBlocksInput(blocks).map((block) => block.text).join("\n\n");
}

export function createBlock(type = "paragraph", text = "", overrides = {}) {
  const blockType = overrides.type || type;

  return {
    id: crypto.randomUUID(),
    type: blockType,
    text,
    checked: false,
    ...overrides,
    type: blockType,
    text: typeof overrides.text === "string" ? overrides.text : text,
    checked:
      typeof overrides.checked === "boolean"
        ? overrides.checked
        : blockType === "todo"
          ? false
          : false,
  };
}

export function moveBlock(blocks, blockId, direction) {
  const nextBlocks = normalizeBlocksInput(blocks);
  const blockIndex = nextBlocks.findIndex((block) => block.id === blockId);
  const offset = direction === "up" ? -1 : direction === "down" ? 1 : 0;
  const targetIndex = blockIndex + offset;

  if (
    blockIndex === -1 ||
    offset === 0 ||
    targetIndex < 0 ||
    targetIndex >= nextBlocks.length
  ) {
    return nextBlocks;
  }

  [nextBlocks[blockIndex], nextBlocks[targetIndex]] = [
    nextBlocks[targetIndex],
    nextBlocks[blockIndex],
  ];

  return nextBlocks;
}

export function moveBlockBefore(blocks, blockId, targetBlockId) {
  return moveBlockToPosition(blocks, blockId, targetBlockId, "before");
}

export function moveBlockToPosition(
  blocks,
  blockId,
  targetBlockId,
  position = "before",
) {
  const currentBlocks = normalizeBlocksInput(blocks);
  const blockIndex = currentBlocks.findIndex((block) => block.id === blockId);
  const targetIndex = currentBlocks.findIndex((block) => block.id === targetBlockId);

  if (
    blockIndex === -1 ||
    targetIndex === -1 ||
    blockIndex === targetIndex
  ) {
    return currentBlocks;
  }

  const [movingBlock] = currentBlocks.splice(blockIndex, 1);
  const nextTargetIndex = currentBlocks.findIndex(
    (block) => block.id === targetBlockId,
  );
  const insertionIndex = position === "after" ? nextTargetIndex + 1 : nextTargetIndex;

  currentBlocks.splice(insertionIndex, 0, movingBlock);

  return currentBlocks;
}

export function duplicateBlock(blocks, blockId) {
  const currentBlocks = normalizeBlocksInput(blocks);
  const blockIndex = currentBlocks.findIndex((block) => block.id === blockId);

  if (blockIndex === -1) {
    return {
      blocks: currentBlocks,
      duplicatedBlockId: null,
    };
  }

  const sourceBlock = currentBlocks[blockIndex];
  const duplicatedBlock = createBlock(sourceBlock.type, sourceBlock.text, {
    checked: Boolean(sourceBlock.checked),
  });
  const nextBlocks = [
    ...currentBlocks.slice(0, blockIndex + 1),
    duplicatedBlock,
    ...currentBlocks.slice(blockIndex + 1),
  ];

  return {
    blocks: nextBlocks,
    duplicatedBlockId: duplicatedBlock.id,
  };
}

export function deleteBlocks(blocks, blockIds) {
  const currentBlocks = normalizeBlocksInput(blocks);
  const idsToDelete = new Set(Array.isArray(blockIds) ? blockIds : [blockIds]);
  const firstDeletedIndex = currentBlocks.findIndex((block) => idsToDelete.has(block.id));
  const nextBlocks = currentBlocks.filter((block) => !idsToDelete.has(block.id));

  if (nextBlocks.length === 0) {
    const fallbackBlock = createBlock();

    return {
      blocks: [fallbackBlock],
      focusBlockId: fallbackBlock.id,
    };
  }

  const focusIndex =
    firstDeletedIndex === -1
      ? 0
      : Math.min(firstDeletedIndex, nextBlocks.length - 1);

  return {
    blocks: nextBlocks,
    focusBlockId: nextBlocks[focusIndex]?.id || null,
  };
}

export function changeBlockType(blocks, blockId, type, text = "") {
  return normalizeBlocksInput(blocks).map((block) =>
    block.id === blockId
      ? {
          ...block,
          type,
          text,
          checked: type === "todo" ? Boolean(block.checked) : false,
        }
      : block,
  );
}

export function updateBlockText(blocks, blockId, text) {
  return normalizeBlocksInput(blocks).map((block) =>
    block.id === blockId
      ? {
          ...block,
          text,
        }
      : block,
  );
}

export function toggleBlockChecked(blocks, blockId, checked) {
  return normalizeBlocksInput(blocks).map((block) =>
    block.id === blockId
      ? {
          ...block,
          checked,
        }
      : block,
  );
}

export function insertBlockAfter(blocks, blockId, type = "paragraph") {
  const currentBlocks = normalizeBlocksInput(blocks);
  const blockIndex = currentBlocks.findIndex((block) => block.id === blockId);
  const insertedBlock = createBlock(type);

  if (blockIndex === -1) {
    return {
      blocks: [...currentBlocks, insertedBlock],
      insertedBlockId: insertedBlock.id,
    };
  }

  return {
    blocks: [
      ...currentBlocks.slice(0, blockIndex + 1),
      insertedBlock,
      ...currentBlocks.slice(blockIndex + 1),
    ],
    insertedBlockId: insertedBlock.id,
  };
}

function normalizeBlocksInput(blocks) {
  return Array.isArray(blocks) ? [...blocks] : [];
}
