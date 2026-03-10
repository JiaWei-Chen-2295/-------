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

function cleanText(value, maxLength = 120) {
  return sanitizeHtml(String(value ?? ""), {
    allowedTags: [],
    allowedAttributes: {}
  })
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
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
    markdown
  };
}
