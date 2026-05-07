<script setup>
import { basicSetup, EditorView } from "codemirror";
import { Compartment, EditorState, Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  CODE_LANGUAGES,
  getCodeLanguage,
  getCodeLanguageExtension,
} from "../utils/codeLanguages";

const props = defineProps({
  block: {
    type: Object,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  "update-code",
  "change-language",
  "insert-block-after",
  "focus",
  "blur",
]);

const editorRoot = ref(null);
const isLanguageMenuOpen = ref(false);
const languageQuery = ref("");
const copiedLabel = ref("复制");
let editorView = null;
let languageCompartment = null;
let editableCompartment = null;
let copyTimer = null;

const currentLanguage = computed(() => getCodeLanguage(props.block.language));
const filteredLanguages = computed(() => {
  const query = languageQuery.value.trim().toLowerCase();

  if (!query) {
    return CODE_LANGUAGES;
  }

  return CODE_LANGUAGES.filter((language) =>
    [language.value, language.label, ...(language.aliases || [])]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
});

function createEditor() {
  if (!editorRoot.value) {
    return;
  }

  languageCompartment = new Compartment();
  editableCompartment = new Compartment();

  editorView = new EditorView({
    parent: editorRoot.value,
    state: EditorState.create({
      doc: props.block.text || "",
      extensions: [
        Prec.high(
          keymap.of([
            {
              key: "Mod-Enter",
              run() {
                emit("insert-block-after", props.block.id);
                return true;
              },
            },
          ]),
        ),
        basicSetup,
        codeBlockTheme,
        languageCompartment.of(getCodeLanguageExtension(props.block.language)),
        editableCompartment.of(EditorView.editable.of(!props.disabled)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            emit("update-code", props.block.id, update.state.doc.toString());
          }
          if (update.focusChanged) {
            emit(update.view.hasFocus ? "focus" : "blur", props.block.id);
          }
        }),
      ],
    }),
  });
}

function syncEditorText(text) {
  if (!editorView || editorView.state.doc.toString() === text) {
    return;
  }

  editorView.dispatch({
    changes: {
      from: 0,
      to: editorView.state.doc.length,
      insert: text,
    },
  });
}

function syncLanguage(language) {
  if (!editorView || !languageCompartment) {
    return;
  }

  editorView.dispatch({
    effects: languageCompartment.reconfigure(getCodeLanguageExtension(language)),
  });
}

function syncEditable(disabled) {
  if (!editorView || !editableCompartment) {
    return;
  }

  editorView.dispatch({
    effects: editableCompartment.reconfigure(EditorView.editable.of(!disabled)),
  });
}

function selectLanguage(language) {
  emit("change-language", props.block.id, language.value);
  isLanguageMenuOpen.value = false;
  languageQuery.value = "";
  nextTick(() => editorView?.focus());
}

async function copyCode() {
  await navigator.clipboard.writeText(props.block.text || "");
  copiedLabel.value = "已复制";
  window.clearTimeout(copyTimer);
  copyTimer = window.setTimeout(() => {
    copiedLabel.value = "复制";
  }, 1200);
}

function focusEditor() {
  editorView?.focus();
}

defineExpose({
  focusEditor,
});

onMounted(() => {
  createEditor();
});

onBeforeUnmount(() => {
  window.clearTimeout(copyTimer);
  editorView?.destroy();
  editorView = null;
});

watch(
  () => props.block.text,
  (text) => {
    syncEditorText(text || "");
  },
);

watch(
  () => props.block.language,
  (language) => {
    syncLanguage(language);
  },
);

watch(
  () => props.disabled,
  (disabled) => {
    syncEditable(disabled);
  },
);

const codeBlockTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#111111",
      color: "#eeeeee",
      fontSize: "14px",
      minHeight: "124px",
    },
    ".cm-content": {
      caretColor: "#f4d6da",
      fontFamily:
        '"Cascadia Code", "Fira Code", Consolas, "Liberation Mono", monospace',
      lineHeight: "1.65",
      padding: "12px 14px",
    },
    ".cm-focused": {
      outline: "none",
    },
    ".cm-line": {
      padding: "0",
    },
    ".cm-scroller": {
      fontFamily:
        '"Cascadia Code", "Fira Code", Consolas, "Liberation Mono", monospace',
    },
    ".cm-gutters": {
      display: "none",
    },
    ".cm-activeLine": {
      backgroundColor: "transparent",
    },
    ".cm-selectionBackground": {
      backgroundColor: "rgba(138, 79, 85, 0.5) !important",
    },
  },
  { dark: true },
);
</script>

<template>
  <div class="code-block-shell">
    <div class="code-block-toolbar">
      <button
        class="code-language-button"
        type="button"
        @click="isLanguageMenuOpen = !isLanguageMenuOpen"
      >
        {{ currentLanguage.label }}
      </button>
      <button class="code-copy-button" type="button" @click="copyCode">
        {{ copiedLabel }}
      </button>
    </div>

    <div v-if="isLanguageMenuOpen" class="code-language-menu">
      <input
        v-model="languageQuery"
        class="code-language-search"
        type="text"
        placeholder="搜索语言"
      />
      <div class="code-language-list">
        <button
          v-for="language in filteredLanguages"
          :key="language.value"
          class="code-language-option"
          :class="{ 'is-active': language.value === currentLanguage.value }"
          type="button"
          @click="selectLanguage(language)"
        >
          {{ language.label }}
        </button>
      </div>
    </div>

    <div ref="editorRoot" class="code-editor-root"></div>
  </div>
</template>
