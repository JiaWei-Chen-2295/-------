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

    return `
      <figure>
        <img src="${src}" alt="${escapeHtml(block.caption || "图片")}" />
        <figcaption>${escapeHtml(block.caption || "图片")}</figcaption>
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
            --ink: #1f2937;
            --muted: #5b6475;
            --line: #d7deea;
            --paper: #ffffff;
            --panel: #f7f8fc;
            --accent: #c96f35;
            --title-font: "Microsoft YaHei", sans-serif;
            --body-font: "Microsoft YaHei", sans-serif;
            --code-font: "Consolas", monospace;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: var(--ink);
            background: #eef2f8;
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
            display: flex;
            flex-direction: column;
            justify-content: center;
            text-align: center;
            page-break-after: always;
          }
          .cover h1 {
            margin: 0;
            font-size: 28px;
            letter-spacing: 0.08em;
          }
          .cover h2 {
            margin: 20px 0 8px;
            font-size: 22px;
            color: var(--accent);
          }
          .cover p {
            margin: 6px 0;
            color: var(--muted);
            font-size: 14px;
          }
          .cover-grid {
            width: 100%;
            margin-top: 48px;
            border-collapse: collapse;
          }
          .cover-grid td {
            padding: 12px 16px;
            border-bottom: 1px solid var(--line);
            font-size: 14px;
          }
          .cover-grid td:first-child {
            width: 32%;
            color: var(--muted);
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
          figure img {
            max-width: 100%;
            max-height: ${styles.image.maxHeight}px;
            border-radius: 12px;
            border: 1px solid var(--line);
          }
          figcaption {
            margin-top: 8px;
            color: var(--muted);
            font-size: 12px;
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
            <p>${escapeHtml(cover.schoolName)}</p>
            <h1>${escapeHtml(cover.reportTitle)}</h1>
            <h2>${escapeHtml(form.project)}</h2>
            <p>${escapeHtml(cover.subtitle)}</p>
            <table class="cover-grid">
              <tbody>
                <tr><td>系部</td><td>${escapeHtml(form.department)}</td></tr>
                <tr><td>年级</td><td>${escapeHtml(form.grade)}</td></tr>
                <tr><td>课程</td><td>${escapeHtml(form.course)}</td></tr>
                <tr><td>姓名</td><td>${escapeHtml(form.name)}</td></tr>
                <tr><td>学号</td><td>${escapeHtml(form.studentId)}</td></tr>
                <tr><td>日期</td><td>${escapeHtml(form.date)}</td></tr>
              </tbody>
            </table>
            <p>${escapeHtml(cover.footerNote)}</p>
          </section>
          ${blocks.join("\n")}
        </main>
      </body>
    </html>`;
}
