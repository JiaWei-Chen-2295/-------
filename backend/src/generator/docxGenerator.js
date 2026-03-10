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

function createFieldParagraph(label, value, styles) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 220 },
    children: [
      new TextRun({
        text: `${label}：${value}`,
        font: styles.body.font,
        size: styles.body.size + 2
      })
    ]
  });
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
    return [
      new Paragraph({
        spacing: { before: 180, after: 80 },
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data,
            transformation: {
              width: styles.image.maxWidth,
              height: styles.image.maxHeight
            }
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: block.caption || "图片",
            font: styles.body.font,
            size: styles.body.size - 2,
            color: "5B6475"
          })
        ]
      })
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
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 2800, after: 240 },
            children: [
              new TextRun({
                text: cover.schoolName,
                font: styles.title.font,
                size: styles.title.size - 6,
                color: styles.title.color
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: cover.reportTitle,
                font: styles.title.font,
                size: styles.title.size + 8,
                bold: true,
                color: styles.title.color
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 900 },
            children: [
              new TextRun({
                text: form.project,
                font: styles.title.font,
                size: styles.title.size,
                color: "C96F35"
              })
            ]
          }),
          createFieldParagraph("系部", form.department, styles),
          createFieldParagraph("年级", form.grade, styles),
          createFieldParagraph("课程", form.course, styles),
          createFieldParagraph("姓名", form.name, styles),
          createFieldParagraph("学号", form.studentId, styles),
          createFieldParagraph("日期", form.date, styles),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 800 },
            children: [
              new TextRun({
                text: cover.footerNote,
                font: styles.body.font,
                size: styles.body.size - 2,
                color: "5B6475"
              })
            ]
          })
        ]
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
