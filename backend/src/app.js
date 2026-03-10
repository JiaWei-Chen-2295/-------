import fs from "node:fs/promises";
import path from "node:path";

import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";

import { registerReportRoutes } from "./api/reportRoutes.js";
import { registerUploadRoutes } from "./api/uploadRoutes.js";
import {
  ensureRuntimeDirs,
  fileExists,
  frontendDistDir,
  imagesDir,
  outputsDir
} from "./utils/paths.js";

export async function buildApp() {
  await ensureRuntimeDirs();

  const app = Fastify({
    logger: true,
    bodyLimit: 10 * 1024 * 1024
  });

  await app.register(cors, { origin: true });
  await app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 1
    }
  });

  await app.register(fastifyStatic, {
    root: imagesDir,
    prefix: "/images/"
  });

  await app.register(fastifyStatic, {
    root: outputsDir,
    prefix: "/download/",
    decorateReply: false
  });

  await registerUploadRoutes(app);
  await registerReportRoutes(app);

  app.get("/health", async () => ({ status: "ok" }));

  const hasFrontendDist = await fileExists(frontendDistDir);
  if (hasFrontendDist) {
    await app.register(fastifyStatic, {
      root: frontendDistDir,
      prefix: "/",
      decorateReply: false,
      index: ["index.html"]
    });

    app.setNotFoundHandler((request, reply) => {
      const assetLikeRequest =
        request.url.startsWith("/generate") ||
        request.url.startsWith("/upload") ||
        request.url.startsWith("/download/") ||
        request.url.startsWith("/images/") ||
        request.url.startsWith("/health");

      if (!assetLikeRequest && request.raw.method === "GET") {
        return fs
          .readFile(path.join(frontendDistDir, "index.html"), "utf8")
          .then((html) => reply.type("text/html; charset=utf-8").send(html));
      }

      reply.code(404).send({ message: "Not Found" });
    });
  }

  return app;
}
