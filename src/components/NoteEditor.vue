<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import BlockEditor from "./BlockEditor.vue";
import CalendarPageIcon from "./CalendarPageIcon.vue";
import { formatTime } from "../utils/formatTime";
import { normalizeCodeLanguage } from "../utils/codeLanguages";
import { exportPageAsMarkdown } from "../utils/markdownExport";
import { shareRepository } from "../repositories/notesRepository";
import {
  changeBlockType as changeBlocksType,
  createBlock,
  deleteBlocks as deleteBlocksByIds,
  duplicateBlock as duplicateBlockById,
  getContentFromBlocks,
  insertBlockAfter as insertBlockAfterId,
  insertBlockBefore as insertBlockBeforeId,
  moveBlockToPosition,
  toggleBlockChecked,
  updateBlockLanguage,
  updateBlockText,
} from "../utils/blockOperations";

const DEFAULT_CALENDAR_ICON_COLOR = "#cf75e6";
const PREFERRED_CODE_LANGUAGE_KEY = "fengfeng_notes_preferred_code_language";
const CALENDAR_ICON_COLORS = [
  { value: "#d95863", label: "珊瑚红" },
  { value: "#5caee5", label: "天空蓝" },
  { value: "#e6b55f", label: "琥珀黄" },
  { value: "#62bd94", label: "薄荷绿" },
  { value: "#cf75e6", label: "紫色" },
  { value: "#e15698", label: "玫粉" },
  { value: "#9c6b87", label: "浆果紫" },
  { value: "#626264", label: "石墨灰" },
];

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
  searchTarget: {
    type: Object,
    default: null,
  },
  isSidebarCollapsed: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  "update-page",
  "select-page",
  "create-child-page",
  "delete-page",
  "update-page-icon",
  "toggle-sidebar",
]);
const titleInput = ref(null);
const blockEditor = ref(null);
const isPageMenuOpen = ref(false);
const isCalendarPickerOpen = ref(false);
const calendarDraftDate = ref(getTodayDateString());
const calendarViewDate = ref(getMonthStart(new Date()));
const isShareDialogOpen = ref(false);
const shareUrl = ref("");
const shareStatusMessage = ref("");
const isShareLoading = ref(false);
const preferredCodeLanguage = ref(loadPreferredCodeLanguage());

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

const pageStats = computed(() => {
  const blocks = Array.isArray(props.page?.blocks) ? props.page.blocks : [];
  const text = blocks.map((block) => block.text || "").join("");

  return {
    blockCount: blocks.length,
    characterCount: Array.from(text.replace(/\s/g, "")).length,
  };
});

const activeCalendarColor = computed(
  () => props.page?.icon?.color || DEFAULT_CALENDAR_ICON_COLOR,
);

const calendarSelectedDateLabel = computed(() => formatDateLabel(calendarDraftDate.value));

const calendarMonthLabel = computed(() => {
  const date = calendarViewDate.value;

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
});

const calendarDays = computed(() => {
  const viewDate = calendarViewDate.value;
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const dateString = toDateString(date);

    return {
      key: dateString,
      date: dateString,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isSelected: dateString === calendarDraftDate.value,
      isToday: dateString === getTodayDateString(),
    };
  });
});

watch(
  () => props.page?.id,
  async () => {
    closeCalendarPicker();
    await nextTick();
    if (props.page?.title === "未命名页面") {
      titleInput.value?.focus();
      titleInput.value?.select();
    }
    focusSearchTargetBlock();
  },
);

watch(
  () => props.searchTarget?.nonce,
  () => {
    focusSearchTargetBlock();
  },
);

function updateBlock(blockId, text) {
  const currentBlock = props.page?.blocks.find((block) => block.id === blockId);
  const shortcut = getBlockShortcut(text);
  const blocks = shortcut && currentBlock?.type !== "code"
    ? changeBlocksType(
        props.page?.blocks || [],
        blockId,
        shortcut.type,
        shortcut.text,
        getManualCodeBlockOverrides(shortcut.type),
      )
    : updateBlockText(props.page?.blocks || [], blockId, text);

  emit("update-page", {
    blocks,
    content: getContentFromBlocks(blocks),
  });
}

function getPageTitle(page) {
  return page?.title?.trim() || "未命名页面";
}

async function focusSearchTargetBlock() {
  if (!props.searchTarget?.blockId) {
    return;
  }

  await nextTick();
  blockEditor.value?.revealBlock(props.searchTarget.blockId);
}

function selectBreadcrumb(pageId) {
  if (pageId && pageId !== props.page?.id) {
    emit("select-page", pageId);
  }
}

function requestCreateChildPage() {
  if (props.page?.id) {
    closePageMenu();
    emit("create-child-page", props.page.id);
  }
}

function requestDeletePage() {
  if (!props.page?.id) {
    return;
  }

  closePageMenu();
  const confirmed = window.confirm("确定要删除当前页面吗？");
  if (confirmed) {
    emit("delete-page", props.page.id);
  }
}

function requestExportMarkdown() {
  closePageMenu();
  exportPageAsMarkdown(props.page, props.pages);
}

async function requestSharePage() {
  if (!props.page?.id || isShareLoading.value) {
    return;
  }

  closePageMenu();
  isShareDialogOpen.value = true;
  shareStatusMessage.value = "正在生成分享链接...";
  isShareLoading.value = true;

  try {
    const share = await shareRepository.enablePageShare(props.page.id);
    shareUrl.value = createShareUrl(share?.token);
    shareStatusMessage.value = shareUrl.value ? "分享链接已开启" : "生成分享链接失败";
  } catch (error) {
    console.error(error);
    shareStatusMessage.value = "生成分享链接失败";
  } finally {
    isShareLoading.value = false;
  }
}

function createShareUrl(token) {
  if (!token) {
    return "";
  }

  return `${window.location.origin}/share/${encodeURIComponent(token)}`;
}

async function copyShareUrl() {
  if (!shareUrl.value) {
    return;
  }

  try {
    await navigator.clipboard?.writeText(shareUrl.value);
    shareStatusMessage.value = "链接已复制";
  } catch (error) {
    console.error(error);
    shareStatusMessage.value = "复制失败，请手动复制";
  }
}

async function disableSharePage() {
  if (!props.page?.id || isShareLoading.value) {
    return;
  }

  isShareLoading.value = true;
  shareStatusMessage.value = "正在关闭分享...";

  try {
    await shareRepository.disablePageShare(props.page.id);
    shareUrl.value = "";
    shareStatusMessage.value = "分享已关闭";
  } catch (error) {
    console.error(error);
    shareStatusMessage.value = "关闭分享失败";
  } finally {
    isShareLoading.value = false;
  }
}

function closeShareDialog() {
  isShareDialogOpen.value = false;
}

function addPageIcon() {
  closeCalendarPicker();
  emit("update-page-icon", {
    type: "calendar",
    date: getTodayDateString(),
    color: activeCalendarColor.value,
  });
}

function setCalendarIconColor(color) {
  if (!props.page?.icon) {
    emit("update-page-icon", {
      type: "calendar",
      date: getTodayDateString(),
      color,
    });
    return;
  }

  emit("update-page-icon", {
    ...props.page.icon,
    color,
  });
}

function removePageIcon() {
  closePageMenu();
  closeCalendarPicker();
  emit("update-page-icon", null);
}

function getTodayDateString() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const date = String(today.getDate()).padStart(2, "0");

  return `${today.getFullYear()}-${month}-${date}`;
}

function togglePageMenu() {
  if (!props.page) {
    return;
  }

  isPageMenuOpen.value = !isPageMenuOpen.value;

  if (isPageMenuOpen.value) {
    window.addEventListener("click", closePageMenu, { once: true });
  }
}

function closePageMenu() {
  isPageMenuOpen.value = false;
}

function toggleCalendarPicker() {
  if (!props.page?.icon) {
    return;
  }

  isCalendarPickerOpen.value = !isCalendarPickerOpen.value;

  if (isCalendarPickerOpen.value) {
    const iconDate = parseLocalDate(props.page.icon.date);
    calendarDraftDate.value = toDateString(iconDate);
    calendarViewDate.value = getMonthStart(iconDate);
    window.addEventListener("click", closeCalendarPicker, { once: true });
  }
}

function closeCalendarPicker() {
  isCalendarPickerOpen.value = false;
}

function selectCalendarDate(date) {
  calendarDraftDate.value = date;
}

function moveCalendarMonth(offset) {
  const nextDate = new Date(calendarViewDate.value);
  nextDate.setMonth(nextDate.getMonth() + offset);
  calendarViewDate.value = getMonthStart(nextDate);
}

function selectTodayInCalendar() {
  const today = new Date();
  calendarDraftDate.value = toDateString(today);
  calendarViewDate.value = getMonthStart(today);
}

function confirmCalendarDate() {
  if (!calendarDraftDate.value || !props.page?.icon) {
    return;
  }

  emit("update-page-icon", {
    ...props.page.icon,
    date: calendarDraftDate.value,
  });
  closeCalendarPicker();
}

function parseLocalDate(value) {
  if (!value) {
    return new Date();
  }

  const [year, month, date] = value.split("-").map(Number);

  if (!year || !month || !date) {
    return new Date();
  }

  return new Date(year, month - 1, date);
}

function toDateString(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatDateLabel(value) {
  const date = parseLocalDate(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

async function insertBlockAfterTitle() {
  if (!props.page) {
    return;
  }

  const insertedBlock = createBlock("paragraph", "");
  const blocks = [insertedBlock, ...(props.page.blocks || [])];

  emit("update-page", {
    blocks,
    content: getContentFromBlocks(blocks),
  });

  await nextTick();
  blockEditor.value?.focusBlock(insertedBlock.id);
}

function changeBlockLanguage(blockId, language) {
  preferredCodeLanguage.value = normalizeCodeLanguage(language);
  localStorage.setItem(PREFERRED_CODE_LANGUAGE_KEY, preferredCodeLanguage.value);

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

function changeBlockType(blockId, type, text) {
  const blocks = changeBlocksType(
    props.page?.blocks || [],
    blockId,
    type,
    text,
    getManualCodeBlockOverrides(type),
  );

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
    getManualCodeBlockOverrides(type),
  );

  emit("update-page", {
    blocks,
    content: getContentFromBlocks(blocks),
  });

  await nextTick();
  blockEditor.value?.focusBlock(insertedBlockId);
}

async function insertBlockBefore(blockId, type = "paragraph") {
  const { blocks, insertedBlockId } = insertBlockBeforeId(
    props.page?.blocks || [],
    blockId,
    type,
    getManualCodeBlockOverrides(type),
  );

  emit("update-page", {
    blocks,
    content: getContentFromBlocks(blocks),
  });

  await nextTick();
  blockEditor.value?.focusBlock(insertedBlockId);
}

function loadPreferredCodeLanguage() {
  return normalizeCodeLanguage(localStorage.getItem(PREFERRED_CODE_LANGUAGE_KEY));
}

function getManualCodeBlockOverrides(type) {
  return type === "code" ? { language: preferredCodeLanguage.value } : {};
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
    const previousBlock = blocks.at(-1);
    if (
      parsedBlock &&
      !(parsedBlock.text === "" && previousBlock?.type === "paragraph" && previousBlock.text === "")
    ) {
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

  const normalizedBlocks = normalizePastedBlocks(blocks);

  return normalizedBlocks.length > 0 ? normalizedBlocks : [createBlock("paragraph", text)];
}

function normalizePastedBlocks(blocks) {
  return blocks.filter((block, index) => {
    if (block.type !== "paragraph" || block.text !== "") {
      return true;
    }

    const previousBlock = blocks[index - 1];
    const nextBlock = blocks[index + 1];

    return !isHeadingBlock(previousBlock) && nextBlock?.type !== "code";
  });
}

function isHeadingBlock(block) {
  return /^heading[1-6]$/.test(block?.type || "");
}

function parsePastedLine(line) {
  const trimmedLine = line.trim();

  if (!trimmedLine) {
    return createBlock("paragraph", "");
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

onBeforeUnmount(() => {
  window.removeEventListener("click", closePageMenu);
  window.removeEventListener("click", closeCalendarPicker);
});
</script>

<template>
  <section class="editor-pane" aria-label="页面编辑区">
    <header class="editor-topbar">
      <div class="editor-navigation">
        <button
          class="editor-sidebar-toggle"
          type="button"
          :title="isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
          :aria-label="isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
          @click="$emit('toggle-sidebar')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5h16M4 12h16M4 19h16" />
          </svg>
        </button>
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
      </div>
      <div class="editor-actions" aria-label="页面操作">
        <span class="editor-topbar-status">{{ saveStatus }}</span>
        <button
          class="editor-action-button"
          type="button"
          :disabled="!page"
          title="页面选项"
          aria-label="页面选项"
          @click.stop="togglePageMenu"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="19" cy="12" r="1.5" />
          </svg>
        </button>
        <div
          v-if="isPageMenuOpen"
        class="page-options-menu"
          role="menu"
          @click.stop
        >
          <div class="page-options-tabs" aria-hidden="true">
            <span class="page-options-tab is-active">页面选项</span>
            <span class="page-options-tab">自定义页面</span>
          </div>
          <div class="page-options-section">
            <button class="page-options-item" type="button" role="menuitem" @click="requestCreateChildPage">
              <span class="page-options-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <span>新建子页面</span>
            </button>
            <button
              v-if="page?.icon"
              class="page-options-item"
              type="button"
              role="menuitem"
              @click="removePageIcon"
            >
              <span class="page-options-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12h14" />
                </svg>
              </span>
              <span>移除页面图标</span>
            </button>
            <button class="page-options-item" type="button" role="menuitem" @click="requestExportMarkdown">
              <span class="page-options-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 4v10M8 10l4 4 4-4M5 20h14" />
                </svg>
              </span>
              <span>导出 Markdown</span>
            </button>
            <button class="page-options-item" type="button" role="menuitem" @click="requestSharePage">
              <span class="page-options-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 12h8M13 7l5 5-5 5M5 5v14" />
                </svg>
              </span>
              <span>分享页面</span>
            </button>
            <button
              class="page-options-item is-danger"
              type="button"
              role="menuitem"
              @click="requestDeletePage"
            >
              <span class="page-options-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </span>
              <span>删除当前页面</span>
            </button>
          </div>
          <div class="page-options-section is-muted">
            <p>字数：{{ pageStats.characterCount }}</p>
            <p>块个数：{{ pageStats.blockCount }}</p>
            <p>创建时间：{{ page ? formatTime(page.createdAt) : "-" }}</p>
            <p>更新时间：{{ page ? formatTime(page.updatedAt) : "-" }}</p>
          </div>
        </div>
      </div>
    </header>
    <div class="editor-inner">
      <div class="editor-meta">
        <span>{{ page ? `更新于 ${formatTime(page.updatedAt)}` : "尚未保存" }}</span>
      </div>
      <div v-if="page && !page.icon" class="title-empty-icon-actions">
        <button class="title-empty-icon-button" type="button" @click="addPageIcon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M9 10h.01M15 10h.01M8.5 14.5c1.8 1.7 5.2 1.7 7 0" />
          </svg>
          <span>添加图标</span>
        </button>
      </div>
      <div v-if="page?.icon?.type === 'calendar'" class="title-calendar-icon-wrap">
        <button
          class="title-calendar-icon-button"
          type="button"
          title="选择日期"
          @click.stop="toggleCalendarPicker"
        >
          <CalendarPageIcon :icon="page.icon" size="large" />
        </button>
        <div
          v-if="isCalendarPickerOpen"
          class="calendar-date-popover"
          @click.stop
        >
          <div class="calendar-picker-head">
            <div class="calendar-picker-date">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              <span>{{ calendarSelectedDateLabel }}</span>
            </div>
            <button class="calendar-region-button" type="button">
              <span>中国</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m7 10 5 5 5-5" />
              </svg>
            </button>
          </div>
          <div class="calendar-picker-toolbar">
            <button class="calendar-month-button" type="button">
              <span>{{ calendarMonthLabel }}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m7 10 5 5 5-5" />
              </svg>
            </button>
            <div class="calendar-picker-actions">
              <button class="calendar-today-button" type="button" @click="selectTodayInCalendar">
                今天
              </button>
              <button class="calendar-nav-button" type="button" title="上个月" @click="moveCalendarMonth(-1)">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button class="calendar-nav-button" type="button" title="下个月" @click="moveCalendarMonth(1)">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>
          <div class="calendar-weekdays" aria-hidden="true">
            <span>一</span>
            <span>二</span>
            <span>三</span>
            <span>四</span>
            <span>五</span>
            <span>六</span>
            <span>日</span>
          </div>
          <div class="calendar-day-grid">
            <button
              v-for="day in calendarDays"
              :key="day.key"
              class="calendar-day-button"
              :class="{
                'is-muted': !day.isCurrentMonth,
                'is-selected': day.isSelected,
                'is-today': day.isToday,
              }"
              type="button"
              @click="selectCalendarDate(day.date)"
            >
              {{ day.day }}
            </button>
          </div>
          <div class="calendar-color-row" role="group" aria-label="选择日历图标颜色">
            <button
              v-for="color in CALENDAR_ICON_COLORS"
              :key="color.value"
              class="icon-color-swatch"
              :class="{ 'is-selected': activeCalendarColor === color.value }"
              type="button"
              :title="color.label"
              :aria-label="`选择${color.label}`"
              :style="{ '--icon-color': color.value }"
              @click="setCalendarIconColor(color.value)"
            >
              <svg v-if="activeCalendarColor === color.value" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 12 4 4 8-8" />
              </svg>
            </button>
          </div>
          <div class="calendar-picker-footer">
            <button class="calendar-cancel-button" type="button" @click="closeCalendarPicker">
              取消
            </button>
            <button class="calendar-confirm-button" type="button" @click="confirmCalendarDate">
              确定
            </button>
          </div>
        </div>
      </div>
      <input
        ref="titleInput"
        v-model="title"
        class="title-input"
        type="text"
        placeholder="未命名页面"
        autocomplete="off"
        :disabled="!page"
        @keydown.enter.prevent="insertBlockAfterTitle"
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
        @insert-block-before="insertBlockBefore"
        @paste-blocks="pasteBlocks"
        @delete-empty-block="deleteEmptyBlock"
        @move-block-to-position="moveBlockToTarget"
        @duplicate-block="duplicateBlock"
        @delete-blocks="deleteBlocks"
      />
    </div>
    <div
      v-if="isShareDialogOpen"
      class="share-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="分享页面"
      @click="closeShareDialog"
    >
      <section class="share-dialog" @click.stop>
        <header class="share-dialog-header">
          <div>
            <p>分享当前页面</p>
            <h2>{{ getPageTitle(page) }}</h2>
          </div>
          <button class="share-dialog-close" type="button" aria-label="关闭" @click="closeShareDialog">
            ×
          </button>
        </header>
        <p class="share-dialog-note">获得链接的人可以只读查看当前页面，不包含子页面。</p>
        <div class="share-link-row">
          <input
            class="share-link-input"
            type="text"
            :value="shareUrl"
            readonly
            placeholder="分享链接生成中"
            @focus="$event.target.select()"
          />
          <button class="share-primary-button" type="button" :disabled="!shareUrl || isShareLoading" @click="copyShareUrl">
            复制链接
          </button>
        </div>
        <p class="share-status-text">{{ shareStatusMessage }}</p>
        <div class="share-dialog-actions">
          <button class="share-secondary-button" type="button" :disabled="isShareLoading" @click="disableSharePage">
            关闭分享
          </button>
          <button class="share-secondary-button" type="button" @click="closeShareDialog">
            完成
          </button>
        </div>
      </section>
    </div>
  </section>
</template>
