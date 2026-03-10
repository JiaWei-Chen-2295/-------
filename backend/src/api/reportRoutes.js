import { generateReport } from "../generator/reportService.js";
import { normalizeGenerateRequest } from "../utils/validation.js";

export async function registerReportRoutes(app) {
  app.post("/generate", async (request, reply) => {
    try {
      const payload = normalizeGenerateRequest(request.body);
      const result = await generateReport(payload);
      return result;
    } catch (error) {
      request.log.error(error);
      reply.code(error.statusCode || 500);
      return {
        message: error.message || "报告生成失败"
      };
    }
  });
}
