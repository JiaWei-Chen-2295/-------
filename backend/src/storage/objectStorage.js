import fs from "node:fs/promises";
import path from "node:path";

import { put } from "@vercel/blob";

import { imagesDir, outputsDir } from "../utils/paths.js";

function normalizePathname(value) {
  return String(value ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function buildBlobPath(kind, filename) {
  return `${kind}/${Date.now()}-${filename}`;
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value ?? ""));
}

function createBlobConfigError() {
  const error = new Error("当前部署环境需要配置 BLOB_READ_WRITE_TOKEN 才能上传图片和生成文档");
  error.statusCode = 500;
  return error;
}

async function saveToLocal(kind, filename, buffer) {
  const directory = kind === "images" ? imagesDir : outputsDir;
  const targetPath = path.join(directory, filename);
  await fs.writeFile(targetPath, buffer);

  return {
    filename,
    url: kind === "images" ? `/images/${filename}` : `/download/${filename}`,
    downloadUrl: `/download/${filename}`
  };
}

async function saveToBlob(kind, filename, buffer, options = {}) {
  const blob = await put(buildBlobPath(kind, filename), buffer, {
    access: "public",
    addRandomSuffix: true,
    contentType: options.contentType
  });

  return {
    filename,
    url: blob.url,
    downloadUrl: blob.downloadUrl || blob.url
  };
}

export function isServerlessEnvironment() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export function isBlobStorageEnabled() {
  return process.env.STORAGE_DRIVER === "blob" || Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function getStorageMode() {
  if (isBlobStorageEnabled()) {
    return "blob";
  }

  if (isServerlessEnvironment()) {
    return "unconfigured";
  }

  return "local";
}

export async function saveImage(filename, buffer, options = {}) {
  const mode = getStorageMode();
  if (mode === "blob") {
    return saveToBlob("images", filename, buffer, options);
  }

  if (mode === "unconfigured") {
    throw createBlobConfigError();
  }

  return saveToLocal("images", filename, buffer);
}

export async function saveReport(filename, buffer) {
  const mode = getStorageMode();
  if (mode === "blob") {
    return saveToBlob("reports", filename, buffer, {
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });
  }

  if (mode === "unconfigured") {
    throw createBlobConfigError();
  }

  return saveToLocal("reports", filename, buffer);
}

export async function loadImageData(source) {
  if (!source) {
    return null;
  }

  const normalized = String(source).trim();

  if (isHttpUrl(normalized)) {
    const response = await fetch(normalized);
    if (!response.ok) {
      throw new Error(`图片下载失败：${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  let relativePath = normalizePathname(decodeURIComponent(normalized));
  if (relativePath.startsWith("images/")) {
    relativePath = relativePath.slice("images/".length);
  }

  if (relativePath.startsWith("/images/")) {
    relativePath = relativePath.slice("/images/".length);
  }

  if (!relativePath) {
    return null;
  }

  return fs.readFile(path.join(imagesDir, path.basename(relativePath)));
}
