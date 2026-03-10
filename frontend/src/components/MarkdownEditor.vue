<script setup>
import { ref } from "vue";

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

function updateValue(event) {
  emit("update:modelValue", event.target.value);
}

function openFilePicker() {
  fileInput.value?.click();
}

function onFileChange(event) {
  const [file] = event.target.files || [];
  if (file) {
    emit("upload-file", file);
  }
  event.target.value = "";
}

function onPaste(event) {
  const items = Array.from(event.clipboardData?.items || []);
  const imageItem = items.find((item) => item.type.startsWith("image/"));
  if (!imageItem) {
    return;
  }

  event.preventDefault();
  const file = imageItem.getAsFile();
  if (file) {
    emit("paste-image", file);
  }
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
        <textarea
          class="editor-input"
          :value="modelValue"
          spellcheck="false"
          placeholder="# 输入实验内容"
          @input="updateValue"
          @paste="onPaste"
        />
      </div>
      <div class="preview-pane">
        <div class="pane-title">Preview</div>
        <article class="preview-markdown" v-html="previewHtml" />
      </div>
    </div>
  </section>
</template>
