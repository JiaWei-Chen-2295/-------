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
  },
  saveStatus: {
    type: String,
    default: ""
  },
  stats: {
    type: Object,
    default: () => ({
      lines: 0,
      nonEmptyLines: 0,
      imageCount: 0
    })
  }
});

const emit = defineEmits(["update:modelValue", "insert-template"]);

const editorId = "lab-report-markdown-editor";
const editorRef = ref(null);
const fileInput = ref(null);
const pendingUploads = ref(0);

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

function replaceBlobUrl(blobUrl, serverUrl) {
  const content = props.modelValue;
  if (content.includes(blobUrl)) {
    emit("update:modelValue", content.replaceAll(blobUrl, serverUrl));
    URL.revokeObjectURL(blobUrl);
  }
}

function bgUpload(file, blobUrl) {
  pendingUploads.value++;
  uploadImage(file)
    .then((data) => {
      replaceBlobUrl(blobUrl, data.url);
    })
    .catch((error) => {
      message.error(`图片「${file.name}」上传失败: ${error.message || "未知错误"}`);
    })
    .finally(() => {
      pendingUploads.value--;
      if (pendingUploads.value === 0) {
        message.success("图片上传完成");
      }
    });
}

function handleUploadImg(files, callback) {
  const entries = files.map((file) => ({
    file,
    blobUrl: URL.createObjectURL(file),
    ...normalizeImageMeta(file.name)
  }));

  callback(entries.map((e) => ({ url: e.blobUrl, alt: e.alt, title: e.title })));

  for (const { file, blobUrl } of entries) {
    bgUpload(file, blobUrl);
  }
}

function insertImageMarkdown(fileName, url) {
  const { alt } = normalizeImageMeta(fileName);
  editorRef.value?.insert(() => ({
    targetValue: `\n![${alt}](${url})\n`
  }));
  editorRef.value?.focus();
}

function handleManualUpload(files) {
  const validFiles = Array.from(files || []);
  if (validFiles.length === 0) {
    return;
  }

  const entries = validFiles.map((file) => ({
    file,
    blobUrl: URL.createObjectURL(file)
  }));

  const markdownBlock = entries
    .map(({ file, blobUrl }) => {
      const { alt } = normalizeImageMeta(file.name);
      return `![${alt}](${blobUrl})`;
    })
    .join("\n\n");

  editorRef.value?.insert(() => ({
    targetValue: `\n${markdownBlock}\n`
  }));
  editorRef.value?.focus();

  for (const { file, blobUrl } of entries) {
    bgUpload(file, blobUrl);
  }
}

function openFilePicker() {
  editorRef.value?.focus();
  fileInput.value?.click();
}

function onFileChange(event) {
  handleManualUpload(event.target.files);
  event.target.value = "";
}

defineExpose({
  insertImageMarkdown,
  focus: (options) => editorRef.value?.focus(options),
  hasPendingUploads: () => pendingUploads.value > 0
});
</script>

<template>
  <section class="panel workspace-panel">
    <div class="panel-header panel-header-inline">
      <div class="editor-header-copy">
        <h2>正文</h2>
        <span>图片支持直接粘贴截图，也支持一次选择多张图片批量插入上传。</span>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        hidden
        @change="onFileChange"
      />
    </div>
    <div class="editor-statusbar">
      <span class="draft-status draft-status-inline">{{ saveStatus }}</span>
      <div class="editor-status-pills">
        <span class="stat-pill">总行数 {{ stats.lines }}</span>
        <span class="stat-pill">有效内容 {{ stats.nonEmptyLines }}</span>
        <span class="stat-pill">图片 {{ stats.imageCount }}</span>
      </div>
    </div>

    <div class="workspace-grid workspace-grid-editor">
      <div class="editor-pane editor-pane-rich">
        <div class="pane-title">编辑器</div>
        <div class="editor-toolbar-shell">
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
          <div class="editor-inline-actions">
            <button
              class="editor-inline-action editor-inline-action-divider"
              type="button"
              title="插入示例"
              aria-label="插入示例"
              @click="emit('insert-template')"
            >
              示例
            </button>
            <button
              class="editor-inline-action"
              type="button"
              title="批量插入图片"
              aria-label="批量插入图片"
              @click="openFilePicker"
            >
              图片
              <span v-if="pendingUploads > 0" class="upload-pending-badge">{{ pendingUploads }}</span>
            </button>
          </div>
        </div>
      </div>

      <aside class="preview-pane catalog-pane">
        <div class="pane-title">目录</div>
        <div class="catalog-pane-body">
          <p class="catalog-hint">长实验报告建议先按 `# / ## / ###` 分层，再通过目录快速跳转。</p>
          <MdCatalog :editor-id="editorId" class="catalog-widget" />
        </div>
      </aside>
    </div>
  </section>
</template>
