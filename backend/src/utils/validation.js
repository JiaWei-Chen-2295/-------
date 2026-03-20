import sanitizeHtml from "sanitize-html";

const REQUIRED_FORM_FIELDS = [
  "course",
  "project",
  "department",
  "grade",
  "name",
  "studentId",
  "date"
];

const WORD_SIZE_PRESETS = {
  default: {
    headingSizeName: "四号",
    bodySizeName: "小四",
    codeSizeName: "小五",
    bodyLineMultiple: 1.5,
    bodyAfterPt: 7,
    codeLineMultiple: 1.17
  },
  compact: {
    headingSizeName: "小四",
    bodySizeName: "五号",
    codeSizeName: "小五",
    bodyLineMultiple: 1.3,
    bodyAfterPt: 4,
    codeLineMultiple: 1.1
  },
  large: {
    headingSizeName: "三号",
    bodySizeName: "四号",
    codeSizeName: "五号",
    bodyLineMultiple: 1.75,
    bodyAfterPt: 10,
    codeLineMultiple: 1.3
  }
};

const WORD_SIZE_NAME_TO_PT = {
  "八号": 5,
  "七号": 5.5,
  "小六": 6.5,
  "六号": 7.5,
  "小五": 9,
  "五号": 10.5,
  "小四": 12,
  "四号": 14,
  "小三": 15,
  "三号": 16,
  "小二": 18,
  "二号": 22,
  "小一": 24,
  "一号": 26,
  "小初": 36,
  "初号": 42
};

function clampNumber(value, { min, max, fallback }) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numeric));
}

function ptToHalfPoints(value) {
  return Math.round(value * 2);
}

function ptToTwips(value) {
  return Math.round(value * 20);
}

function lineMultipleToTwips(value) {
  return Math.round(value * 240);
}

function normalizeSizeName(value, fallback) {
  const name = String(value ?? "").trim();
  return WORD_SIZE_NAME_TO_PT[name] ? name : fallback;
}

function resolveFontSizeField(field, fallbackSizeName, range) {
  const sizeName = normalizeSizeName(field?.sizeName, fallbackSizeName);
  const fallbackPt = WORD_SIZE_NAME_TO_PT[sizeName];

  if (field?.mode === "pt") {
    return {
      mode: "pt",
      sizeName,
      pt: clampNumber(field?.pt, {
        ...range,
        fallback: fallbackPt
      })
    };
  }

  return {
    mode: "name",
    sizeName,
    pt: fallbackPt
  };
}

function resolveParagraphSpacing(spacing, basePreset) {
  return {
    bodyLineMultiple: clampNumber(spacing?.bodyLineMultiple, {
      min: 1,
      max: 3,
      fallback: basePreset.bodyLineMultiple
    }),
    bodyAfterPt: clampNumber(spacing?.bodyAfterPt, {
      min: 0,
      max: 24,
      fallback: basePreset.bodyAfterPt
    }),
    codeLineMultiple: clampNumber(spacing?.codeLineMultiple, {
      min: 1,
      max: 2.5,
      fallback: basePreset.codeLineMultiple
    })
  };
}

function cleanText(value, maxLength = 120) {
  return sanitizeHtml(String(value ?? ""), {
    allowedTags: [],
    allowedAttributes: {}
  })
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeWordStyle(wordStyle = {}) {
  const preset = WORD_SIZE_PRESETS[wordStyle.preset] ? wordStyle.preset : "default";
  const baseFontSize = WORD_SIZE_PRESETS[preset];

  if (wordStyle.preset !== "custom") {
    const normalizedFontSize = {
      heading: resolveFontSizeField(null, baseFontSize.headingSizeName, { min: 10, max: 28 }),
      body: resolveFontSizeField(null, baseFontSize.bodySizeName, { min: 9, max: 24 }),
      code: resolveFontSizeField(null, baseFontSize.codeSizeName, { min: 8, max: 20 })
    };
    const paragraphSpacing = resolveParagraphSpacing(null, baseFontSize);

    return {
      preset,
      fontSize: normalizedFontSize,
      paragraphSpacing,
      styleOverrides: {
        title: { size: ptToHalfPoints(normalizedFontSize.heading.pt) },
        body: {
          size: ptToHalfPoints(normalizedFontSize.body.pt),
          line: lineMultipleToTwips(paragraphSpacing.bodyLineMultiple),
          paragraphAfter: ptToTwips(paragraphSpacing.bodyAfterPt)
        },
        code: {
          size: ptToHalfPoints(normalizedFontSize.code.pt),
          line: lineMultipleToTwips(paragraphSpacing.codeLineMultiple)
        }
      }
    };
  }

  const customFontSize = {
    heading: resolveFontSizeField(wordStyle.fontSize?.heading, baseFontSize.headingSizeName, {
      min: 10,
      max: 28
    }),
    body: resolveFontSizeField(wordStyle.fontSize?.body, baseFontSize.bodySizeName, {
      min: 9,
      max: 24
    }),
    code: resolveFontSizeField(wordStyle.fontSize?.code, baseFontSize.codeSizeName, {
      min: 8,
      max: 20
    })
  };
  const paragraphSpacing = resolveParagraphSpacing(wordStyle.paragraphSpacing, baseFontSize);

  return {
    preset: "custom",
    fontSize: customFontSize,
    paragraphSpacing,
    styleOverrides: {
      title: { size: ptToHalfPoints(customFontSize.heading.pt) },
      body: {
        size: ptToHalfPoints(customFontSize.body.pt),
        line: lineMultipleToTwips(paragraphSpacing.bodyLineMultiple),
        paragraphAfter: ptToTwips(paragraphSpacing.bodyAfterPt)
      },
      code: {
        size: ptToHalfPoints(customFontSize.code.pt),
        line: lineMultipleToTwips(paragraphSpacing.codeLineMultiple)
      }
    }
  };
}

export function normalizeGenerateRequest(payload) {
  if (!payload || typeof payload !== "object") {
    const error = new Error("请求体不能为空");
    error.statusCode = 400;
    throw error;
  }

  const form = payload.form ?? {};
  const normalizedForm = {};

  for (const field of REQUIRED_FORM_FIELDS) {
    normalizedForm[field] = cleanText(form[field], field === "project" ? 160 : 80);
    if (!normalizedForm[field]) {
      const error = new Error(`表单字段缺失: ${field}`);
      error.statusCode = 400;
      throw error;
    }
  }

  const markdown = String(payload.markdown ?? "")
    .replace(/\r\n/g, "\n")
    .trim();

  if (!markdown) {
    const error = new Error("Markdown 内容不能为空");
    error.statusCode = 400;
    throw error;
  }

  if (markdown.length > 120000) {
    const error = new Error("Markdown 内容过长");
    error.statusCode = 400;
    throw error;
  }

  return {
    form: normalizedForm,
    markdown,
    wordStyle: normalizeWordStyle(payload.wordStyle)
  };
}
