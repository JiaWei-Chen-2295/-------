import crypto from "node:crypto";
import path from "node:path";

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

export function isSupportedImageSource(source) {
  if (!source) {
    return false;
  }

  const normalized = decodeURIComponent(String(source)).replace(/\\/g, "/").trim();
  const pathname = normalized.replace(/^https?:\/\/[^/]+/i, "");
  const extension = path.extname(path.basename(pathname)).toLowerCase();

  return Boolean(pathname) && ALLOWED_IMAGE_EXTENSIONS.has(extension);
}
