import { computed, ref } from "vue";

const STORAGE_KEY = "wolai_mvp_pages";
const ACTIVE_PAGE_KEY = "wolai_mvp_active_page";

function createBlock(text = "") {
  return {
    id: crypto.randomUUID(),
    type: "paragraph",
    text,
    checked: false,
  };
}

function normalizeBlock(block) {
  const type = block.type || "paragraph";

  return {
    id: block.id || crypto.randomUUID(),
    type,
    text: typeof block.text === "string" ? block.text : "",
    checked: Boolean(block.checked),
    language:
      type === "code"
        ? typeof block.language === "string"
          ? block.language
          : "plaintext"
        : undefined,
  };
}

function createPage(title = "未命名页面", content = "") {
  const now = Date.now();

  return {
    id: crypto.randomUUID(),
    title,
    content,
    blocks: [createBlock(content)],
    parentId: null,
    order: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizePageTreeFields(page, index) {
  return {
    ...page,
    parentId: typeof page.parentId === "string" ? page.parentId : null,
    order: Number.isFinite(page.order) ? page.order : index,
  };
}

function migratePageBlocks(page) {
  if (Array.isArray(page.blocks) && page.blocks.length > 0) {
    return {
      ...page,
      blocks: page.blocks.map(normalizeBlock),
    };
  }

  const content = typeof page.content === "string" ? page.content : "";
  const lines = content.split(/\n{2,}/).filter((line) => line.trim().length > 0);

  return {
    ...page,
    content,
    blocks: lines.length > 0 ? lines.map((line) => createBlock(line)) : [createBlock()],
  };
}

function loadPages() {
  try {
    const storedPages = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(storedPages)
      ? storedPages.map((page, index) => normalizePageTreeFields(migratePageBlocks(page), index))
      : [];
  } catch {
    return [];
  }
}

export function useNotes() {
  const initialPages = loadPages();
  const pages = ref(initialPages);
  const activePageId = ref(localStorage.getItem(ACTIVE_PAGE_KEY) || pages.value[0]?.id || null);
  const saveStatus = ref("已保存");
  const saveTimer = ref(null);

  if (pages.value.length === 0) {
    const starterPage = createPage("欢迎使用 wolai_mvp", "这是你的第一篇笔记。");
    pages.value = [starterPage];
    activePageId.value = starterPage.id;
    persistPages();
  }

  const sortedPages = computed(() =>
    [...pages.value].sort((a, b) => b.updatedAt - a.updatedAt),
  );

  const activePage = computed(
    () => pages.value.find((page) => page.id === activePageId.value) || pages.value[0] || null,
  );

  function persistPages() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pages.value));
    if (activePageId.value) {
      localStorage.setItem(ACTIVE_PAGE_KEY, activePageId.value);
    }
  }

  function queueSave() {
    saveStatus.value = "保存中";
    window.clearTimeout(saveTimer.value);

    saveTimer.value = window.setTimeout(() => {
      persistPages();
      saveStatus.value = "已保存";
    }, 350);
  }

  function getFirstOrder(parentId) {
    const siblingOrders = pages.value
      .filter((page) => page.parentId === parentId)
      .map((page) => page.order);

    return siblingOrders.length > 0 ? Math.min(...siblingOrders) : 0;
  }

  function createNewPage(parentId = null) {
    const newPage = createPage();
    newPage.parentId = parentId;
    newPage.order = getFirstOrder(parentId) - 1;
    pages.value = [newPage, ...pages.value];
    activePageId.value = newPage.id;
    persistPages();
  }

  function createChildPage(parentId) {
    createNewPage(parentId);
  }

  function selectPage(pageId) {
    activePageId.value = pageId;
    persistPages();
    saveStatus.value = "已保存";
  }

  function deletePage(pageId) {
    const deletedPageIds = new Set([pageId]);
    let changed = true;

    while (changed) {
      changed = false;
      pages.value.forEach((page) => {
        if (page.parentId && deletedPageIds.has(page.parentId) && !deletedPageIds.has(page.id)) {
          deletedPageIds.add(page.id);
          changed = true;
        }
      });
    }

    const nextPages = pages.value.filter((page) => !deletedPageIds.has(page.id));
    pages.value = nextPages;

    if (activePageId.value && deletedPageIds.has(activePageId.value)) {
      activePageId.value = nextPages[0]?.id || null;
    }

    if (!activePageId.value) {
      localStorage.removeItem(ACTIVE_PAGE_KEY);
    }

    persistPages();
    saveStatus.value = "已保存";
  }

  function isDescendantPage(pageId, possibleAncestorId) {
    let currentPage = pages.value.find((page) => page.id === pageId);

    while (currentPage?.parentId) {
      if (currentPage.parentId === possibleAncestorId) {
        return true;
      }

      currentPage = pages.value.find((page) => page.id === currentPage.parentId);
    }

    return false;
  }

  function movePage(draggedPageId, targetPageId, position = "after") {
    if (
      draggedPageId === targetPageId ||
      isDescendantPage(targetPageId, draggedPageId)
    ) {
      return;
    }

    const draggedPage = pages.value.find((page) => page.id === draggedPageId);
    const targetPage = pages.value.find((page) => page.id === targetPageId);

    if (!draggedPage || !targetPage) {
      return;
    }

    const nextParentId = position === "inside" ? targetPage.id : targetPage.parentId || null;
    const siblingPages = pages.value
      .filter((page) => page.id !== draggedPageId && (page.parentId || null) === nextParentId)
      .sort((a, b) => {
        if (a.order !== b.order) {
          return a.order - b.order;
        }

        return b.updatedAt - a.updatedAt;
      });
    const targetIndex = siblingPages.findIndex((page) => page.id === targetPageId);
    const insertionIndex =
      position === "inside"
        ? 0
        : Math.max(0, targetIndex + (position === "after" ? 1 : 0));
    const reorderedSiblings = [
      ...siblingPages.slice(0, insertionIndex),
      {
        ...draggedPage,
        parentId: nextParentId,
      },
      ...siblingPages.slice(insertionIndex),
    ];
    const orderedPageMap = new Map(
      reorderedSiblings.map((page, index) => [
        page.id,
        {
          parentId: nextParentId,
          order: index,
        },
      ]),
    );

    pages.value = pages.value.map((page) => {
      const orderedPage = orderedPageMap.get(page.id);

      if (!orderedPage) {
        return page;
      }

      return {
        ...page,
        ...orderedPage,
        updatedAt: page.id === draggedPageId ? Date.now() : page.updatedAt,
      };
    });

    persistPages();
    saveStatus.value = "已保存";
  }

  function updateActivePage(changes) {
    pages.value = pages.value.map((page) => {
      if (page.id !== activePageId.value) {
        return page;
      }

      return {
        ...page,
        ...changes,
        updatedAt: Date.now(),
      };
    });

    queueSave();
  }

  return {
    sortedPages,
    activePage,
    saveStatus,
    createNewPage,
    createChildPage,
    selectPage,
    deletePage,
    movePage,
    updateActivePage,
  };
}
