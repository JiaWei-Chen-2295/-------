import { buildApp } from "../backend/src/app.js";

const appPromise = buildApp().then(async (app) => {
  await app.ready();
  return app;
});

export default async function handler(request, response) {
  const app = await appPromise;
  request.url = request.url.replace(/^\/api/, "") || "/";
  app.server.emit("request", request, response);
}
