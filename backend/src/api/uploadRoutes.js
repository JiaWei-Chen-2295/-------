import { createStoredImageName } from "../utils/pathSafety.js";
import { saveImage } from "../storage/objectStorage.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif"
]);

export async function registerUploadRoutes(app) {
  app.post("/upload", async (request, reply) => {
    try {
      const file = await request.file();
      if (!file) {
        reply.code(400);
        return { message: "请选择图片文件" };
      }

      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        reply.code(400);
        return { message: "仅支持 PNG/JPG/WEBP/GIF 图片" };
      }

      const filename = createStoredImageName(file.filename);
      const buffer = await file.toBuffer();
      const stored = await saveImage(filename, buffer, {
        contentType: file.mimetype
      });

      return {
        url: stored.url,
        filename: stored.filename
      };
    } catch (error) {
      request.log.error(error);
      reply.code(error.statusCode || 500);
      return {
        message: error.message || "图片上传失败"
      };
    }
  });
}
