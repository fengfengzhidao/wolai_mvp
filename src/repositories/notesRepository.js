const STORAGE_KEY = "wolai_mvp_pages";
const ACTIVE_PAGE_KEY = "wolai_mvp_active_page";

export const localNotesRepository = {
  loadPages() {
    try {
      const storedPages = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(storedPages) ? storedPages : [];
    } catch {
      return [];
    }
  },

  savePages(pages) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(pages) ? pages : []));
  },

  loadActivePageId() {
    return localStorage.getItem(ACTIVE_PAGE_KEY);
  },

  saveActivePageId(pageId) {
    if (pageId) {
      localStorage.setItem(ACTIVE_PAGE_KEY, pageId);
      return;
    }

    localStorage.removeItem(ACTIVE_PAGE_KEY);
  },
};
