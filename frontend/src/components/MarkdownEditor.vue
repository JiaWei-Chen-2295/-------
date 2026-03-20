<script setup>
import { ref } from "vue";
import { message } from "ant-design-vue";
import { MdCatalog, MdEditor } from "md-editor-v3";
import "md-editor-v3/lib/style.css";

import { uploadImage } from "../api/client.js";

const props = defineProps({
  modelValue: {
    type: String,
    required: true
  }
});

const emit = defineEmits(["update:modelValue", "insert-template"]);

const editorId = "lab-report-markdown-editor";
const editorRef = ref(null);
const fileInput = ref(null);
const uploading = ref(false);

const toolbars = [
  "bold",
  "italic",
  "strikeThrough",
  "-",
  "title",
  "quote",
  "unorderedList",
  "orderedList",
  "task",
  "-",
  "codeRow",
  "code",
  "table",
  "link",
  "image",
  "-",
  "revoke",
  "next",
  "=",
  "preview",
  "catalog"
];

const footers = ["markdownTotal", "scrollSwitch"];

function normalizeImageMeta(fileName) {
  const rawLabel = fileName.replace(/\.[^.]+$/, "").trim();
  const label = /^(img|image|screenshot|screen-shot)([-_\s]?\d+)?$/i.test(rawLabel)
    ? "运行截图"
    : rawLabel || "运行结果";

  return {
    alt: label,
    title: label
  };
}

async function uploadFiles(files) {
  uploading.value = true;

  try {
    const results = await Promise.all(
      files.map(async (file) => {
        const data = await uploadImage(file);
        return {
          url: data.url,
          ...normalizeImageMeta(file.name)
        };
      })
    );
    return results;
  } finally {
    uploading.value = false;
  }
}

async function handleUploadImg(files, callback) {
  try {
    const uploaded = await uploadFiles(files);
    callback(uploaded);
    message.success(`已插入 ${uploaded.length} 张图片`);
  } catch (error) {
    message.error(error.message || "图片上传失败");
  }
}

function insertImageMarkdown(fileName, url) {
  const { alt } = normalizeImageMeta(fileName);
  editorRef.value?.insert(() => ({
    targetValue: `\n![${alt}](${url})\n`
  }));
  editorRef.value?.focus();
}

async function handleManualUpload(file) {
  try {
    const [uploaded] = await uploadFiles([file]);
    insertImageMarkdown(file.name, uploaded.url);
    message.success("图片已插入到当前光标位置");
  } catch (error) {
    message.error(error.message || "图片上传失败");
  }
}

function openFilePicker() {
  editorRef.value?.focus();
  fileInput.value?.click();
}

function onFileChange(event) {
  const [file] = event.target.files || [];
  if (file) {
    handleManualUpload(file);
  }
  event.target.value = "";
}

defineExpose({
  insertImageMarkdown,
  focus: (options) => editorRef.value?.focus(options)
});
</script>

<template>
  <section class="panel workspace-panel">
    <div class="panel-header panel-header-inline">
      <div>
        <p class="eyebrow">Markdown Workspace</p>
        <h2>正文编辑与实时预览</h2>
        <span>保留常用 Markdown 能力，支持目录导航、实时预览、图片粘贴/拖拽/上传。</span>
      </div>
      <div class="editor-actions">
        <a-button @click="emit('insert-template')">插入示例</a-button>
        <a-button :loading="uploading" @click="openFilePicker">上传图片</a-button>
        <input
          ref="fileInput"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          @change="onFileChange"
        />
      </div>
    </div>

    <div class="workspace-grid workspace-grid-editor">
      <div class="editor-pane editor-pane-rich">
        <div class="pane-title">Markdown Editor</div>
        <MdEditor
          ref="editorRef"
          :id="editorId"
          class="md-editor-shell"
          :model-value="modelValue"
          language="zh-CN"
          theme="light"
          preview-theme="smart-blue"
          code-theme="atom"
          :toolbars="toolbars"
          :footers="footers"
          :scroll-auto="true"
          :show-code-row-number="true"
          :no-mermaid="true"
          :no-katex="true"
          :no-highlight="false"
          placeholder="# 输入实验内容"
          @update:model-value="emit('update:modelValue', $event)"
          @on-upload-img="handleUploadImg"
        />
      </div>

      <aside class="preview-pane catalog-pane">
        <div class="pane-title">Catalog</div>
        <div class="catalog-pane-body">
          <p class="catalog-hint">长实验报告建议先按 `# / ## / ###` 分层，再通过目录快速跳转。</p>
          <MdCatalog :editor-id="editorId" class="catalog-widget" />
        </div>
      </aside>
    </div>
  </section>
</template>
