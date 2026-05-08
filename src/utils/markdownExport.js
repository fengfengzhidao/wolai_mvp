export function exportPageAsMarkdown(page, pages = []) {
  if (!page) {
    return;
  }

  const markdown = pageToMarkdown(page, pages);
  const blob = new Blob([markdown], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${getSafeFileName(getPageTitle(page), page.id)}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function pageToMarkdown(page, pages = []) {
  if (!page) {
    return "";
  }

  const path = getPagePath(page, pages);
  const lines = [];

  if (path.length > 1) {
    lines.push(`<!-- path: ${path.join(" / ")} -->`);
    lines.push("");
  }

  lines.push(`# ${getPageTitle(page)}`);
  lines.push("");

  const blocks = Array.isArray(page.blocks) ? page.blocks : [];
  let numberedIndex = 0;

  blocks.forEach((block) => {
    if (block.type === "numbered") {
      numberedIndex += 1;
    } else {
      numberedIndex = 0;
    }

    lines.push(blockToMarkdown(block, numberedIndex));
    lines.push("");
  });

  return `${trimTrailingEmptyLines(lines).join("\n")}\n`;
}

function blockToMarkdown(block, numberedIndex) {
  const text = typeof block.text === "string" ? block.text : "";

  if (/^heading[1-6]$/.test(block.type)) {
    const level = Number(block.type.replace("heading", ""));
    return `${"#".repeat(level)} ${text}`;
  }

  if (block.type === "bullet") {
    return `- ${text}`;
  }

  if (block.type === "numbered") {
    return `${numberedIndex || 1}. ${text}`;
  }

  if (block.type === "todo") {
    return `- [${block.checked ? "x" : " "}] ${text}`;
  }

  if (block.type === "code") {
    const language = block.language && block.language !== "plaintext" ? block.language : "";
    return [`\`\`\`${language}`, text, "```"].join("\n");
  }

  return text;
}

function getPagePath(page, pages) {
  const pageById = new Map(pages.map((item) => [item.id, item]));
  const path = [];
  const visitedPageIds = new Set();
  let currentPage = page;

  while (currentPage && !visitedPageIds.has(currentPage.id)) {
    visitedPageIds.add(currentPage.id);
    path.unshift(getPageTitle(currentPage));
    currentPage = currentPage.parentId ? pageById.get(currentPage.parentId) : null;
  }

  return path;
}

function getPageTitle(page) {
  return page?.title?.trim() || "未命名页面";
}

function getSafeFileName(title, fallbackId) {
  const safeTitle = title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  return safeTitle || `page-${fallbackId || Date.now()}`;
}

function trimTrailingEmptyLines(lines) {
  const nextLines = [...lines];

  while (nextLines.length > 0 && nextLines.at(-1) === "") {
    nextLines.pop();
  }

  return nextLines;
}
