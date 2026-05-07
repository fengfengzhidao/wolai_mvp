const pageListEl = document.querySelector("#pageList");
const newPageButton = document.querySelector("#newPageButton");
const titleInput = document.querySelector("#titleInput");
const contentInput = document.querySelector("#contentInput");
const saveStatus = document.querySelector("#saveStatus");

const STORAGE_KEY = "wolai_mvp_pages";
const ACTIVE_PAGE_KEY = "wolai_mvp_active_page";

let pages = loadPages();
let activePageId = localStorage.getItem(ACTIVE_PAGE_KEY) || pages[0]?.id || null;

if (pages.length === 0) {
  const starterPage = createPage("欢迎使用 wolai_mvp", "这是你的第一篇笔记。");
  pages = [starterPage];
  activePageId = starterPage.id;
  persistPages();
}

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

function persistPages() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
  if (activePageId) {
    localStorage.setItem(ACTIVE_PAGE_KEY, activePageId);
  }
}

function getActivePage() {
  return pages.find((page) => page.id === activePageId) || pages[0] || null;
}

function renderPageList() {
  pageListEl.innerHTML = "";
}

newPageButton.addEventListener("click", () => {
  saveStatus.textContent = "已准备";
});

renderPageList();
