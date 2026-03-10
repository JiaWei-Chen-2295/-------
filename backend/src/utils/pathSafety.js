import crypto from "node:crypto";
import path from "node:path";

import { imagesDir } from "./paths.js";

const ALLOWED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export function createStoredImageName(originalName = "image.png") {
  const extension = path.extname(originalName).toLowerCase() || ".png";
  if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    const error = new Error("仅支持 png/jpg/jpeg/webp/gif 图片");
    error.statusCode = 400;
    throw error;
  }

  return `${Date.now()}-${crypto.randomUUID()}${extension}`;
}

export function buildImageUrl(filename) {
  return `/images/${filename}`;
}

export function resolveStoredImagePath(source) {
  if (!source) {
    return null;
  }

  let relativePath = decodeURIComponent(String(source)).replace(/\\/g, "/");

  if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
    return null;
  }

  if (relativePath.startsWith("/images/")) {
    relativePath = relativePath.slice("/images/".length);
  }

  if (relativePath.startsWith("images/")) {
    relativePath = relativePath.slice("images/".length);
  }

  const safeName = path.basename(relativePath);
  const extension = path.extname(safeName).toLowerCase();

  if (!safeName || !ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    return null;
  }

  const absolutePath = path.join(imagesDir, safeName);
  if (!absolutePath.startsWith(imagesDir)) {
    return null;
  }

  return absolutePath;
}
