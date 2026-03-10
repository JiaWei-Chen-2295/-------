# 实验报告生成器

基于 `Vue 3 + Vite + Fastify + docx + Puppeteer` 的课程实验报告生成器。

## 功能

- 表单录入课程、项目、学生、日期等封面信息
- Markdown 编辑、实时预览、图片上传与粘贴
- 解析标题、段落、列表、代码块、图片为统一 AST
- 生成 `DOCX` 与 `PDF` 两种格式
- 后端提供 `POST /generate` 与 `POST /upload` 接口

## 启动

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

默认地址：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3000`

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

### `POST /upload`

使用 `multipart/form-data` 上传字段 `file`。

## 目录

- `frontend`：Vue 前端
- `backend`：Fastify 后端
- `templates`：封面与样式模板
- `doc/设计文档.md`：原始设计文档
