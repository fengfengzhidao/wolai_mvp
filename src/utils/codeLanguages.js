import { css } from "@codemirror/lang-css";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { php } from "@codemirror/lang-php";
import { python } from "@codemirror/lang-python";
import { sql } from "@codemirror/lang-sql";
import { vue } from "@codemirror/lang-vue";
import { yaml } from "@codemirror/lang-yaml";

export const CODE_LANGUAGES = [
  { value: "plaintext", label: "Plain Text", aliases: ["text", "plain"] },
  {
    value: "javascript",
    label: "JavaScript",
    aliases: ["js", "node"],
    extension: () => javascript(),
  },
  {
    value: "typescript",
    label: "TypeScript",
    aliases: ["ts"],
    extension: () => javascript({ typescript: true }),
  },
  { value: "html", label: "HTML", extension: () => html() },
  { value: "css", label: "CSS", extension: () => css() },
  { value: "json", label: "JSON", extension: () => json() },
  { value: "bash", label: "Bash", aliases: ["shell", "sh", "zsh"] },
  { value: "yaml", label: "YAML", aliases: ["yml"], extension: () => yaml() },
  { value: "markdown", label: "Markdown", aliases: ["md"], extension: () => markdown() },
  { value: "python", label: "Python", aliases: ["py"], extension: () => python() },
  { value: "go", label: "Go", aliases: ["golang"], extension: () => go() },
  { value: "sql", label: "SQL", extension: () => sql() },
  { value: "vue", label: "Vue", extension: () => vue() },
  { value: "php", label: "PHP", extension: () => php() },
];

export function getCodeLanguage(language) {
  return (
    CODE_LANGUAGES.find((item) => item.value === language) || CODE_LANGUAGES[0]
  );
}

export function normalizeCodeLanguage(language) {
  const normalizedLanguage = String(language || "").trim().toLowerCase();
  const matchedLanguage = CODE_LANGUAGES.find(
    (item) =>
      item.value === normalizedLanguage ||
      item.aliases?.includes(normalizedLanguage),
  );

  return matchedLanguage?.value || "plaintext";
}

export function getCodeLanguageExtension(language) {
  const languageConfig = getCodeLanguage(language);
  return languageConfig.extension?.() || [];
}
