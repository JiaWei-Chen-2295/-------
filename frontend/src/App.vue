<script setup>
import { computed, ref, watch } from "vue";
import { message } from "ant-design-vue";

import ReportForm from "./components/ReportForm.vue";
import MarkdownEditor from "./components/MarkdownEditor.vue";
import { assetUrl, generateReport, uploadImage } from "./api/client.js";
import { defaultMarkdown } from "./editor/defaultContent.js";
import { renderPreview } from "./markdown/preview.js";

const STORAGE_KEYS = {
  form: "lab-report-form-draft",
  markdown: "lab-report-markdown-draft"
};

const today = new Date().toISOString().slice(0, 10);

const defaultForm = {
  course: "操作系统",
  project: "进程调度实验",
  department: "计算机系",
  grade: "2022",
  name: "张三",
  studentId: "20220001",
  date: today
};

function loadStoredJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function loadStoredMarkdown() {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.markdown) || defaultMarkdown;
  } catch {
    return defaultMarkdown;
  }
}

const form = ref(loadStoredJson(STORAGE_KEYS.form, defaultForm));
const markdown = ref(loadStoredMarkdown());
const currentStep = ref(0);
const result = ref(null);
const generating = ref(false);
const uploading = ref(false);
const errorMessage = ref("");
const saveStatus = ref("已开启自动保存");

const previewHtml = computed(() => renderPreview(markdown.value));
const coverComplete = computed(() =>
  Object.values(form.value).every((value) => String(value ?? "").trim())
);
const markdownReady = computed(() => markdown.value.trim().length > 0);
const stepItems = computed(() => [
  {
    title: "封面信息",
    description: coverComplete.value ? "已填写完成" : "先补全封面内容"
  },
  {
    title: "Markdown 编辑",
    description: markdownReady.value ? "正文草稿已保存" : "开始写实验正文"
  },
  {
    title: "导出 DOCX",
    description: result.value ? "可下载最新报告" : "确认内容后导出"
  }
]);
const markdownStats = computed(() => {
  const lines = markdown.value.split(/\r?\n/);
  const nonEmptyLines = lines.filter((line) => line.trim()).length;
  const imageCount = (markdown.value.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;

  return {
    lines: lines.length,
    nonEmptyLines,
    imageCount
  };
});
const formSummary = computed(() => [
  { label: "课程名称", value: form.value.course },
  { label: "实验项目", value: form.value.project },
  { label: "系部", value: form.value.department },
  { label: "年级", value: form.value.grade },
  { label: "姓名", value: form.value.name },
  { label: "学号", value: form.value.studentId },
  { label: "日期", value: form.value.date }
]);

watch(
  form,
  (value) => {
    window.localStorage.setItem(STORAGE_KEYS.form, JSON.stringify(value));
    saveStatus.value = `封面已自动保存 ${new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
  },
  { deep: true }
);

watch(markdown, (value) => {
  window.localStorage.setItem(STORAGE_KEYS.markdown, value);
  saveStatus.value = `正文已自动保存 ${new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
});

function appendImageReference(fileName, url) {
  const rawLabel = fileName.replace(/\.[^.]+$/, "").trim();
  const label = /^(img|image|screenshot|screen-shot)([-_\s]?\d+)?$/i.test(rawLabel)
    ? "运行截图"
    : rawLabel || "运行结果";
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
  if (!coverComplete.value) {
    currentStep.value = 0;
    message.warning("请先完善封面表单");
    return;
  }

  if (!markdownReady.value) {
    currentStep.value = 1;
    message.warning("请先填写实验正文");
    return;
  }

  generating.value = true;
  errorMessage.value = "";

  try {
    result.value = await generateReport({
      form: form.value,
      markdown: markdown.value
    });
    currentStep.value = 2;
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

function goToStep(step) {
  if (step === 1 && !coverComplete.value) {
    message.warning("先把封面信息填写完整，我们再继续下一步");
    return;
  }

  if (step === 2) {
    if (!coverComplete.value) {
      currentStep.value = 0;
      message.warning("请先完成封面信息");
      return;
    }
    if (!markdownReady.value) {
      currentStep.value = 1;
      message.warning("请先完成 Markdown 正文");
      return;
    }
  }

  currentStep.value = step;
}

function resetDraft() {
  form.value = { ...defaultForm };
  markdown.value = defaultMarkdown;
  result.value = null;
  errorMessage.value = "";
  currentStep.value = 0;
  window.localStorage.removeItem(STORAGE_KEYS.form);
  window.localStorage.removeItem(STORAGE_KEYS.markdown);
  saveStatus.value = "本地草稿已清空";
  message.success("已重置为默认示例");
}
</script>

<template>
  <div class="shell">
    <section class="topbar">
      <a-steps :current="currentStep" :responsive="false" class="app-steps app-steps-plain">
        <a-step
          v-for="(item, index) in stepItems"
          :key="item.title"
          :title="item.title"
          :description="item.description"
          @click="goToStep(index)"
        />
      </a-steps>
      <div class="draft-toolbar">
        <span class="draft-status">{{ saveStatus }}</span>
        <a-button size="small" @click="resetDraft">清空草稿</a-button>
      </div>
    </section>

    <div class="main-stack">
      <section v-if="currentStep === 0" class="stage-stack">
        <ReportForm v-model="form" />

        <div class="step-footer-actions">
          <a-button @click="resetDraft">恢复默认示例</a-button>
          <a-button type="primary" @click="goToStep(1)">下一步</a-button>
        </div>
      </section>

      <section v-else-if="currentStep === 1" class="stage-stack">
        <section class="editor-meta">
          <div class="launch-actions">
            <span class="stat-pill">总行数 {{ markdownStats.lines }}</span>
            <span class="stat-pill">有效内容 {{ markdownStats.nonEmptyLines }}</span>
            <span class="stat-pill">图片 {{ markdownStats.imageCount }}</span>
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

        <div class="step-footer-actions">
          <a-button @click="goToStep(0)">上一步</a-button>
          <a-button type="primary" @click="goToStep(2)">下一步</a-button>
        </div>
      </section>

      <section v-else class="stage-grid export-grid">
        <section class="panel result-panel">
          <div class="summary-list">
            <div class="summary-item">
              <span>封面状态</span>
              <strong>{{ coverComplete ? "已完成" : "未完成" }}</strong>
            </div>
            <div class="summary-item">
              <span>正文长度</span>
              <strong>{{ markdownStats.nonEmptyLines }} 段有效内容</strong>
            </div>
            <div class="summary-item">
              <span>图片数量</span>
              <strong>{{ markdownStats.imageCount }} 张</strong>
            </div>
            <div v-if="result" class="summary-item">
              <span>最近一次生成</span>
              <strong>共解析 {{ result.blocks }} 个内容块</strong>
            </div>
          </div>

          <a-alert v-if="errorMessage" type="error" show-icon :message="errorMessage" />

          <div class="stage-actions">
            <a-button @click="goToStep(1)">上一步</a-button>
            <a-button type="primary" :loading="generating" @click="handleGenerate">
              生成 DOCX
            </a-button>
          </div>

          <div v-if="result" class="result-links">
            <a :href="assetUrl(result.docx)" target="_blank" rel="noreferrer">下载 DOCX</a>
            <span>最新文件已准备好</span>
          </div>
          <div v-else class="result-empty">确认无误后点击生成即可导出。</div>
        </section>

        <section class="panel stage-side preview-side">
          <div class="summary-list">
            <div v-for="item in formSummary" :key="item.label" class="summary-item">
              <span>{{ item.label }}</span>
              <strong>{{ item.value || "待填写" }}</strong>
            </div>
          </div>
        </section>
      </section>
    </div>
  </div>
</template>
