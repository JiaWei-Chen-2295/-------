import { listReportRecords } from "../storage/reportIndex.js";

function assertAdminAuthorized(request) {
  const configuredSecret = String(process.env.ADMIN_SECRET ?? "").trim();
  if (!configuredSecret) {
    const error = new Error("管理员功能未启用，请先配置 ADMIN_SECRET");
    error.statusCode = 503;
    throw error;
  }

  const incomingSecret = String(request.headers["x-admin-secret"] ?? "").trim();
  if (!incomingSecret || incomingSecret !== configuredSecret) {
    const error = new Error("管理员密钥无效");
    error.statusCode = 401;
    throw error;
  }
}

export async function registerAdminRoutes(app) {
  app.get("/admin-api/reports", async (request, reply) => {
    try {
      assertAdminAuthorized(request);
      const records = await listReportRecords();
      return { items: records };
    } catch (error) {
      request.log.error(error);
      reply.code(error.statusCode || 500);
      return {
        message: error.message || "读取生成记录失败"
      };
    }
  });
}
