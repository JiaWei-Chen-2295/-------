# 实验报告生成器

基于 `Vue 3 + Vite + Fastify + docx` 的课程实验报告生成器。

## 功能

- 表单录入课程、项目、学生、日期等封面信息
- Markdown 编辑、实时预览、图片上传与粘贴
- 解析标题、段落、列表、代码块、图片为统一 AST
- 生成 `DOCX` 报告
- 后端提供 `POST /generate` 与 `POST /upload` 接口
- 支持本地磁盘存储与 Vercel Blob 存储两种模式

## 启动

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

默认地址：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3000`

本地开发默认使用磁盘存储：

- 上传图片保存到 `backend/storage/images`
- 生成文档保存到 `backend/storage/outputs`

## Vercel 部署

项目根目录已包含 `vercel.json` 和 `api/index.js`，可以直接作为一个 Vercel 项目部署。

部署前请在 Vercel 项目中配置环境变量：

- `BLOB_READ_WRITE_TOKEN`：Vercel Blob 读写令牌
- `STORAGE_DRIVER=blob`：可选；显式指定使用 Blob 存储

启用 Blob 后：

- `/upload` 会把图片上传到 Blob，并返回公开 URL
- `/generate` 会把生成的 `docx` 上传到 Blob，并返回可下载链接
- 文档里的图片会直接从 Blob URL 读取，不再依赖本地磁盘

## 接口

### `POST /generate`

请求体：

```json
{
  "form": {
    "course": "操作系统",
    "project": "进程调度实验",
    "department": "计算机系",
    "grade": "2022",
    "name": "张三",
    "studentId": "20220001",
    "date": "2026-03-10"
  },
  "markdown": "# 实验目的\n..."
}
```

返回结果包含生成后的 `docx` 下载地址与解析块数量。

### `POST /upload`

使用 `multipart/form-data` 上传字段 `file`。

### `GET /health`

返回当前后端状态，以及当前使用的存储驱动（`local` 或 `blob`）。

## 目录

- `frontend`：Vue 前端
- `backend`：Fastify 后端
- `api`：Vercel Serverless 入口
- `templates`：封面与样式模板
- `doc/设计文档.md`：原始设计文档
