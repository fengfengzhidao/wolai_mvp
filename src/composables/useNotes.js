import { computed, ref } from "vue";
import { notesRepository as defaultNotesRepository } from "../repositories/notesRepository";

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
    icon: null,
    parentId: null,
    order: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizePageTreeFields(page, index) {
  return {
    ...page,
    icon: normalizePageIcon(page.icon),
    parentId: typeof page.parentId === "string" ? page.parentId : null,
    order: Number.isFinite(page.order) ? page.order : index,
  };
}

function normalizePageIcon(icon) {
  if (icon?.type !== "calendar") {
    return null;
  }

  return {
    type: "calendar",
    date: typeof icon.date === "string" ? icon.date : getTodayDateString(),
    color: typeof icon.color === "string" ? icon.color : "#a36f92",
  };
}

function getTodayDateString() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const date = String(today.getDate()).padStart(2, "0");

  return `${today.getFullYear()}-${month}-${date}`;
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

function normalizePages(pages) {
  return (Array.isArray(pages) ? pages : []).map((page, index) =>
    normalizePageTreeFields(migratePageBlocks(page), index),
  );
}

export function useNotes(notesRepository = defaultNotesRepository) {
  const pages = ref([]);
  const activePageId = ref(null);
  const saveStatus = ref("加载中");
  const saveTimer = ref(null);

  initializeNotes();

  const sortedPages = computed(() =>
    [...pages.value].sort((a, b) => b.updatedAt - a.updatedAt),
  );

  const activePage = computed(
    () => pages.value.find((page) => page.id === activePageId.value) || pages.value[0] || null,
  );

  async function initializeNotes() {
    try {
      const [loadedPages, loadedActivePageId] = await Promise.all([
        notesRepository.loadPages(),
        notesRepository.loadActivePageId(),
      ]);

      pages.value = normalizePages(loadedPages);
      activePageId.value = loadedActivePageId || pages.value[0]?.id || null;

      if (pages.value.length === 0) {
        const starterPage = createPage("欢迎使用 wolai_mvp", "这是你的第一篇笔记。");
        pages.value = [starterPage];
        activePageId.value = starterPage.id;
        await persistPages();
      }

      saveStatus.value = "已保存";
    } catch (error) {
      console.error(error);
      saveStatus.value = "后端连接失败";
    }
  }

  async function persistPages() {
    await Promise.all([
      notesRepository.savePages(pages.value),
      notesRepository.saveActivePageId(activePageId.value),
    ]);
  }

  function persistImmediately() {
    saveStatus.value = "保存中";
    persistPages()
      .then(() => {
        saveStatus.value = "已保存";
      })
      .catch((error) => {
        console.error(error);
        saveStatus.value = "保存失败";
      });
  }

  function queueSave() {
    saveStatus.value = "保存中";
    window.clearTimeout(saveTimer.value);

    saveTimer.value = window.setTimeout(() => {
      persistPages()
        .then(() => {
          saveStatus.value = "已保存";
        })
        .catch((error) => {
          console.error(error);
          saveStatus.value = "保存失败";
        });
    }, 350);
  }

  function getFirstOrder(parentId) {
    const siblingOrders = pages.value
      .filter((page) => page.parentId === parentId)
      .map((page) => page.order);

    return siblingOrders.length > 0 ? Math.min(...siblingOrders) : 0;
  }

  function normalizeSiblingOrders(parentId, insertedPageId, insertionIndex) {
    const siblings = pages.value
      .filter((page) => (page.parentId || null) === parentId)
      .sort((a, b) => {
        if (a.order !== b.order) {
          return a.order - b.order;
        }

        return b.updatedAt - a.updatedAt;
      });
    const insertedPage = siblings.find((page) => page.id === insertedPageId);

    if (!insertedPage) {
      return;
    }

    const orderedSiblings = siblings.filter((page) => page.id !== insertedPageId);
    orderedSiblings.splice(insertionIndex, 0, insertedPage);
    const orderMap = new Map(orderedSiblings.map((page, index) => [page.id, index]));

    pages.value = pages.value.map((page) =>
      orderMap.has(page.id)
        ? {
            ...page,
            order: orderMap.get(page.id),
          }
        : page,
    );
  }

  function createNewPage(parentId = null) {
    const newPage = createPage();
    newPage.parentId = parentId;
    newPage.order = getFirstOrder(parentId) - 1;
    pages.value = [newPage, ...pages.value];
    activePageId.value = newPage.id;
    persistImmediately();
  }

  function createChildPage(parentId) {
    createNewPage(parentId);
  }

  function createSiblingPageAfter(targetPageId) {
    const targetPage = pages.value.find((page) => page.id === targetPageId);

    if (!targetPage) {
      createNewPage();
      return;
    }

    const parentId = targetPage.parentId || null;
    const newPage = createPage();
    const siblings = pages.value
      .filter((page) => (page.parentId || null) === parentId)
      .sort((a, b) => {
        if (a.order !== b.order) {
          return a.order - b.order;
        }

        return b.updatedAt - a.updatedAt;
      });
    const targetIndex = siblings.findIndex((page) => page.id === targetPageId);

    newPage.parentId = parentId;
    pages.value = [newPage, ...pages.value];
    normalizeSiblingOrders(parentId, newPage.id, targetIndex + 1);
    activePageId.value = newPage.id;
    persistImmediately();
  }

  function renamePage(pageId, title) {
    pages.value = pages.value.map((page) =>
      page.id === pageId
        ? {
            ...page,
            title: String(title || "").trim() || "未命名页面",
            updatedAt: Date.now(),
          }
        : page,
    );

    persistImmediately();
  }

  function duplicatePage(pageId) {
    const sourcePage = pages.value.find((page) => page.id === pageId);

    if (!sourcePage) {
      return;
    }

    const now = Date.now();
    const parentId = sourcePage.parentId || null;
    const duplicatedPage = {
      ...sourcePage,
      id: crypto.randomUUID(),
      title: `${sourcePage.title?.trim() || "未命名页面"} 副本`,
      blocks: cloneBlocks(sourcePage.blocks),
      parentId,
      createdAt: now,
      updatedAt: now,
    };
    const siblings = pages.value
      .filter((page) => (page.parentId || null) === parentId)
      .sort((a, b) => {
        if (a.order !== b.order) {
          return a.order - b.order;
        }

        return b.updatedAt - a.updatedAt;
      });
    const sourceIndex = siblings.findIndex((page) => page.id === pageId);

    pages.value = [duplicatedPage, ...pages.value];
    normalizeSiblingOrders(parentId, duplicatedPage.id, sourceIndex + 1);
    activePageId.value = duplicatedPage.id;
    persistImmediately();
  }

  function selectPage(pageId) {
    activePageId.value = pageId;
    persistImmediately();
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

    persistImmediately();
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

    persistImmediately();
  }

  function movePageToParent(pageId, parentId = null) {
    if (pageId === parentId || (parentId && isDescendantPage(parentId, pageId))) {
      return;
    }

    const normalizedParentId = pages.value.some((page) => page.id === parentId)
      ? parentId
      : null;
    const siblingCount = pages.value.filter(
      (page) => page.id !== pageId && (page.parentId || null) === normalizedParentId,
    ).length;

    pages.value = pages.value.map((page) =>
      page.id === pageId
        ? {
            ...page,
            parentId: normalizedParentId,
            order: siblingCount,
            updatedAt: Date.now(),
          }
        : page,
    );

    persistImmediately();
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

  function updateActivePageIcon(icon) {
    updateActivePage({ icon: normalizePageIcon(icon) });
  }

  return {
    sortedPages,
    activePage,
    saveStatus,
    createNewPage,
    createChildPage,
    createSiblingPageAfter,
    selectPage,
    deletePage,
    renamePage,
    duplicatePage,
    movePage,
    movePageToParent,
    updateActivePage,
    updateActivePageIcon,
  };
}

function cloneBlocks(blocks) {
  return (Array.isArray(blocks) ? blocks : []).map((block) => ({
    ...block,
    id: crypto.randomUUID(),
  }));
}
