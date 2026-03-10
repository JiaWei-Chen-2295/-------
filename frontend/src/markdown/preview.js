import MarkdownIt from "markdown-it";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false
});

export function renderPreview(markdown) {
  return md.render(markdown || "");
}
