import fs from "node:fs/promises";

import {
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  ImageRun,
  Paragraph,
  PatchType,
  Table,
  TableCell,
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

const HEADING_MAP = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4
};

const CODE_TABLE_WIDTHS = [900, 8200];

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
    const prefix = block.ordered ? `${index + 1}. ` : "• ";
    return new Paragraph({
      spacing: { after: 120 },
      indent: { left: 420 },
      children: textRunsFromContent(`${prefix}${item}`, {
        font: styles.body.docxFont,
        size: styles.body.size
      })
    });
  });
}

function createCodeBlock(block, styles) {
  const lines = String(block.content ?? "").split("\n");
  const rows = lines.map((line, index) =>
    new TableRow({
      children: [
        new TableCell({
          width: { size: 900, type: WidthType.DXA },
          shading: { fill: styles.code.background || "F6F7FB" },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: String(index + 1),
                  font: styles.code.docxFont,
                  size: styles.code.size,
                  color: "6B7280"
                })
              ]
            })
          ]
        }),
        new TableCell({
          width: { size: 8200, type: WidthType.DXA },
          shading: { fill: styles.code.background || "F6F7FB" },
          children: [
            new Paragraph({
              spacing: { line: styles.code.line },
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
    ...(block.filename
      ? [
          new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [
              new TextRun({
                text: block.filename,
                font: styles.body.docxFont,
                size: styles.body.size,
                bold: true,
                color: "1F2937"
              })
            ]
          })
        ]
      : []),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: `语言：${block.language || "text"}`,
          font: styles.body.docxFont,
          size: styles.body.size - 2,
          color: "5B6475"
        })
      ]
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: CODE_TABLE_WIDTHS,
      rows,
      borders: {
        top: { style: BorderStyle.SINGLE, color: "D7DEEA", size: 1 },
        bottom: { style: BorderStyle.SINGLE, color: "D7DEEA", size: 1 },
        left: { style: BorderStyle.SINGLE, color: "D7DEEA", size: 1 },
        right: { style: BorderStyle.SINGLE, color: "D7DEEA", size: 1 },
        insideHorizontal: { style: BorderStyle.SINGLE, color: "D7DEEA", size: 1 },
        insideVertical: { style: BorderStyle.SINGLE, color: "D7DEEA", size: 1 }
      }
    }),
    new Paragraph({ spacing: { after: 180 } })
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
    const showCaption = !looksLikeGenericCaption(block.caption);
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
                  text: block.caption,
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

async function createBodyChildren(ast, styles) {
  const children = [];

  for (const block of annotateReportAst(ast)) {
    if (block.type === "heading") {
      children.push(
        new Paragraph({
          heading: HEADING_MAP[Math.min(block.level, 4)] || HeadingLevel.HEADING_4,
          spacing: { before: 260, after: 120 },
          children: [
            new TextRun({
              text: block.displayText,
              font: styles.title.docxFont,
              size: styles.body.size + 4,
              bold: true,
              color: styles.title.color
            })
          ]
        })
      );
      continue;
    }

    if (block.type === "paragraph") {
      children.push(
        new Paragraph({
          spacing: { line: styles.body.line, after: 140 },
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

export async function generateDocx({ form, ast }) {
  const [{ styles: rawStyles }, templateBuffer] = await Promise.all([
    loadTemplates(),
    fs.readFile(docxCoverTemplatePath)
  ]);
  const styles = normalizeReportStyles(rawStyles);

  const bodyChildren = await createBodyChildren(ast, styles);
  return patchDocument({
    outputType: "nodebuffer",
    data: templateBuffer,
    patches: createTemplatePatches(form, bodyChildren),
    keepOriginalStyles: true
  });
}



