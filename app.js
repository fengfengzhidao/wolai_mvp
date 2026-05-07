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
  const sortedPages = [...pages].sort((a, b) => b.updatedAt - a.updatedAt);

  pageListEl.innerHTML = sortedPages
    .map((page) => {
      const title = escapeHtml(page.title.trim() || "未命名页面");
      const activeClass = page.id === activePageId ? " is-active" : "";

      return `
        <button class="page-list-item${activeClass}" type="button" data-page-id="${page.id}">
          <span class="page-title">${title}</span>
          <span class="page-time">${formatTime(page.updatedAt)}</span>
        </button>
      `;
    })
    .join("");
}

function renderEditor() {
  const activePage = getActivePage();

  if (!activePage) {
    titleInput.value = "";
    contentInput.value = "";
    titleInput.disabled = true;
    contentInput.disabled = true;
    return;
  }

  activePageId = activePage.id;
  titleInput.disabled = false;
  contentInput.disabled = false;
  titleInput.value = activePage.title;
  contentInput.value = activePage.content;
  saveStatus.textContent = "已保存";
  persistPages();
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

newPageButton.addEventListener("click", () => {
  const newPage = createPage();
  pages = [newPage, ...pages];
  activePageId = newPage.id;
  persistPages();
  renderPageList();
  renderEditor();
  titleInput.focus();
  titleInput.select();
});

pageListEl.addEventListener("click", (event) => {
  const pageButton = event.target.closest("[data-page-id]");

  if (!pageButton) {
    return;
  }

  activePageId = pageButton.dataset.pageId;
  renderPageList();
  renderEditor();
});

renderPageList();
renderEditor();
