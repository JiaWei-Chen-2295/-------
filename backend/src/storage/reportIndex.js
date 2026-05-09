import fs from "node:fs/promises";

import { reportIndexPath } from "../utils/paths.js";

const MAX_RECORDS = 5000;

function safeJsonParse(content, fallback) {
  try {
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

async function readAllRecords() {
  try {
    const raw = await fs.readFile(reportIndexPath, "utf8");
    const parsed = safeJsonParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function appendReportRecord(record) {
  const records = await readAllRecords();
  records.push(record);
  const nextRecords = records.slice(-MAX_RECORDS);
  await fs.writeFile(reportIndexPath, JSON.stringify(nextRecords, null, 2), "utf8");
}

export async function listReportRecords() {
  const records = await readAllRecords();
  return records
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
