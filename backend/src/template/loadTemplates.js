import fs from "node:fs/promises";

import { coverTemplatePath, styleTemplatePath } from "../utils/paths.js";

const DEFAULT_COVER = {
  schoolNameZh: "太原师范学院",
  schoolNameEn: "Taiyuan Normal University",
  reportTitleZh: "实  验  报  告",
  reportTitleEn: "Experimentation Report of Taiyuan Normal University",
  contentTitle: "报  告  内  容",
  contentItems: [
    "一、实验目的",
    "二、实验原理",
    "三、实验仪器及材料",
    "四、实验方法",
    "五、实验记录及数据处理",
    "六、误差分析及讨论"
  ],
  labels: {
    department: "系  部",
    grade: "年  级",
    course: "课  程",
    name: "姓  名",
    studentId: "学  号",
    date: "日  期",
    project: "项  目"
  }
};

const DEFAULT_STYLES = {
  page: {
    marginTop: 1200,
    marginBottom: 1200,
    marginLeft: 1440,
    marginRight: 1440
  },
  title: {
    font: "Microsoft YaHei",
    size: 36,
    color: "213547"
  },
  body: {
    font: "Microsoft YaHei",
    size: 24,
    line: 360
  },
  code: {
    font: "Consolas",
    size: 18,
    line: 280,
    background: "F6F7FB"
  },
  image: {
    maxWidth: 520,
    maxHeight: 320
  }
};

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

async function loadJson(filePath, fallback) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return mergeDeep(fallback, JSON.parse(content));
  } catch {
    return fallback;
  }
}

export async function loadTemplates() {
  const [cover, styles] = await Promise.all([
    loadJson(coverTemplatePath, DEFAULT_COVER),
    loadJson(styleTemplatePath, DEFAULT_STYLES)
  ]);

  return { cover, styles };
}
