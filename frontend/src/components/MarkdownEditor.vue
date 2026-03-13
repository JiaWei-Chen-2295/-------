<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import { EditorView, keymap, placeholder, lineNumbers, highlightActiveLineGutter, drawSelection } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput } from "@codemirror/language";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";

const props = defineProps({
  modelValue: {
    type: String,
    required: true
  },
  previewHtml: {
    type: String,
    required: true
  },
  uploading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["update:modelValue", "upload-file", "paste-image", "insert-template"]);
const fileInput = ref(null);
const editorRef = ref(null);
let view = null;

/* Suppress update loops: when we programmatically set content we flip this
   flag so the updateListener knows not to emit back. */
let suppressEmit = false;

const editorTheme = EditorView.theme({
  "&": {
    flex: "1",
    minHeight: "0",
    fontSize: "13px",
    backgroundColor: "transparent"
  },
  "&.cm-focused": {
    outline: "none"
  },
  ".cm-scroller": {
    fontFamily: "var(--font-code)",
    lineHeight: "1.65",
    overflow: "auto"
  },
  ".cm-content": {
    padding: "16px 8px",
    caretColor: "var(--accent)"
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    borderRight: "1px solid rgba(31, 41, 55, 0.06)",
    color: "rgba(91, 100, 117, 0.5)",
    fontSize: "11px",
    minWidth: "36px"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--accent)"
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(201, 111, 53, 0.04)"
  },
  ".cm-selectionBackground": {
    backgroundColor: "rgba(201, 111, 53, 0.12) !important"
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "rgba(201, 111, 53, 0.16) !important"
  },
  ".cm-cursor": {
    borderLeftColor: "var(--accent)"
  },
  ".cm-placeholder": {
    color: "rgba(91, 100, 117, 0.4)",
    fontStyle: "italic"
  }
});

function handlePaste(event) {
  const items = Array.from(event.clipboardData?.items || []);
  const imageItem = items.find((item) => item.type.startsWith("image/"));
  if (!imageItem) return false;

  event.preventDefault();
  const file = imageItem.getAsFile();
  if (file) emit("paste-image", file);
  return true;
}

const pasteHandler = EditorView.domEventHandlers({
  paste: handlePaste
});

function createState(doc) {
  return EditorState.create({
    doc,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      history(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      markdown({ codeLanguages: languages }),
      EditorView.lineWrapping,
      placeholder("# 输入实验内容"),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
      editorTheme,
      pasteHandler,
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !suppressEmit) {
          emit("update:modelValue", update.state.doc.toString());
        }
      })
    ]
  });
}

onMounted(() => {
  view = new EditorView({
    state: createState(props.modelValue),
    parent: editorRef.value
  });
});

onBeforeUnmount(() => {
  view?.destroy();
  view = null;
});

/* Sync external value changes (insert template, reset draft, etc.) */
watch(
  () => props.modelValue,
  (newVal) => {
    if (!view) return;
    const current = view.state.doc.toString();
    if (newVal === current) return;

    suppressEmit = true;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: newVal }
    });
    suppressEmit = false;
  }
);

function openFilePicker() {
  fileInput.value?.click();
}

function onFileChange(event) {
  const [file] = event.target.files || [];
  if (file) emit("upload-file", file);
  event.target.value = "";
}
</script>

<template>
  <section class="panel workspace-panel">
    <div class="panel-header panel-header-inline">
      <div>
        <p class="eyebrow">Markdown Workspace</p>
        <h2>正文编辑与实时预览</h2>
        <span>支持标题、列表、代码块、图片粘贴与上传。</span>
      </div>
      <div class="editor-actions">
        <a-button @click="emit('insert-template')">插入示例</a-button>
        <a-button :loading="uploading" @click="openFilePicker">上传图片</a-button>
        <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden @change="onFileChange" />
      </div>
    </div>
    <div class="workspace-grid">
      <div class="editor-pane">
        <div class="pane-title">Markdown</div>
        <div ref="editorRef" class="cm-host" />
      </div>
      <div class="preview-pane">
        <div class="pane-title">Preview</div>
        <article class="preview-markdown" v-html="previewHtml" />
      </div>
    </div>
  </section>
</template>
