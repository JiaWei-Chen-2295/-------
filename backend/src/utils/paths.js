import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getStorageMode } from "../storage/objectStorage.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

export const backendRoot = path.resolve(currentDir, "../..");
export const projectRoot = path.resolve(backendRoot, "..");
export const templatesDir = path.join(projectRoot, "templates");
export const imagesDir = path.join(backendRoot, "storage", "images");
export const outputsDir = path.join(backendRoot, "storage", "outputs");
export const frontendDistDir = path.join(projectRoot, "frontend", "dist");
export const coverTemplatePath = path.join(templatesDir, "cover.json");
export const styleTemplatePath = path.join(templatesDir, "styles.json");
export const docxCoverTemplatePath = path.join(templatesDir, "cover_fill_template.docx");

export async function ensureRuntimeDirs() {
  if (getStorageMode() !== "local") {
    return;
  }

  await Promise.all([
    fs.mkdir(imagesDir, { recursive: true }),
    fs.mkdir(outputsDir, { recursive: true })
  ]);
}

export async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
