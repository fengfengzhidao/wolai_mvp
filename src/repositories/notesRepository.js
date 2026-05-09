const STORAGE_KEY = "wolai_mvp_pages";
const ACTIVE_PAGE_KEY = "wolai_mvp_active_page";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

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

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const apiNotesRepository = {
  async loadPages() {
    const data = await requestJson("/pages");
    return Array.isArray(data?.pages) ? data.pages : [];
  },

  async savePages(pages) {
    await requestJson("/pages/bulk", {
      method: "PUT",
      body: JSON.stringify({
        pages: Array.isArray(pages) ? pages : [],
      }),
    });
  },

  async loadActivePageId() {
    const data = await requestJson("/active-page");
    return data?.pageId || null;
  },

  async saveActivePageId(pageId) {
    await requestJson("/active-page", {
      method: "PUT",
      body: JSON.stringify({
        pageId: pageId || null,
      }),
    });
  },
};

export const notesRepository =
  import.meta.env.VITE_NOTES_STORAGE === "local"
    ? localNotesRepository
    : apiNotesRepository;
