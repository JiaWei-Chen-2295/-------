<script setup>
import { computed, ref } from "vue";
import { message } from "ant-design-vue";

import ReportForm from "./components/ReportForm.vue";
import MarkdownEditor from "./components/MarkdownEditor.vue";
import { assetUrl, generateReport, uploadImage } from "./api/client.js";
import { defaultMarkdown } from "./editor/defaultContent.js";
import { renderPreview } from "./markdown/preview.js";

const today = new Date().toISOString().slice(0, 10);

const form = ref({
  course: "操作系统",
  project: "进程调度实验",
  department: "计算机系",
  grade: "2022",
  name: "张三",
  studentId: "20220001",
  date: today
});

const markdown = ref(defaultMarkdown);
const result = ref(null);
const generating = ref(false);
const uploading = ref(false);
const errorMessage = ref("");

const previewHtml = computed(() => renderPreview(markdown.value));

function appendImageReference(fileName, url) {
  const label = fileName.replace(/\.[^.]+$/, "") || "运行结果";
  markdown.value = `${markdown.value.trimEnd()}\n\n![${label}](${url})\n`;
}

async function handleUpload(file) {
  uploading.value = true;
  errorMessage.value = "";

  try {
    const data = await uploadImage(file);
    appendImageReference(file.name, data.url);
    message.success("图片已上传并插入 Markdown");
  } catch (error) {
    errorMessage.value = error.message;
    message.error(error.message);
  } finally {
    uploading.value = false;
  }
}

async function handleGenerate() {
  generating.value = true;
  errorMessage.value = "";

  try {
    result.value = await generateReport({
      form: form.value,
      markdown: markdown.value
    });
    message.success("报告生成成功");
  } catch (error) {
    errorMessage.value = error.message;
    message.error(error.message);
  } finally {
    generating.value = false;
  }
}

function handleInsertTemplate() {
  markdown.value = defaultMarkdown;
}
</script>

<template>
  <div class="shell">
    <header class="panel hero-panel">
      <div>
        <p class="eyebrow">Lab Report Studio</p>
        <h1>把 Markdown 交给系统，把格式化交给模板。</h1>
        <p class="hero-copy">
          统一封面、标题自动编号、代码行号表格、图片上传、DOCX / PDF 一键导出。
        </p>
      </div>
      <div class="hero-tags">
        <span>Fastify</span>
        <span>Vue 3</span>
        <span>docx</span>
        <span>Puppeteer</span>
      </div>
    </header>

    <div class="page-grid">
      <ReportForm v-model="form" />

      <div class="main-stack">
        <section class="panel launch-panel">
          <div>
            <p class="eyebrow">Generate</p>
            <h2>导出报告</h2>
            <span>生成结果会保存到后端 `storage/outputs` 并开放下载。</span>
          </div>
          <div class="launch-actions">
            <a-button size="large" @click="handleInsertTemplate">恢复示例</a-button>
            <a-button type="primary" size="large" :loading="generating" @click="handleGenerate">
              生成 DOCX / PDF
            </a-button>
          </div>
        </section>

        <MarkdownEditor
          v-model="markdown"
          :preview-html="previewHtml"
          :uploading="uploading"
          @upload-file="handleUpload"
          @paste-image="handleUpload"
          @insert-template="handleInsertTemplate"
        />

        <section class="panel result-panel">
          <div class="panel-header">
            <p class="eyebrow">Output</p>
            <h2>生成结果</h2>
            <span>如果生成失败，错误会显示在这里。</span>
          </div>

          <a-alert v-if="errorMessage" type="error" show-icon :message="errorMessage" />

          <div v-else-if="result" class="result-links">
            <a :href="assetUrl(result.docx)" target="_blank" rel="noreferrer">下载 DOCX</a>
            <a :href="assetUrl(result.pdf)" target="_blank" rel="noreferrer">下载 PDF</a>
            <span>共解析 {{ result.blocks }} 个内容块</span>
          </div>

          <div v-else class="result-empty">还没有生成记录，先编辑正文再点击导出。</div>
        </section>
      </div>
    </div>
  </div>
</template>
