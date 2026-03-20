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
let lastSelection = { from: 0, to: 0 };

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
  if (file) emit("paste-image", { file, selection: { ...lastSelection } });
  return true;
}

function handleDrop(event) {
  const files = Array.from(event.dataTransfer?.files || []);
  const imageFile = files.find((file) => file.type.startsWith("image/"));
  if (!imageFile) return false;

  event.preventDefault();
  const position = view?.posAtCoords({ x: event.clientX, y: event.clientY });
  if (typeof position === "number") {
    lastSelection = { from: position, to: position };
  }
  emit("upload-file", { file: imageFile, selection: { ...lastSelection } });
  return true;
}

function handleDragOver(event) {
  if (Array.from(event.dataTransfer?.items || []).some((item) => item.type.startsWith("image/"))) {
    event.preventDefault();
    return true;
  }
  return false;
}

const pasteHandler = EditorView.domEventHandlers({
  paste: handlePaste,
  drop: handleDrop,
  dragover: handleDragOver
});

function syncSelection(state) {
  const main = state.selection.main;
  lastSelection = {
    from: main.from,
    to: main.to
  };
}

function insertTextAtSelection(text) {
  if (!view) return;

  const { from, to } = lastSelection;
  const cursor = from + text.length;

  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: cursor },
    scrollIntoView: true
  });
  view.focus();
}

function buildImageMarkdown(fileName, url) {
  const rawLabel = fileName.replace(/\.[^.]+$/, "").trim();
  const label = /^(img|image|screenshot|screen-shot)([-_\s]?\d+)?$/i.test(rawLabel)
    ? "运行截图"
    : rawLabel || "运行结果";
  return `\n![${label}](${url})\n`;
}

function insertImageMarkdown(fileName, url) {
  insertTextAtSelection(buildImageMarkdown(fileName, url));
}

defineExpose({
  insertImageMarkdown,
  focus: () => view?.focus()
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
        if (update.selectionSet || update.docChanged) {
          syncSelection(update.state);
        }
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
  syncSelection(view.state);
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
  if (view) {
    view.focus();
    syncSelection(view.state);
  }
  fileInput.value?.click();
}

function onFileChange(event) {
  const [file] = event.target.files || [];
  if (file) emit("upload-file", { file, selection: { ...lastSelection } });
  event.target.value = "";
}
</script>

<template>
  <section class="panel workspace-panel">
    <div class="panel-header panel-header-inline">
      <div>
        <p class="eyebrow">Markdown Workspace</p>
        <h2>正文编辑与实时预览</h2>
        <span>支持标题、列表、代码块，图片可粘贴、拖拽或上传并插入到当前光标处。</span>
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
