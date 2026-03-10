import path from "node:path";

import { generateDocx } from "./docxGenerator.js";
import { renderReportHtml } from "./htmlRenderer.js";
import { generatePdf } from "./pdfGenerator.js";
import { parseMarkdownToAst } from "../parser/markdownParser.js";
import { outputsDir } from "../utils/paths.js";

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
  const pdfFilename = `${baseName}.pdf`;
  const docxPath = path.join(outputsDir, docxFilename);
  const pdfPath = path.join(outputsDir, pdfFilename);

  await generateDocx({ form, ast, outputPath: docxPath });

  const html = await renderReportHtml({ form, ast });
  await generatePdf({ html, outputPath: pdfPath });

  return {
    docx: `/download/${docxFilename}`,
    pdf: `/download/${pdfFilename}`,
    blocks: ast.length
  };
}
