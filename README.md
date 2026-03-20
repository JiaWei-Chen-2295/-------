# 实验报告生成器

基于 `Vue 3 + Vite + Fastify + docx` 的课程实验报告生成器，支持从 Markdown 生成带封面的 `DOCX` 实验报告。

## 功能概览

- 录入课程、项目、学生、日期等封面信息
- Markdown 编辑、实时预览、图片上传与粘贴
- 解析标题、段落、列表、代码块、图片为统一 AST
- 一键生成 `DOCX` 实验报告
- 支持 Word 导出样式配置
  - 中文字号选择：如 `小五`、`五号`、`小四`、`四号`
  - `pt` 微调：标题、正文、代码块分别配置
  - 段落间距：正文行距、段后间距、代码行距
  - 样式模板：可将当前字号和段落设置保存为本地模板并复用
- 支持本地磁盘存储与 Vercel Blob 存储两种模式
- 后端提供 `POST /generate`、`POST /upload`、`GET /health` 接口

## 技术栈

- 前端：`Vue 3`、`Vite`、`Ant Design Vue`
- 后端：`Fastify`
- 文档生成：`docx`
- 部署：`Vercel`

## 本地启动

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

## 导出样式说明

导出页支持 4 种样式模式：

- `默认`：正文小四、1.5 倍行距、段后 7pt
- `紧凑`：正文五号、1.3 倍行距、段后 4pt
- `大号`：正文四号、1.75 倍行距、段后 10pt
- `自定义`：可分别设置标题、正文、代码块字号与段落间距

自定义模式支持：

- 中文字号和 `pt` 两种方式切换
- 正文行距（倍）
- 段后间距（pt）
- 代码行距（倍）

样式模板说明：

- 可将当前的字号和段落间距保存为命名模板
- 模板保存在浏览器本地 `localStorage`
- 同名模板会被新配置覆盖
- 可在导出页直接应用或删除模板

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

请求体示例：

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
  "markdown": "# 实验目的\n\n说明正文...",
  "wordStyle": {
    "preset": "custom",
    "fontSize": {
      "heading": {
        "mode": "name",
        "sizeName": "四号",
        "pt": 14
      },
      "body": {
        "mode": "name",
        "sizeName": "小四",
        "pt": 12
      },
      "code": {
        "mode": "pt",
        "sizeName": "小五",
        "pt": 9.5
      }
    },
    "paragraphSpacing": {
      "bodyLineMultiple": 1.5,
      "bodyAfterPt": 7,
      "codeLineMultiple": 1.2
    }
  }
}
```

返回结果包含：

- 生成后的 `docx` 下载地址
- 解析出的内容块数量
- 实际生效的样式配置

### `POST /upload`

使用 `multipart/form-data` 上传字段 `file`。

### `GET /health`

返回当前后端状态，以及当前使用的存储驱动（`local` 或 `blob`）。

## 目录结构

- `frontend`：Vue 前端
- `backend`：Fastify 后端
- `api`：Vercel Serverless 入口
- `templates`：封面与样式模板
- `doc/设计文档.md`：原始设计文档

## 开发说明

- 样式默认值来源于 `templates/styles.json`
- 前端导出页会将草稿、导出样式、样式模板保存到浏览器本地
- 后端会对导出样式做归一化和兜底，避免非法值影响文档生成
