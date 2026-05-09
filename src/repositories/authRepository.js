const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const REQUEST_TIMEOUT = 8000;

async function requestJson(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  }).finally(() => {
    window.clearTimeout(timeoutId);
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || `API request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const authRepository = {
  async getCurrentUser() {
    const data = await requestJson("/auth/me");
    return data?.user || null;
  },

  async login(username, password) {
    const data = await requestJson("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    return data?.user || null;
  },

  async register(username, password) {
    const data = await requestJson("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    return data?.user || null;
  },

  async logout() {
    await requestJson("/auth/logout", {
      method: "POST",
    });
  },
};
