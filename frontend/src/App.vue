<script setup>
import { computed, ref, watch } from "vue";
import { message, theme } from "ant-design-vue";

const themeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: "#c96f35",
    colorSuccess: "#517d79",
    colorInfo: "#6b8db5",
    colorWarning: "#d4943a",
    colorError: "#c0503e",
    colorBgContainer: "rgba(255, 252, 248, 0.92)",
    colorBgElevated: "rgba(255, 255, 255, 0.96)",
    colorBgLayout: "transparent",
    colorText: "#1f2937",
    colorTextSecondary: "#5b6475",
    colorBorder: "rgba(30, 41, 59, 0.10)",
    colorBorderSecondary: "rgba(30, 41, 59, 0.06)",
    borderRadius: 10,
    borderRadiusLG: 14,
    borderRadiusSM: 8,
    fontFamily:
      '"Microsoft YaHei UI", "PingFang SC", -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: 14,
    controlHeight: 38,
    wireframe: false
  },
  components: {
    Button: {
      borderRadius: 999,
      borderRadiusLG: 999,
      borderRadiusSM: 999,
      controlHeight: 34,
      paddingInline: 18,
      fontWeight: 500
    },
    Input: {
      borderRadius: 12,
      controlHeight: 38,
      colorBgContainer: "rgba(255, 255, 255, 0.92)"
    },
    Steps: {
      colorPrimary: "#c96f35",
      fontWeightStrong: 700
    },
    Form: {
      labelFontSize: 12,
      labelColor: "#5b6475",
      itemMarginBottom: 12
    },
    Alert: {
      borderRadiusLG: 14
    },
    Message: {
      borderRadiusLG: 12
    }
  }
};

import ReportForm from "./components/ReportForm.vue";
import MarkdownEditor from "./components/MarkdownEditor.vue";
import { assetUrl, generateReport, uploadImage } from "./api/client.js";
import { defaultMarkdown } from "./editor/defaultContent.js";
import { renderPreview } from "./markdown/preview.js";

const STORAGE_KEYS = {
  form: "lab-report-form-draft",
  markdown: "lab-report-markdown-draft",
  wordStyle: "lab-report-word-style-draft",
  wordStyleTemplates: "lab-report-word-style-templates"
};

const WORD_SIZE_OPTIONS = [
  "八号",
  "七号",
  "小六",
  "六号",
  "小五",
  "五号",
  "小四",
  "四号",
  "小三",
  "三号",
  "小二",
  "二号",
  "小一",
  "一号",
  "小初",
  "初号"
];

const WORD_SIZE_NAME_TO_PT = {
  八号: 5,
  七号: 5.5,
  小六: 6.5,
  六号: 7.5,
  小五: 9,
  五号: 10.5,
  小四: 12,
  四号: 14,
  小三: 15,
  三号: 16,
  小二: 18,
  二号: 22,
  小一: 24,
  一号: 26,
  小初: 36,
  初号: 42
};

const WORD_SIZE_PRESETS = {
  default: {
    label: "默认配置",
    description: "正文小四、1.5 倍行距、段后 7pt，标题四号，代码小五",
    fontSize: {
      heading: { mode: "name", sizeName: "四号", pt: 14 },
      body: { mode: "name", sizeName: "小四", pt: 12 },
      code: { mode: "name", sizeName: "小五", pt: 9 }
    },
    paragraphSpacing: {
      bodyLineMultiple: 1.5,
      bodyAfterPt: 7,
      codeLineMultiple: 1.17
    }
  },
  compact: {
    label: "紧凑版",
    description: "正文五号、1.3 倍行距、段后 4pt，标题小四，代码小五",
    fontSize: {
      heading: { mode: "name", sizeName: "小四", pt: 12 },
      body: { mode: "name", sizeName: "五号", pt: 10.5 },
      code: { mode: "name", sizeName: "小五", pt: 9 }
    },
    paragraphSpacing: {
      bodyLineMultiple: 1.3,
      bodyAfterPt: 4,
      codeLineMultiple: 1.1
    }
  },
  large: {
    label: "大字号",
    description: "正文四号、1.75 倍行距、段后 10pt，标题三号，代码五号",
    fontSize: {
      heading: { mode: "name", sizeName: "三号", pt: 16 },
      body: { mode: "name", sizeName: "四号", pt: 14 },
      code: { mode: "name", sizeName: "五号", pt: 10.5 }
    },
    paragraphSpacing: {
      bodyLineMultiple: 1.75,
      bodyAfterPt: 10,
      codeLineMultiple: 1.3
    }
  }
};

const IMAGE_CAPTION_MODE_OPTIONS = {
  keep: {
    label: "保留题注",
    description: "保留 Markdown 里原有的图片题注文本。"
  },
  off: {
    label: "关闭题注",
    description: "只插入图片，不生成图片题注。"
  },
  "heading-numbered": {
    label: "按标题编号",
    description: "按标题顺序自动编号图片题注。"
  }
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

function cloneWordFontSize(value) {
  return {
    heading: { ...value.heading },
    body: { ...value.body },
    code: { ...value.code }
  };
}

function normalizeImageCaptionMode(value) {
  return IMAGE_CAPTION_MODE_OPTIONS[value] ? value : "keep";
}

const defaultWordStyle = {
  preset: "default",
  fontSize: cloneWordFontSize(WORD_SIZE_PRESETS.default.fontSize),
  paragraphSpacing: { ...WORD_SIZE_PRESETS.default.paragraphSpacing },
  imageCaptionMode: "keep"
};

function normalizeLocalWordStyle(value) {
  if (!value || typeof value !== "object") {
    return {
      preset: defaultWordStyle.preset,
      fontSize: cloneWordFontSize(defaultWordStyle.fontSize),
      paragraphSpacing: { ...defaultWordStyle.paragraphSpacing },
      imageCaptionMode: defaultWordStyle.imageCaptionMode
    };
  }

  if (value.fontSize?.heading && value.fontSize?.body && value.fontSize?.code) {
    return {
      preset: value.preset || "default",
      fontSize: cloneWordFontSize(value.fontSize),
      paragraphSpacing: {
        ...defaultWordStyle.paragraphSpacing,
        ...value.paragraphSpacing
      },
      imageCaptionMode: normalizeImageCaptionMode(value.imageCaptionMode ?? value.captionMode)
    };
  }

  if (
    value.fontSize?.headingPt != null ||
    value.fontSize?.bodyPt != null ||
    value.fontSize?.codePt != null
  ) {
    return {
      preset: value.preset || "custom",
      fontSize: {
        heading: {
          mode: "pt",
          sizeName: "四号",
          pt: value.fontSize?.headingPt ?? 14
        },
        body: {
          mode: "pt",
          sizeName: "小四",
          pt: value.fontSize?.bodyPt ?? 12
        },
        code: {
          mode: "pt",
          sizeName: "小五",
          pt: value.fontSize?.codePt ?? 9
        }
      },
      paragraphSpacing: { ...defaultWordStyle.paragraphSpacing },
      imageCaptionMode: normalizeImageCaptionMode(value.imageCaptionMode ?? value.captionMode)
    };
  }

  return {
    preset: defaultWordStyle.preset,
    fontSize: cloneWordFontSize(defaultWordStyle.fontSize),
    paragraphSpacing: { ...defaultWordStyle.paragraphSpacing },
    imageCaptionMode: normalizeImageCaptionMode(value.imageCaptionMode ?? value.captionMode)
  };
}

function describeWordSize(field) {
  if (field.mode === "pt") {
    return `${field.pt}pt`;
  }
  return `${field.sizeName} (${WORD_SIZE_NAME_TO_PT[field.sizeName]}pt)`;
}

function cloneParagraphSpacing(value) {
  return {
    bodyLineMultiple: value.bodyLineMultiple,
    bodyAfterPt: value.bodyAfterPt,
    codeLineMultiple: value.codeLineMultiple
  };
}

function cloneWordStyle(value) {
  return {
    preset: value.preset,
    fontSize: cloneWordFontSize(value.fontSize),
    paragraphSpacing: cloneParagraphSpacing(value.paragraphSpacing),
    imageCaptionMode: normalizeImageCaptionMode(value.imageCaptionMode)
  };
}

function normalizeWordStyleTemplate(template, index = 0) {
  const normalizedStyle = normalizeLocalWordStyle(template?.wordStyle);
  const name = String(template?.name ?? "").trim() || `模板 ${index + 1}`;
  return {
    id: String(template?.id ?? `${Date.now()}-${index}`),
    name: name.slice(0, 24),
    wordStyle: cloneWordStyle(normalizedStyle)
  };
}

function loadWordStyleTemplates() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.wordStyleTemplates);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeWordStyleTemplate) : [];
  } catch {
    return [];
  }
}

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
const markdownEditorRef = ref(null);
const wordStyle = ref(normalizeLocalWordStyle(loadStoredJson(STORAGE_KEYS.wordStyle, defaultWordStyle)));
const wordStyleTemplates = ref(loadWordStyleTemplates());
const wordStyleTemplateName = ref("");
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
const activeWordPreset = computed(() =>
  wordStyle.value.preset === "custom"
    ? {
        label: "自定义",
        description: "支持直接选择小五、五号、小四、四号等，也可以切换为 pt 微调。",
        fontSize: wordStyle.value.fontSize,
        paragraphSpacing: wordStyle.value.paragraphSpacing
    }
    : WORD_SIZE_PRESETS[wordStyle.value.preset] || WORD_SIZE_PRESETS.default
);
const activeImageCaptionMode = computed(
  () => IMAGE_CAPTION_MODE_OPTIONS[wordStyle.value.imageCaptionMode] || IMAGE_CAPTION_MODE_OPTIONS.keep
);
const effectiveWordFontSize = computed(() =>
  wordStyle.value.preset === "custom"
    ? wordStyle.value.fontSize
    : activeWordPreset.value.fontSize
);
const effectiveParagraphSpacing = computed(() =>
  wordStyle.value.preset === "custom"
    ? wordStyle.value.paragraphSpacing
    : activeWordPreset.value.paragraphSpacing
);
const wordStyleSummary = computed(() => {
  const { body, heading, code } = effectiveWordFontSize.value;
  const spacing = effectiveParagraphSpacing.value;
  return `${activeWordPreset.value.label} · 正文 ${describeWordSize(body)} / 标题 ${describeWordSize(
    heading
  )} / 代码 ${describeWordSize(code)} / 行距 ${spacing.bodyLineMultiple} 倍 / 段后 ${spacing.bodyAfterPt}pt / 题注 ${activeImageCaptionMode.value.label}`;
});
const trimmedTemplateName = computed(() => wordStyleTemplateName.value.trim().slice(0, 24));

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

watch(
  wordStyle,
  (value) => {
    window.localStorage.setItem(STORAGE_KEYS.wordStyle, JSON.stringify(value));
    saveStatus.value = `导出样式已自动保存 ${new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
  },
  { deep: true }
);

watch(
  wordStyleTemplates,
  (value) => {
    window.localStorage.setItem(STORAGE_KEYS.wordStyleTemplates, JSON.stringify(value));
  },
  { deep: true }
);

function updateWordPreset(preset) {
  wordStyle.value = {
    preset,
    fontSize:
      preset === "custom"
        ? cloneWordFontSize(wordStyle.value.fontSize)
        : cloneWordFontSize(WORD_SIZE_PRESETS[preset].fontSize),
    paragraphSpacing:
      preset === "custom"
        ? cloneParagraphSpacing(wordStyle.value.paragraphSpacing)
        : cloneParagraphSpacing(WORD_SIZE_PRESETS[preset].paragraphSpacing),
    imageCaptionMode: wordStyle.value.imageCaptionMode
  };
}

function updateWordFontMode(field, mode) {
  const current = wordStyle.value.fontSize[field];
  const sizeName = current.sizeName || "小四";
  wordStyle.value = {
    ...wordStyle.value,
    preset: "custom",
    fontSize: {
      ...wordStyle.value.fontSize,
      [field]: {
        ...current,
        mode,
        pt: mode === "pt" ? current.pt ?? WORD_SIZE_NAME_TO_PT[sizeName] : WORD_SIZE_NAME_TO_PT[sizeName]
      }
    }
  };
}

function updateWordFontSizeName(field, sizeName) {
  const safeSizeName = WORD_SIZE_NAME_TO_PT[sizeName] ? sizeName : "小四";
  const current = wordStyle.value.fontSize[field];
  wordStyle.value = {
    ...wordStyle.value,
    preset: "custom",
    fontSize: {
      ...wordStyle.value.fontSize,
      [field]: {
        ...current,
        sizeName: safeSizeName,
        pt: current.mode === "pt" ? current.pt : WORD_SIZE_NAME_TO_PT[safeSizeName]
      }
    }
  };
}

function updateWordFontPt(field, value) {
  if (value == null) {
    return;
  }

  wordStyle.value = {
    ...wordStyle.value,
    preset: "custom",
    fontSize: {
      ...wordStyle.value.fontSize,
      [field]: {
        ...wordStyle.value.fontSize[field],
        pt: value
      }
    }
  };
}

function updateParagraphSpacing(field, value) {
  if (value == null) {
    return;
  }

  wordStyle.value = {
    ...wordStyle.value,
    preset: "custom",
    paragraphSpacing: {
      ...wordStyle.value.paragraphSpacing,
      [field]: value
    }
  };
}

function updateImageCaptionMode(value) {
  wordStyle.value = {
    ...wordStyle.value,
    imageCaptionMode: normalizeImageCaptionMode(value)
  };
}

function saveWordStyleTemplate() {
  const templateName = trimmedTemplateName.value;
  if (!templateName) {
    message.warning("先给模板起个名字");
    return;
  }

  const nextTemplates = wordStyleTemplates.value.filter((item) => item.name !== templateName);
  nextTemplates.unshift({
    id: `${Date.now()}`,
    name: templateName,
    wordStyle: cloneWordStyle({
      preset: "custom",
      fontSize: effectiveWordFontSize.value,
      paragraphSpacing: effectiveParagraphSpacing.value,
      imageCaptionMode: wordStyle.value.imageCaptionMode
    })
  });

  wordStyleTemplates.value = nextTemplates.slice(0, 12);
  wordStyleTemplateName.value = "";
  message.success("样式模板已保存");
}

function applyWordStyleTemplate(template) {
  wordStyle.value = cloneWordStyle({
    preset: "custom",
    fontSize: template.wordStyle.fontSize,
    paragraphSpacing: template.wordStyle.paragraphSpacing,
    imageCaptionMode: template.wordStyle.imageCaptionMode
  });
  message.success(`已应用模板：${template.name}`);
}

function deleteWordStyleTemplate(templateId) {
  wordStyleTemplates.value = wordStyleTemplates.value.filter((item) => item.id !== templateId);
  message.success("模板已删除");
}

function buildImageReference(fileName, url) {
  const rawLabel = fileName.replace(/\.[^.]+$/, "").trim();
  const label = /^(img|image|screenshot|screen-shot)([-_\s]?\d+)?$/i.test(rawLabel)
    ? "运行截图"
    : rawLabel || "运行结果";
  return `\n![${label}](${url})\n`;
}

function insertTextBySelection(text, selection) {
  const current = markdown.value;
  const safeFrom = Math.max(0, Math.min(selection?.from ?? current.length, current.length));
  const safeTo = Math.max(safeFrom, Math.min(selection?.to ?? safeFrom, current.length));
  markdown.value = `${current.slice(0, safeFrom)}${text}${current.slice(safeTo)}`;
}

async function handleUpload(payload) {
  const file = payload?.file || payload;
  const selection = payload?.selection;
  uploading.value = true;
  errorMessage.value = "";

  try {
    const data = await uploadImage(file);
    if (markdownEditorRef.value?.insertImageMarkdown) {
      markdownEditorRef.value.insertImageMarkdown(file.name, data.url);
    } else {
      insertTextBySelection(buildImageReference(file.name, data.url), selection);
    }
    message.success("图片已上传并插入到当前光标位置");
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
      markdown: markdown.value,
      wordStyle: {
        preset: wordStyle.value.preset,
        fontSize: cloneWordFontSize(effectiveWordFontSize.value),
        paragraphSpacing: cloneParagraphSpacing(effectiveParagraphSpacing.value),
        imageCaptionMode: wordStyle.value.imageCaptionMode
      }
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
  window.localStorage.removeItem(STORAGE_KEYS.wordStyle);
  window.localStorage.removeItem(STORAGE_KEYS.wordStyleTemplates);
  wordStyle.value = {
    ...defaultWordStyle,
    fontSize: cloneWordFontSize(defaultWordStyle.fontSize),
    paragraphSpacing: cloneParagraphSpacing(defaultWordStyle.paragraphSpacing),
    imageCaptionMode: defaultWordStyle.imageCaptionMode
  };
  wordStyleTemplates.value = [];
  wordStyleTemplateName.value = "";
  saveStatus.value = "本地草稿已清空";
  message.success("已重置为默认示例");
}
</script>

<template>
  <a-config-provider :theme="themeConfig">
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
          ref="markdownEditorRef"
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
            <div class="summary-item">
              <span>Word 字号</span>
              <strong>{{ wordStyleSummary }}</strong>
            </div>
            <div v-if="result" class="summary-item">
              <span>最近一次生成</span>
              <strong>共解析 {{ result.blocks }} 个内容块</strong>
            </div>
          </div>

          <section class="word-style-panel">
            <div class="panel-header panel-header-compact">
              <h3>导出字号</h3>
              <span>提供默认配置，也支持按 Word 字号自定义。</span>
            </div>

            <a-radio-group
              :value="wordStyle.preset"
              class="word-style-presets"
              button-style="solid"
              @update:value="updateWordPreset"
            >
              <a-radio-button value="default">默认</a-radio-button>
              <a-radio-button value="compact">紧凑</a-radio-button>
              <a-radio-button value="large">大号</a-radio-button>
              <a-radio-button value="custom">自定义</a-radio-button>
            </a-radio-group>

            <div class="result-empty word-style-hint">{{ activeWordPreset.description }}</div>

            <section class="word-style-caption-panel">
              <div class="panel-header panel-header-compact">
                <h3>图片题注</h3>
                <span>可以保留、关闭，或者按标题顺序自动编号。</span>
              </div>

              <a-radio-group
                :value="wordStyle.imageCaptionMode"
                class="word-style-caption-modes"
                button-style="solid"
                @update:value="updateImageCaptionMode"
              >
                <a-radio-button value="keep">{{ IMAGE_CAPTION_MODE_OPTIONS.keep.label }}</a-radio-button>
                <a-radio-button value="off">{{ IMAGE_CAPTION_MODE_OPTIONS.off.label }}</a-radio-button>
                <a-radio-button value="heading-numbered">
                  {{ IMAGE_CAPTION_MODE_OPTIONS["heading-numbered"].label }}
                </a-radio-button>
              </a-radio-group>

              <div class="result-empty word-style-hint">{{ activeImageCaptionMode.description }}</div>
            </section>

            <section class="word-style-template-panel">
              <div class="word-style-template-toolbar">
                <a-input
                  :value="wordStyleTemplateName"
                  placeholder="例如：课程报告标准版"
                  maxlength="24"
                  @update:value="wordStyleTemplateName = $event"
                />
                <a-button @click="saveWordStyleTemplate">保存为模板</a-button>
              </div>

              <div v-if="wordStyleTemplates.length" class="word-style-template-list">
                <div
                  v-for="template in wordStyleTemplates"
                  :key="template.id"
                  class="word-style-template-item"
                >
                  <div class="word-style-template-meta">
                    <strong>{{ template.name }}</strong>
                    <span>
                      {{
                        `${describeWordSize(template.wordStyle.fontSize.body)} / 行距 ${template.wordStyle.paragraphSpacing.bodyLineMultiple} 倍 / 段后 ${template.wordStyle.paragraphSpacing.bodyAfterPt}pt`
                      }}
                    </span>
                  </div>
                  <div class="word-style-template-actions">
                    <a-button size="small" @click="applyWordStyleTemplate(template)">应用</a-button>
                    <a-button size="small" danger @click="deleteWordStyleTemplate(template.id)">
                      删除
                    </a-button>
                  </div>
                </div>
              </div>
              <div v-else class="result-empty word-style-template-empty">
                还没有保存的样式模板，调整好字号和段落后可以先存一个。
              </div>
            </section>

            <div v-if="wordStyle.preset === 'custom'" class="word-style-grid">
              <a-form layout="vertical">
                <div class="form-grid word-style-form-grid">
                  <a-form-item label="标题字号">
                    <div class="word-style-field">
                      <a-radio-group
                        :value="wordStyle.fontSize.heading.mode"
                        size="small"
                        @update:value="updateWordFontMode('heading', $event)"
                      >
                        <a-radio-button value="name">中文字号</a-radio-button>
                        <a-radio-button value="pt">pt</a-radio-button>
                      </a-radio-group>
                      <a-select
                        v-if="wordStyle.fontSize.heading.mode === 'name'"
                        :value="wordStyle.fontSize.heading.sizeName"
                        :options="WORD_SIZE_OPTIONS.map((item) => ({ value: item, label: `${item} (${WORD_SIZE_NAME_TO_PT[item]}pt)` }))"
                        class="word-style-input"
                        @update:value="updateWordFontSizeName('heading', $event)"
                      />
                      <a-input-number
                        v-else
                        :value="wordStyle.fontSize.heading.pt"
                        :min="10"
                        :max="28"
                        :step="0.5"
                        class="word-style-input"
                        @update:value="updateWordFontPt('heading', $event)"
                      />
                    </div>
                  </a-form-item>
                  <a-form-item label="正文字号">
                    <div class="word-style-field">
                      <a-radio-group
                        :value="wordStyle.fontSize.body.mode"
                        size="small"
                        @update:value="updateWordFontMode('body', $event)"
                      >
                        <a-radio-button value="name">中文字号</a-radio-button>
                        <a-radio-button value="pt">pt</a-radio-button>
                      </a-radio-group>
                      <a-select
                        v-if="wordStyle.fontSize.body.mode === 'name'"
                        :value="wordStyle.fontSize.body.sizeName"
                        :options="WORD_SIZE_OPTIONS.map((item) => ({ value: item, label: `${item} (${WORD_SIZE_NAME_TO_PT[item]}pt)` }))"
                        class="word-style-input"
                        @update:value="updateWordFontSizeName('body', $event)"
                      />
                      <a-input-number
                        v-else
                        :value="wordStyle.fontSize.body.pt"
                        :min="9"
                        :max="24"
                        :step="0.5"
                        class="word-style-input"
                        @update:value="updateWordFontPt('body', $event)"
                      />
                    </div>
                  </a-form-item>
                  <a-form-item label="代码字号">
                    <div class="word-style-field">
                      <a-radio-group
                        :value="wordStyle.fontSize.code.mode"
                        size="small"
                        @update:value="updateWordFontMode('code', $event)"
                      >
                        <a-radio-button value="name">中文字号</a-radio-button>
                        <a-radio-button value="pt">pt</a-radio-button>
                      </a-radio-group>
                      <a-select
                        v-if="wordStyle.fontSize.code.mode === 'name'"
                        :value="wordStyle.fontSize.code.sizeName"
                        :options="WORD_SIZE_OPTIONS.map((item) => ({ value: item, label: `${item} (${WORD_SIZE_NAME_TO_PT[item]}pt)` }))"
                        class="word-style-input"
                        @update:value="updateWordFontSizeName('code', $event)"
                      />
                      <a-input-number
                        v-else
                        :value="wordStyle.fontSize.code.pt"
                        :min="8"
                        :max="20"
                        :step="0.5"
                        class="word-style-input"
                        @update:value="updateWordFontPt('code', $event)"
                      />
                    </div>
                  </a-form-item>
                </div>

                <div class="form-grid word-style-form-grid">
                  <a-form-item label="正文行距（倍）">
                    <a-input-number
                      :value="wordStyle.paragraphSpacing.bodyLineMultiple"
                      :min="1"
                      :max="3"
                      :step="0.1"
                      class="word-style-input"
                      @update:value="updateParagraphSpacing('bodyLineMultiple', $event)"
                    />
                  </a-form-item>
                  <a-form-item label="段后间距（pt）">
                    <a-input-number
                      :value="wordStyle.paragraphSpacing.bodyAfterPt"
                      :min="0"
                      :max="24"
                      :step="1"
                      class="word-style-input"
                      @update:value="updateParagraphSpacing('bodyAfterPt', $event)"
                    />
                  </a-form-item>
                  <a-form-item label="代码行距（倍）">
                    <a-input-number
                      :value="wordStyle.paragraphSpacing.codeLineMultiple"
                      :min="1"
                      :max="2.5"
                      :step="0.1"
                      class="word-style-input"
                      @update:value="updateParagraphSpacing('codeLineMultiple', $event)"
                    />
                  </a-form-item>
                </div>
              </a-form>
            </div>
          </section>

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
  </a-config-provider>
</template>
