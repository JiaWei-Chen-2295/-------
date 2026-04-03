import fs from "node:fs/promises";

import {
  AlignmentType,
  BorderStyle,
  ImageRun,
  Paragraph,
  PatchType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
  patchDocument
} from "docx";

import { loadTemplates } from "../template/loadTemplates.js";
import { docxCoverTemplatePath } from "../utils/paths.js";
import { isSupportedImageSource } from "../utils/pathSafety.js";
import { loadImageData } from "../storage/objectStorage.js";
import {
  adaptiveCoverFontSize,
  annotateReportAst,
  looksLikeGenericCaption,
  normalizeReportStyles,
  visualLength
} from "./reportLayout.js";

const CODE_TABLE_WIDTHS = [520, 8580];
const CODE_BORDER_COLOR = "969696";
const CODE_INNER_BORDER_COLOR = "D4D4D4";
const CODE_BACKGROUND = "FFFFFF";
const CODE_LINE_NUMBER_BACKGROUND = "FFFFFF";

function createCodeMetaParagraph(text, styles, spacing = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing,
    children: [
      new TextRun({
        text,
        font: styles.body.docxFont,
        size: styles.body.size - 5,
        bold: true,
        color: "2F2F2F"
      })
    ]
  });
}

function createCodeCaption(block, styles) {
  const language = String(block.language || "").trim().toLowerCase();
  const readableLanguage = language && !["text", "txt", "plain", "plaintext"].includes(language) ? language.toUpperCase() : "";

  if (block.filename) {
    return createCodeMetaParagraph(
      readableLanguage ? `代码清单  ${block.filename}（${readableLanguage}）` : `代码清单  ${block.filename}`,
      styles,
      { before: 140, after: 36 }
    );
  }

  if (readableLanguage) {
    return createCodeMetaParagraph(`代码清单（${readableLanguage}）`, styles, { before: 140, after: 36 });
  }

  return null;
}

function getHeadingTextSize(level, baseSize) {
  const normalizedLevel = Math.min(Math.max(level, 1), 4);
  const sizeOffsets = {
    1: 0,
    2: 4,
    3: 6,
    4: 8
  };

  return Math.max(20, baseSize - (sizeOffsets[normalizedLevel] ?? 8));
}

function createHeadingParagraph(block, styles) {
  const level = Math.min(Math.max(block.level, 1), 9);

  return new Paragraph({
    outlineLevel: level - 1,
    spacing: { before: 260, after: 120 },
    children: [
      new TextRun({
        text: block.displayText,
        font: styles.title.docxFont,
        size: getHeadingTextSize(level, styles.title.size),
        bold: true,
        color: styles.title.color
      })
    ]
  });
}

function mergeDeep(base, incoming) {
  if (!incoming || typeof incoming !== "object") {
    return base;
  }

  const result = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = mergeDeep(base[key] ?? {}, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function textRunsFromContent(text, options = {}) {
  const segments = String(text ?? "").split("\n");
  return segments.flatMap((segment, index) => {
    const run = new TextRun({
      text: segment || " ",
      ...options
    });

    if (index === segments.length - 1) {
      return [run];
    }

    return [run, new TextRun({ break: 1 })];
  });
}

function getPngDimensions(data) {
  if (data.length < 24) {
    return null;
  }

  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20)
  };
}

function getJpegDimensions(data) {
  let offset = 2;

  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = data[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }

    if (offset + 4 > data.length) {
      return null;
    }

    const size = data.readUInt16BE(offset + 2);
    if (size < 2) {
      return null;
    }

    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        width: data.readUInt16BE(offset + 7),
        height: data.readUInt16BE(offset + 5)
      };
    }

    offset += 2 + size;
  }

  return null;
}

function getImageDimensions(data) {
  const isPng =
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a &&
    data[6] === 0x1a &&
    data[7] === 0x0a;

  if (isPng) {
    return getPngDimensions(data);
  }

  if (data[0] === 0xff && data[1] === 0xd8) {
    return getJpegDimensions(data);
  }

  return null;
}

function fitImageSize(dimensions, styles) {
  const maxWidth = styles.image.maxWidth;
  const maxHeight = styles.image.maxHeight;

  if (!dimensions?.width || !dimensions?.height) {
    return { width: maxWidth, height: maxHeight };
  }

  const scale = Math.min(maxWidth / dimensions.width, maxHeight / dimensions.height, 1);
  return {
    width: Math.max(1, Math.round(dimensions.width * scale)),
    height: Math.max(1, Math.round(dimensions.height * scale))
  };
}

function inferImageType(filePath) {
  const lower = String(filePath ?? "").toLowerCase();
  if (lower.endsWith(".png")) {
    return "png";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "jpg";
  }
  if (lower.endsWith(".gif")) {
    return "gif";
  }
  if (lower.endsWith(".bmp")) {
    return "bmp";
  }
  return "png";
}

function createListParagraphs(block, styles) {
  return block.items.map((item, index) => {
    const prefix = block.ordered ? `${index + 1}. ` : "";
    return new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { line: styles.body.line, after: styles.body.paragraphAfter },
      indent: block.ordered ? { left: 420, hanging: 280 } : undefined,
      children: textRunsFromContent(`${prefix}${item}`, {
        font: styles.body.docxFont,
        size: styles.body.size
      })
    });
  });
}

function createCodeBlock(block, styles) {
  const lines = String(block.content ?? "").split("\n");
  const codeBackground = styles.code.background || CODE_BACKGROUND;
  const compactCodeLine = Math.max(200, styles.code.line - 70);
  const captionParagraph = createCodeCaption(block, styles);
  const rows = lines.map((line, index) =>
    new TableRow({
      children: [
        new TableCell({
          width: { size: CODE_TABLE_WIDTHS[0], type: WidthType.DXA },
          shading: { fill: CODE_LINE_NUMBER_BACKGROUND },
          margins: { top: 18, bottom: 18, left: 36, right: 36 },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 0, after: 0, line: compactCodeLine },
              children: [
                new TextRun({
                  text: String(index + 1),
                  font: styles.code.docxFont,
                  size: Math.max(14, styles.code.size - 4),
                  color: "7A7A7A"
                })
              ]
            })
          ]
        }),
        new TableCell({
          width: { size: CODE_TABLE_WIDTHS[1], type: WidthType.DXA },
          shading: { fill: codeBackground },
          margins: { top: 18, bottom: 18, left: 72, right: 72 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { before: 0, after: 0, line: compactCodeLine },
              children: textRunsFromContent(line || " ", {
                font: styles.code.docxFont,
                size: styles.code.size
              })
            })
          ]
        })
      ]
    })
  );

  return [
    ...(captionParagraph ? [captionParagraph] : []),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: CODE_TABLE_WIDTHS,
      layout: TableLayoutType.FIXED,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      rows,
      borders: {
        top: { style: BorderStyle.SINGLE, color: CODE_BORDER_COLOR, size: 2 },
        bottom: { style: BorderStyle.SINGLE, color: CODE_BORDER_COLOR, size: 2 },
        left: { style: BorderStyle.SINGLE, color: CODE_BORDER_COLOR, size: 2 },
        right: { style: BorderStyle.SINGLE, color: CODE_BORDER_COLOR, size: 2 },
        insideHorizontal: { style: BorderStyle.SINGLE, color: CODE_INNER_BORDER_COLOR, size: 1 },
        insideVertical: { style: BorderStyle.SINGLE, color: CODE_BORDER_COLOR, size: 1 }
      }
    }),
    new Paragraph({ spacing: { after: 100 } })
  ];
}

async function createImageBlock(block, styles) {
  if (!isSupportedImageSource(block.src)) {
    return [
      new Paragraph({
        spacing: { before: 120, after: 120 },
        children: [
          new TextRun({
            text: `图片缺失：${block.caption || block.src}`,
            color: "B45309",
            font: styles.body.docxFont,
            size: styles.body.size
          })
        ]
      })
    ];
  }

  try {
    const data = await loadImageData(block.src);
    if (!data) {
      throw new Error("图片缺失");
    }

    const imageSize = fitImageSize(getImageDimensions(data), styles);
    const showCaption = block.showCaption ?? !looksLikeGenericCaption(block.caption);
    const imageType = inferImageType(block.src);

    return [
      new Paragraph({
        spacing: { before: 180, after: showCaption ? 60 : 140 },
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data,
            type: imageType,
            transformation: imageSize
          })
        ]
      }),
      ...(showCaption
        ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 180 },
              children: [
                new TextRun({
                  text: block.displayCaption || block.caption,
                  font: styles.body.docxFont,
                  size: styles.body.size - 2,
                  color: "4B5563"
                })
              ]
            })
          ]
        : [new Paragraph({ spacing: { after: 180 } })])
    ];
  } catch {
    return [
      new Paragraph({
        spacing: { before: 120, after: 120 },
        children: [
          new TextRun({
            text: `图片读取失败：${block.caption || block.src}`,
            color: "B45309",
            font: styles.body.docxFont,
            size: styles.body.size
          })
        ]
      })
    ];
  }
}

async function createBodyChildren(ast, styles, options = {}) {
  const children = [];

  for (const block of annotateReportAst(ast, options)) {
    if (block.type === "heading") {
      children.push(createHeadingParagraph(block, styles));
      continue;
    }

    if (block.type === "paragraph") {
      children.push(
        new Paragraph({
          spacing: { line: styles.body.line, after: styles.body.paragraphAfter },
          children: textRunsFromContent(block.text, {
            font: styles.body.docxFont,
            size: styles.body.size
          })
        })
      );
      continue;
    }

    if (block.type === "list") {
      children.push(...createListParagraphs(block, styles));
      continue;
    }

    if (block.type === "code") {
      children.push(...createCodeBlock(block, styles));
      continue;
    }

    if (block.type === "image") {
      children.push(...(await createImageBlock(block, styles)));
    }
  }

  return children;
}

function createPaddedFieldText(value, slotVisualLength) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return " ";
  }

  if (!slotVisualLength) {
    return normalized;
  }

  const textLength = visualLength(normalized);
  if (textLength >= slotVisualLength) {
    return normalized;
  }

  const remaining = slotVisualLength - textLength;
  const leftPadding = Math.floor(remaining / 2);
  const rightPadding = remaining - leftPadding;
  return `${" ".repeat(leftPadding)}${normalized}${" ".repeat(rightPadding)}`;
}

function createFieldTextRun(value, options = {}) {
  const normalized = String(value ?? "").trim() || " ";
  const paddedText = createPaddedFieldText(normalized, options.slotVisualLength);
  const size = adaptiveCoverFontSize(normalized, {
    baseSize: options.baseSize ?? 24,
    minSize: options.minSize ?? 18,
    softLimit: options.softLimit ?? 10,
    hardLimit: options.hardLimit ?? 22
  });

  return new TextRun({
    text: paddedText,
    size
  });
}

function createTemplatePatches(form, bodyChildren) {
  return {
    department: {
      type: PatchType.PARAGRAPH,
      children: [createFieldTextRun(form.department, { slotVisualLength: 16 })]
    },
    grade: {
      type: PatchType.PARAGRAPH,
      children: [createFieldTextRun(form.grade, { softLimit: 6, hardLimit: 14, slotVisualLength: 10 })]
    },
    course: {
      type: PatchType.PARAGRAPH,
      children: [createFieldTextRun(form.course, { softLimit: 8, hardLimit: 18, slotVisualLength: 15 })]
    },
    name: {
      type: PatchType.PARAGRAPH,
      children: [createFieldTextRun(form.name, { softLimit: 6, hardLimit: 12, slotVisualLength: 16 })]
    },
    studentId: {
      type: PatchType.PARAGRAPH,
      children: [createFieldTextRun(form.studentId, { softLimit: 8, hardLimit: 18, slotVisualLength: 10 })]
    },
    date: {
      type: PatchType.PARAGRAPH,
      children: [createFieldTextRun(form.date, { softLimit: 10, hardLimit: 22, slotVisualLength: 15 })]
    },
    project: {
      type: PatchType.PARAGRAPH,
      children: [createFieldTextRun(form.project, { baseSize: 28, minSize: 18, softLimit: 14, hardLimit: 36, slotVisualLength: 30 })]
    },
    reportBody: {
      type: PatchType.DOCUMENT,
      children: bodyChildren.length
        ? bodyChildren
        : [
            new Paragraph({
              children: [
                new TextRun({
                  text: "暂无正文内容"
                })
              ]
            })
          ]
    }
  };
}

export async function generateDocx({ form, ast, styleOverrides = {}, imageCaptionMode = "keep" }) {
  const [{ styles: rawStyles }, templateBuffer] = await Promise.all([
    loadTemplates(),
    fs.readFile(docxCoverTemplatePath)
  ]);
  const styles = normalizeReportStyles(mergeDeep(rawStyles, styleOverrides));

  const bodyChildren = await createBodyChildren(ast, styles, {
    imageCaptionMode
  });
  return patchDocument({
    outputType: "nodebuffer",
    data: templateBuffer,
    patches: createTemplatePatches(form, bodyChildren),
    keepOriginalStyles: true
  });
}



