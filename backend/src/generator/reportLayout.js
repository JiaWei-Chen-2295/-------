const GENERIC_FONT_FAMILIES = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"]);

function wrapFontFamily(fontFamily) {
  if (!fontFamily) {
    return null;
  }

  if (GENERIC_FONT_FAMILIES.has(fontFamily)) {
    return fontFamily;
  }

  if (fontFamily.startsWith("\"") || fontFamily.startsWith("'")) {
    return fontFamily;
  }

  return `"${fontFamily}"`;
}

function normalizeHtmlFontStack(value, fallback) {
  const stack = Array.isArray(value) ? value : value ? [value] : fallback;
  return stack.map(wrapFontFamily).filter(Boolean).join(", ");
}

export function visualLength(value) {
  return Array.from(String(value ?? "").trim()).reduce((total, char) => total + (/[^\u0000-\u00ff]/.test(char) ? 2 : 1), 0);
}

export function adaptiveCoverFontSize(value, { baseSize, minSize, softLimit, hardLimit }) {
  const length = visualLength(value);
  if (length <= softLimit) {
    return baseSize;
  }

  if (length >= hardLimit) {
    return minSize;
  }

  const ratio = (length - softLimit) / (hardLimit - softLimit);
  return Math.round((baseSize - (baseSize - minSize) * ratio) * 10) / 10;
}

export function looksLikeGenericCaption(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) {
    return true;
  }

  return /^(img|image|screenshot|screen-shot|photo|picture)([-_\s]?\d+)?(\.[a-z0-9]+)?$/i.test(text);
}

export function annotateReportAst(ast) {
  const counters = [0, 0, 0, 0];

  return ast.map((block) => {
    if (block.type !== "heading") {
      return block;
    }

    const safeLevel = Math.min(Math.max(block.level, 1), 4);
    counters[safeLevel - 1] += 1;

    for (let index = safeLevel; index < counters.length; index += 1) {
      counters[index] = 0;
    }

    const headingLabel = safeLevel > 3 ? "" : counters.slice(0, safeLevel).join(".");
    return {
      ...block,
      headingLabel,
      displayText: headingLabel ? `${headingLabel} ${block.text}` : block.text
    };
  });
}

export function halfPointsToPt(value, fallback = 12) {
  return (value ?? fallback * 2) / 2;
}

export function lineTwipsToCss(value, fallback = 1.5) {
  return value ? Math.round((value / 240) * 100) / 100 : fallback;
}

export function twipsToMm(value, fallback = 0) {
  const safeValue = value ?? fallback;
  return Math.round((safeValue / 56.6929) * 100) / 100;
}

export function normalizeReportStyles(styles = {}) {
  const titleDocxFont = styles.title?.docxFont || styles.title?.font || "Microsoft YaHei";
  const bodyDocxFont = styles.body?.docxFont || styles.body?.font || "Microsoft YaHei";
  const codeDocxFont = styles.code?.docxFont || styles.code?.font || "Consolas";

  return {
    page: {
      marginTop: styles.page?.marginTop ?? 1200,
      marginBottom: styles.page?.marginBottom ?? 1200,
      marginLeft: styles.page?.marginLeft ?? 1440,
      marginRight: styles.page?.marginRight ?? 1440
    },
    title: {
      size: styles.title?.size ?? 36,
      color: styles.title?.color || "213547",
      docxFont: titleDocxFont,
      htmlFont: normalizeHtmlFontStack(styles.title?.htmlFont, [
        titleDocxFont,
        "Noto Sans CJK SC",
        "Noto Sans SC",
        "PingFang SC",
        "sans-serif"
      ])
    },
    body: {
      size: styles.body?.size ?? 24,
      line: styles.body?.line ?? 360,
      docxFont: bodyDocxFont,
      htmlFont: normalizeHtmlFontStack(styles.body?.htmlFont, [
        bodyDocxFont,
        "Noto Serif CJK SC",
        "Noto Serif SC",
        "SimSun",
        "serif"
      ])
    },
    code: {
      size: styles.code?.size ?? 18,
      line: styles.code?.line ?? 280,
      background: styles.code?.background || "F6F7FB",
      docxFont: codeDocxFont,
      htmlFont: normalizeHtmlFontStack(styles.code?.htmlFont, [
        codeDocxFont,
        "Cascadia Mono",
        "Noto Sans Mono CJK SC",
        "monospace"
      ])
    },
    image: {
      maxWidth: styles.image?.maxWidth ?? 520,
      maxHeight: styles.image?.maxHeight ?? 320
    },
    cover: {
      schoolFont: normalizeHtmlFontStack(styles.cover?.schoolFont, [
        titleDocxFont,
        "Noto Sans CJK SC",
        "Noto Sans SC",
        "sans-serif"
      ]),
      titleFont: normalizeHtmlFontStack(styles.cover?.titleFont, [
        "SimHei",
        titleDocxFont,
        "Noto Sans CJK SC",
        "sans-serif"
      ]),
      subtitleFont: normalizeHtmlFontStack(styles.cover?.subtitleFont, ["Times New Roman", "Noto Serif", "serif"]),
      contentFont: normalizeHtmlFontStack(styles.cover?.contentFont, [
        "KaiTi",
        "Noto Serif CJK SC",
        "Noto Serif SC",
        "serif"
      ]),
      infoFont: normalizeHtmlFontStack(styles.cover?.infoFont, [
        bodyDocxFont,
        "Noto Serif CJK SC",
        "Noto Serif SC",
        "serif"
      ])
    }
  };
}
