import fs from "node:fs/promises";
import path from "node:path";

import { loadTemplates } from "../template/loadTemplates.js";
import { resolveStoredImagePath } from "../utils/pathSafety.js";

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mimeFromExtension(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return null;
}

async function resolveImageSource(src) {
  const absolutePath = resolveStoredImagePath(src);
  if (!absolutePath) {
    return null;
  }

  try {
    const data = await fs.readFile(absolutePath);
    const mime = mimeFromExtension(absolutePath);
    if (!mime) {
      return null;
    }
    return `data:${mime};base64,${data.toString("base64")}`;
  } catch {
    return null;
  }
}

function renderCodeTable(content) {
  const rows = content.split("\n");
  const body = rows
    .map(
      (line, index) => `
        <tr>
          <td class="code-line">${index + 1}</td>
          <td><pre>${escapeHtml(line || " ")}</pre></td>
        </tr>`
    )
    .join("");

  return `<table class="code-table"><tbody>${body}</tbody></table>`;
}

function renderList(block) {
  const tag = block.ordered ? "ol" : "ul";
  const items = block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<${tag}>${items}</${tag}>`;
}

function renderCoverField(label, value) {
  return `
    <div class="cover-field">
      <span class="cover-label">${escapeHtml(label)}</span>
      <span class="cover-value">${escapeHtml(value)}</span>
    </div>`;
}

function looksLikeGenericCaption(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) {
    return true;
  }

  return /^(img|image|screenshot|screen-shot|photo|picture)([-_\s]?\d+)?(\.[a-z0-9]+)?$/i.test(text);
}

function renderContentBox(cover) {
  const items = cover.contentItems || [];
  const leftItems = items.slice(0, 3);
  const rightItems = items.slice(3, 6);

  return `
    <section class="cover-content-box">
      <div class="cover-content-title">${escapeHtml(cover.contentTitle)}</div>
      <div class="cover-content-grid">
        <div>${leftItems.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div>
        <div>${rightItems.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div>
      </div>
    </section>`;
}

async function renderBlock(block) {
  if (block.type === "heading") {
    const level = Math.min(Math.max(block.level, 1), 6);
    return `<h${level}>${escapeHtml(block.text)}</h${level}>`;
  }

  if (block.type === "paragraph") {
    const html = escapeHtml(block.text).replace(/\n/g, "<br />");
    return `<p>${html}</p>`;
  }

  if (block.type === "list") {
    return renderList(block);
  }

  if (block.type === "code") {
    const meta = [block.filename, block.language].filter(Boolean).join(" | ");
    return `
      <section class="code-block">
        ${meta ? `<div class="code-meta">${escapeHtml(meta)}</div>` : ""}
        ${renderCodeTable(block.content)}
      </section>`;
  }

  if (block.type === "image") {
    const src = await resolveImageSource(block.src);
    if (!src) {
      return `<div class="image-missing">图片缺失：${escapeHtml(block.caption || block.src)}</div>`;
    }

    const caption = looksLikeGenericCaption(block.caption) ? "" : block.caption;

    return `
      <figure class="report-image">
        <img src="${src}" alt="${escapeHtml(block.caption || "图片")}" />
        ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}
      </figure>`;
  }

  return "";
}

export async function renderReportHtml({ form, ast }) {
  const { cover, styles } = await loadTemplates();
  const blocks = await Promise.all(ast.map((block) => renderBlock(block)));

  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(form.project)} - 报告</title>
        <style>
          :root {
            --ink: #111827;
            --muted: #5b6475;
            --line: #d7deea;
            --paper: #ffffff;
            --title-font: "Microsoft YaHei", sans-serif;
            --body-font: "SimSun", "Songti SC", serif;
            --code-font: "Consolas", monospace;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: var(--ink);
            background: #ffffff;
            font-family: var(--body-font);
          }
          main {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 16mm 18mm;
            background: var(--paper);
          }
          .cover {
            min-height: 245mm;
            padding-top: 44mm;
            page-break-after: always;
          }
          .cover-head {
            text-align: center;
          }
          .cover-school {
            margin: 0;
            font-size: 15pt;
            font-weight: 700;
          }
          .cover-title {
            margin: 10pt 0 0;
            font-size: 18pt;
            font-weight: 700;
            font-family: "SimHei", "Microsoft YaHei", sans-serif;
            letter-spacing: 0.28em;
          }
          .cover-subtitle {
            margin: 8pt 0 0;
            font-size: 12pt;
            font-weight: 700;
            font-family: "Times New Roman", serif;
          }
          .cover-content-box {
            width: 130mm;
            margin: 14mm auto 10mm;
            border: 1px solid #111827;
            padding: 4mm 7mm 5mm;
          }
          .cover-content-title {
            text-align: center;
            font-size: 11pt;
            font-weight: 700;
            letter-spacing: 0.25em;
            margin-bottom: 3mm;
          }
          .cover-content-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8mm;
          }
          .cover-content-grid p {
            margin: 1.5mm 0;
            font-size: 10pt;
            line-height: 1.45;
          }
          .cover-fields {
            width: 148mm;
            margin: 8mm auto 0;
            display: grid;
            gap: 4mm;
          }
          .cover-row {
            display: grid;
            gap: 5mm;
          }
          .cover-row.three {
            grid-template-columns: 1fr 0.82fr 1fr;
          }
          .cover-row.single {
            grid-template-columns: 1fr;
            width: 110mm;
            margin: 2mm auto 0;
          }
          .cover-field {
            display: flex;
            align-items: baseline;
            gap: 1.5mm;
            font-size: 12pt;
            font-weight: 700;
          }
          .cover-label {
            white-space: nowrap;
          }
          .cover-value {
            flex: 1;
            min-height: 1.1em;
            padding: 0 1mm 0.5mm;
            border-bottom: 1px solid #111827;
            font-size: 11pt;
            font-weight: 400;
          }
          h1, h2, h3, h4 {
            font-family: var(--title-font);
            margin: 22px 0 12px;
          }
          p, li {
            font-size: 14px;
            line-height: 1.9;
          }
          ul, ol {
            padding-left: 24px;
            margin: 12px 0 16px;
          }
          figure {
            margin: 24px 0;
            text-align: center;
          }
          .report-image {
            display: block;
            max-width: 100%;
            margin: 24px 0;
          }
          figure img {
            display: block;
            max-width: min(100%, ${styles.image.maxWidth}px);
            max-height: ${styles.image.maxHeight}px;
            margin: 0 auto;
            object-fit: contain;
          }
          figcaption {
            margin-top: 10px;
            color: #4b5563;
            font-size: 12px;
            text-align: center;
          }
          .code-block {
            margin: 20px 0;
          }
          .code-meta {
            padding: 10px 12px;
            border: 1px solid var(--line);
            border-bottom: 0;
            background: #eef2ff;
            font-size: 12px;
            color: #334155;
          }
          .code-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid var(--line);
            background: ${styles.code.background ? `#${styles.code.background}` : "#f6f7fb"};
          }
          .code-table td {
            padding: 8px 10px;
            border-top: 1px solid var(--line);
            vertical-align: top;
            font-family: var(--code-font);
            font-size: 12px;
          }
          .code-table tr:first-child td {
            border-top: 0;
          }
          .code-line {
            width: 52px;
            text-align: right;
            color: var(--muted);
            border-right: 1px solid var(--line);
          }
          pre {
            margin: 0;
            white-space: pre-wrap;
            word-break: break-word;
          }
          .image-missing {
            padding: 16px;
            background: #fff7ed;
            border: 1px dashed #fb923c;
            color: #9a3412;
          }
        </style>
      </head>
      <body>
        <main>
          <section class="cover">
            <div class="cover-head">
              <p class="cover-school">${escapeHtml(cover.schoolNameZh)}</p>
              <h1 class="cover-title">${escapeHtml(cover.reportTitleZh)}</h1>
              <p class="cover-subtitle">${escapeHtml(cover.reportTitleEn)}</p>
            </div>
            ${renderContentBox(cover)}
            <div class="cover-fields">
              <div class="cover-row three">
                ${renderCoverField(cover.labels.department, form.department)}
                ${renderCoverField(cover.labels.grade, form.grade)}
                ${renderCoverField(cover.labels.course, form.course)}
              </div>
              <div class="cover-row three">
                ${renderCoverField(cover.labels.name, form.name)}
                ${renderCoverField(cover.labels.studentId, form.studentId)}
                ${renderCoverField(cover.labels.date, form.date)}
              </div>
              <div class="cover-row single">
                ${renderCoverField(cover.labels.project, form.project)}
              </div>
            </div>
          </section>
          ${blocks.join("\n")}
        </main>
      </body>
    </html>`;
}
