import { generateDocx } from "./docxGenerator.js";
import { parseMarkdownToAst } from "../parser/markdownParser.js";
import { saveReport } from "../storage/objectStorage.js";

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "report";
}

export async function generateReport({ form, markdown }) {
  const ast = parseMarkdownToAst(markdown);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = `${timestamp}-${slugify(form.project)}`;
  const docxFilename = `${baseName}.docx`;
  const docxBuffer = await generateDocx({ form, ast });
  const stored = await saveReport(docxFilename, docxBuffer);

  return {
    docx: stored.downloadUrl,
    blocks: ast.length
  };
}
