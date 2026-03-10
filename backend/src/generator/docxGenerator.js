import fs from "node:fs/promises";

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  SectionType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType
} from "docx";

import { loadTemplates } from "../template/loadTemplates.js";
import { resolveStoredImagePath } from "../utils/pathSafety.js";

const HEADING_MAP = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4
};

const COVER_INFO_WIDTHS = [2600, 2200, 2600];

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

function padUnderlineValue(value, minWidth = 10) {
  const text = String(value ?? "").trim();
  return (text || " ").padEnd(Math.max(minWidth, text.length + 2), " ");
}

function noBorder() {
  return {
    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
  };
}

function looksLikeGenericCaption(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) {
    return true;
  }

  return /^(img|image|screenshot|screen-shot|photo|picture)([-_\s]?\d+)?(\.[a-z0-9]+)?$/i.test(text);
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

function createCoverFieldCell(label, value, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: noBorder(),
    margins: {
      top: 60,
      bottom: 60,
      left: 60,
      right: 60
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text: label,
            font: "SimSun",
            size: 24,
            bold: true
          }),
          new TextRun({ text: " " }),
          new TextRun({
            text: padUnderlineValue(value, 9),
            font: "SimSun",
            size: 24,
            underline: { type: UnderlineType.SINGLE }
          })
        ]
      })
    ]
  });
}

function createCoverTable(form, cover) {
  return new Table({
    width: { size: 7200, type: WidthType.DXA },
    alignment: AlignmentType.CENTER,
    borders: {
      ...noBorder(),
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
    },
    rows: [
      new TableRow({
        children: [
          createCoverFieldCell(cover.labels.department, form.department, COVER_INFO_WIDTHS[0]),
          createCoverFieldCell(cover.labels.grade, form.grade, COVER_INFO_WIDTHS[1]),
          createCoverFieldCell(cover.labels.course, form.course, COVER_INFO_WIDTHS[2])
        ]
      }),
      new TableRow({
        children: [
          createCoverFieldCell(cover.labels.name, form.name, COVER_INFO_WIDTHS[0]),
          createCoverFieldCell(cover.labels.studentId, form.studentId, COVER_INFO_WIDTHS[1]),
          createCoverFieldCell(cover.labels.date, form.date, COVER_INFO_WIDTHS[2])
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 3,
            width: { size: 7200, type: WidthType.DXA },
            borders: noBorder(),
            margins: {
              top: 220,
              bottom: 60,
              left: 60,
              right: 60
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: cover.labels.project,
                    font: "SimSun",
                    size: 28,
                    bold: true
                  }),
                  new TextRun({ text: "  " }),
                  new TextRun({
                    text: padUnderlineValue(form.project, 28),
                    font: "SimSun",
                    size: 28,
                    underline: { type: UnderlineType.SINGLE }
                  })
                ]
              })
            ]
          })
        ]
      })
    ]
  });
}

function createContentBox(cover) {
  const items = cover.contentItems || [];
  const leftItems = items.slice(0, 3).join("\n");
  const rightItems = items.slice(3, 6).join("\n");

  return new Table({
    width: { size: 5200, type: WidthType.DXA },
    alignment: AlignmentType.CENTER,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "111111" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "111111" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "111111" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "111111" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            width: { size: 5200, type: WidthType.DXA },
            borders: noBorder(),
            margins: { top: 60, bottom: 20, left: 60, right: 60 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: cover.contentTitle,
                    font: "SimSun",
                    size: 22,
                    bold: true
                  })
                ]
              })
            ]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 2600, type: WidthType.DXA },
            borders: noBorder(),
            margins: { top: 30, bottom: 80, left: 180, right: 80 },
            children: [
              new Paragraph({
                spacing: { line: 320 },
                children: textRunsFromContent(leftItems, {
                  font: "SimSun",
                  size: 18
                })
              })
            ]
          }),
          new TableCell({
            width: { size: 2600, type: WidthType.DXA },
            borders: noBorder(),
            margins: { top: 30, bottom: 80, left: 80, right: 180 },
            children: [
              new Paragraph({
                spacing: { line: 320 },
                children: textRunsFromContent(rightItems, {
                  font: "SimSun",
                  size: 18
                })
              })
            ]
          })
        ]
      })
    ]
  });
}

function createCoverChildren(form, cover) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 1600, after: 160 },
      children: [
        new TextRun({
          text: cover.schoolNameZh,
          font: "SimSun",
          size: 30,
          bold: true
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: cover.reportTitleZh,
          font: "SimHei",
          size: 36,
          bold: true
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 500 },
      children: [
        new TextRun({
          text: cover.reportTitleEn,
          font: "Times New Roman",
          size: 24,
          bold: true
        })
      ]
    }),
    createContentBox(cover),
    new Paragraph({ spacing: { after: 360 } }),
    createCoverTable(form, cover)
  ];
}

function createListParagraphs(block, styles) {
  return block.items.map((item, index) => {
    const prefix = block.ordered ? `${index + 1}. ` : "• ";
    return new Paragraph({
      spacing: { after: 120 },
      indent: { left: 420 },
      children: textRunsFromContent(`${prefix}${item}`, {
        font: styles.body.font,
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
                  font: styles.code.font,
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
                font: styles.code.font,
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
                font: styles.body.font,
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
          font: styles.body.font,
          size: styles.body.size - 2,
          color: "5B6475"
        })
      ]
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
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
  const imagePath = resolveStoredImagePath(block.src);
  if (!imagePath) {
    return [
      new Paragraph({
        spacing: { before: 120, after: 120 },
        children: [
          new TextRun({
            text: `图片缺失：${block.caption || block.src}`,
            color: "B45309",
            font: styles.body.font,
            size: styles.body.size
          })
        ]
      })
    ];
  }

  try {
    const data = await fs.readFile(imagePath);
    const imageSize = fitImageSize(getImageDimensions(data), styles);
    const showCaption = !looksLikeGenericCaption(block.caption);

    return [
      new Paragraph({
        spacing: { before: 180, after: showCaption ? 60 : 140 },
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data,
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
                  font: styles.body.font,
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
            font: styles.body.font,
            size: styles.body.size
          })
        ]
      })
    ];
  }
}

async function createBodyChildren(ast, styles) {
  const children = [];

  for (const block of ast) {
    if (block.type === "heading") {
      children.push(
        new Paragraph({
          heading: HEADING_MAP[Math.min(block.level, 4)] || HeadingLevel.HEADING_4,
          numbering:
            block.level <= 3
              ? { reference: "heading-numbering", level: block.level - 1 }
              : undefined,
          spacing: { before: 260, after: 120 },
          children: [
            new TextRun({
              text: block.text,
              font: styles.title.font,
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
            font: styles.body.font,
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

function createNumberingConfig() {
  return {
    config: [
      {
        reference: "heading-numbering",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 480, hanging: 240 } } }
          },
          {
            level: 1,
            format: LevelFormat.DECIMAL,
            text: "%1.%2",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 260 } } }
          },
          {
            level: 2,
            format: LevelFormat.DECIMAL,
            text: "%1.%2.%3",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 960, hanging: 280 } } }
          }
        ]
      }
    ]
  };
}

export async function generateDocx({ form, ast, outputPath }) {
  const { cover, styles } = await loadTemplates();
  const bodyChildren = await createBodyChildren(ast, styles);

  const document = new Document({
    numbering: createNumberingConfig(),
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: styles.page.marginTop,
              right: styles.page.marginRight,
              bottom: styles.page.marginBottom,
              left: styles.page.marginLeft
            }
          }
        },
        children: createCoverChildren(form, cover)
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            margin: {
              top: styles.page.marginTop,
              right: styles.page.marginRight,
              bottom: styles.page.marginBottom,
              left: styles.page.marginLeft
            }
          }
        },
        children: bodyChildren.length
          ? bodyChildren
          : [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "暂无正文内容",
                    font: styles.body.font,
                    size: styles.body.size
                  })
                ]
              })
            ]
      }
    ]
  });

  const buffer = await Packer.toBuffer(document);
  await fs.writeFile(outputPath, buffer);
}
