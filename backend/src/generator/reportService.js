import { generateDocx } from "./docxGenerator.js";
import { parseMarkdownToAst } from "../parser/markdownParser.js";
import { saveReport } from "../storage/objectStorage.js";
import { appendReportRecord } from "../storage/reportIndex.js";

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "report";
}

export async function generateReport({ form, markdown, wordStyle }) {
  const ast = parseMarkdownToAst(markdown);
  const createdAt = new Date().toISOString();
  const timestamp = createdAt.replace(/[:.]/g, "-");
  const baseName = `${timestamp}-${slugify(form.project)}`;
  const docxFilename = `${baseName}.docx`;
  const docxBuffer = await generateDocx({
    form,
    ast,
    styleOverrides: wordStyle?.styleOverrides,
    imageCaptionMode: wordStyle?.imageCaption?.mode
  });
  const stored = await saveReport(docxFilename, docxBuffer);
  await appendReportRecord({
    id: baseName,
    createdAt,
    form: {
      course: form.course,
      project: form.project,
      department: form.department,
      grade: form.grade,
      name: form.name,
      studentId: form.studentId,
      date: form.date
    },
    blocks: ast.length,
    docxFilename: stored.filename || docxFilename,
    docxDownloadUrl: stored.downloadUrl
  });

  return {
    docx: stored.downloadUrl,
    blocks: ast.length,
    wordStyle: wordStyle
      ? {
          fontSize: wordStyle.fontSize || null,
          paragraphSpacing: wordStyle.paragraphSpacing || null,
          imageCaption: wordStyle.imageCaption || null
        }
      : null
  };
}
