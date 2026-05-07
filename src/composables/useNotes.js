import { computed, ref } from "vue";

const STORAGE_KEY = "wolai_mvp_pages";
const ACTIVE_PAGE_KEY = "wolai_mvp_active_page";

function createPage(title = "未命名页面", content = "") {
  const now = Date.now();

  return {
    id: crypto.randomUUID(),
    title,
    content,
    createdAt: now,
    updatedAt: now,
  };
}

function loadPages() {
  try {
    const storedPages = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(storedPages) ? storedPages : [];
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

  function createNewPage() {
    const newPage = createPage();
    pages.value = [newPage, ...pages.value];
    activePageId.value = newPage.id;
    persistPages();
  }

  function selectPage(pageId) {
    activePageId.value = pageId;
    persistPages();
    saveStatus.value = "已保存";
  }

  function deletePage(pageId) {
    const nextPages = pages.value.filter((page) => page.id !== pageId);
    pages.value = nextPages;

    if (activePageId.value === pageId) {
      activePageId.value = nextPages[0]?.id || null;
    }

    if (!activePageId.value) {
      localStorage.removeItem(ACTIVE_PAGE_KEY);
    }

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
    selectPage,
    deletePage,
    updateActivePage,
  };
}
