<script setup>
import { computed, nextTick, ref, watch } from "vue";
import CalendarPageIcon from "./CalendarPageIcon.vue";
import { formatTime } from "../utils/formatTime";

const props = defineProps({
  pages: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(["close", "open-result"]);

const searchInput = ref(null);
const query = ref("");
const selectedIndex = ref(0);
const titleOnly = ref(false);
const exactMatch = ref(false);
const sortMode = ref("relevance");

const pageById = computed(() => new Map(props.pages.map((page) => [page.id, page])));
const trimmedQuery = computed(() => query.value.trim());
const tokens = computed(() => {
  const source = trimmedQuery.value.toLowerCase();
  if (!source) {
    return [];
  }

  return exactMatch.value ? [source] : source.split(/\s+/).filter(Boolean);
});

const results = computed(() => {
  if (tokens.value.length === 0) {
    return [];
  }

  const matchedResults = props.pages
    .map((page) => buildSearchResult(page))
    .filter(Boolean);

  return matchedResults.sort((left, right) => {
    if (sortMode.value === "updated") {
      return right.page.updatedAt - left.page.updatedAt;
    }

    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return right.page.updatedAt - left.page.updatedAt;
  });
});

watch(results, () => {
  selectedIndex.value = 0;
});

nextTick(() => {
  searchInput.value?.focus();
});

function buildSearchResult(page) {
  const title = getPageTitle(page);
  const titleMatch = getMatchInfo(title);
  const blockMatch = titleOnly.value ? null : getBestBlockMatch(page);

  if (!titleMatch && !blockMatch) {
    return null;
  }

  const matchType = titleMatch ? "title" : "content";
  const matchedBlock = blockMatch?.block || null;
  const score = getResultScore(page, titleMatch, blockMatch);

  return {
    page,
    score,
    matchType,
    blockId: matchedBlock?.id || null,
    titleSegments: highlightText(title),
    snippetSegments: highlightText(
      matchType === "title"
        ? title
        : createSnippet(matchedBlock?.text || page.content || ""),
    ),
    path: getPagePath(page),
    updatedAt: page.updatedAt,
  };
}

function getBestBlockMatch(page) {
  const blocks = Array.isArray(page.blocks) ? page.blocks : [];
  let bestMatch = null;

  blocks.forEach((block) => {
    const matchInfo = getMatchInfo(block.text || "");
    if (!matchInfo) {
      return;
    }

    const score = matchInfo.count * 12 - Math.min(matchInfo.firstIndex, 80) / 10;
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        block,
        score,
        matchInfo,
      };
    }
  });

  return bestMatch;
}

function getMatchInfo(text) {
  const source = String(text || "").toLowerCase();
  if (!source) {
    return null;
  }

  const matchedTokens = tokens.value.filter((token) => source.includes(token));
  if (matchedTokens.length === 0) {
    return null;
  }

  if (exactMatch.value && matchedTokens.length !== tokens.value.length) {
    return null;
  }

  if (!exactMatch.value && matchedTokens.length < tokens.value.length) {
    return null;
  }

  return {
    count: matchedTokens.length,
    firstIndex: Math.min(...matchedTokens.map((token) => source.indexOf(token))),
    startsWith: matchedTokens.some((token) => source.startsWith(token)),
    exact: matchedTokens.some((token) => source === token),
  };
}

function getResultScore(page, titleMatch, blockMatch) {
  let score = 0;

  if (titleMatch) {
    score += 80;
    if (titleMatch.exact) {
      score += 80;
    }
    if (titleMatch.startsWith) {
      score += 30;
    }
    score += titleMatch.count * 12;
  }

  if (blockMatch) {
    score += blockMatch.score;
  }

  score += Math.min(Date.now() - page.updatedAt, 1000 * 60 * 60 * 24 * 30) * -0.00000001;
  return score;
}

function createSnippet(text) {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  if (!source) {
    return "";
  }

  const lowerSource = source.toLowerCase();
  const firstIndex = Math.max(
    0,
    Math.min(...tokens.value.map((token) => lowerSource.indexOf(token)).filter((index) => index >= 0)),
  );
  const start = Math.max(0, firstIndex - 28);
  const end = Math.min(source.length, firstIndex + 84);
  const prefix = start > 0 ? "... " : "";
  const suffix = end < source.length ? " ..." : "";

  return `${prefix}${source.slice(start, end)}${suffix}`;
}

function highlightText(text) {
  const source = String(text || "");
  if (!source || tokens.value.length === 0) {
    return [{ text: source, matched: false }];
  }

  const lowerSource = source.toLowerCase();
  const ranges = [];

  tokens.value.forEach((token) => {
    let index = lowerSource.indexOf(token);
    while (index !== -1) {
      ranges.push([index, index + token.length]);
      index = lowerSource.indexOf(token, index + token.length);
    }
  });

  const mergedRanges = mergeRanges(ranges);
  const segments = [];
  let cursor = 0;

  mergedRanges.forEach(([start, end]) => {
    if (start > cursor) {
      segments.push({ text: source.slice(cursor, start), matched: false });
    }
    segments.push({ text: source.slice(start, end), matched: true });
    cursor = end;
  });

  if (cursor < source.length) {
    segments.push({ text: source.slice(cursor), matched: false });
  }

  return segments;
}

function mergeRanges(ranges) {
  return ranges
    .filter(([start, end]) => start >= 0 && end > start)
    .sort((left, right) => left[0] - right[0])
    .reduce((merged, range) => {
      const previous = merged.at(-1);
      if (!previous || range[0] > previous[1]) {
        merged.push([...range]);
      } else {
        previous[1] = Math.max(previous[1], range[1]);
      }
      return merged;
    }, []);
}

function getPagePath(page) {
  const path = [];
  const visitedIds = new Set();
  let currentPage = page;

  while (currentPage && !visitedIds.has(currentPage.id)) {
    visitedIds.add(currentPage.id);
    path.unshift(getPageTitle(currentPage));
    currentPage = currentPage.parentId ? pageById.value.get(currentPage.parentId) : null;
  }

  return ["个人空间", ...path].join(" / ");
}

function getPageTitle(page) {
  return page?.title?.trim() || "未命名页面";
}

function openSelectedResult() {
  const result = results.value[selectedIndex.value];
  if (!result) {
    return;
  }

  emit("open-result", {
    pageId: result.page.id,
    blockId: result.blockId,
  });
}

function handleKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    selectedIndex.value = Math.min(selectedIndex.value + 1, results.value.length - 1);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    openSelectedResult();
  }
}
</script>

<template>
  <div class="search-dialog-backdrop" @click="$emit('close')">
    <section class="search-dialog" role="dialog" aria-modal="true" aria-label="搜索页面" @click.stop>
      <header class="search-dialog-header">
        <svg class="search-dialog-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          ref="searchInput"
          v-model="query"
          class="search-dialog-input"
          type="search"
          placeholder="搜索标题或正文"
          autocomplete="off"
          @keydown="handleKeydown"
        />
        <button class="search-dialog-close" type="button" aria-label="关闭搜索" @click="$emit('close')">
          ×
        </button>
      </header>
      <div class="search-filter-row">
        <label class="search-switch">
          <span>仅匹配标题</span>
          <input v-model="titleOnly" type="checkbox" />
          <i></i>
        </label>
        <label class="search-switch">
          <span>精确匹配</span>
          <input v-model="exactMatch" type="checkbox" />
          <i></i>
        </label>
        <label class="search-select-label">
          <span>排序</span>
          <select v-model="sortMode" class="search-sort-select">
            <option value="relevance">相关度</option>
            <option value="updated">最近更新</option>
          </select>
        </label>
      </div>
      <div class="search-result-meta">
        <span v-if="trimmedQuery">共 {{ results.length }} 条匹配结果</span>
        <span v-else>输入关键词开始搜索</span>
        <span>↑↓ 选择 / Enter 打开 / Esc 关闭</span>
      </div>
      <div class="search-result-list">
        <button
          v-for="(result, index) in results"
          :key="`${result.page.id}-${result.blockId || 'title'}`"
          class="search-result-item"
          :class="{ 'is-selected': index === selectedIndex }"
          type="button"
          @mouseenter="selectedIndex = index"
          @click="selectedIndex = index; openSelectedResult()"
        >
          <span class="search-result-icon">
            <CalendarPageIcon
              v-if="result.page.icon?.type === 'calendar'"
              :icon="result.page.icon"
              size="small"
            />
            <span v-else class="default-page-icon" aria-hidden="true">
              <span class="default-page-icon-line"></span>
              <span class="default-page-icon-line is-short"></span>
            </span>
          </span>
          <span class="search-result-body">
            <span class="search-result-title">
              <template v-for="(segment, segmentIndex) in result.titleSegments" :key="segmentIndex">
                <mark v-if="segment.matched">{{ segment.text }}</mark>
                <span v-else>{{ segment.text }}</span>
              </template>
            </span>
            <span class="search-result-snippet">
              <template v-for="(segment, segmentIndex) in result.snippetSegments" :key="segmentIndex">
                <mark v-if="segment.matched">{{ segment.text }}</mark>
                <span v-else>{{ segment.text }}</span>
              </template>
            </span>
          </span>
          <span class="search-result-side">
            <span>{{ result.path }}</span>
            <span>{{ formatTime(result.updatedAt) }}</span>
          </span>
        </button>
        <div v-if="trimmedQuery && results.length === 0" class="search-empty-state">
          没有匹配结果
        </div>
      </div>
    </section>
  </div>
</template>
