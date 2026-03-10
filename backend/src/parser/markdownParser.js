import MarkdownIt from "markdown-it";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false
});

function inlineToText(children = []) {
  return children
    .map((child) => {
      if (child.type === "text" || child.type === "code_inline") {
        return child.content;
      }

      if (child.type === "softbreak" || child.type === "hardbreak") {
        return "\n";
      }

      if (child.type === "image") {
        return child.content || child.attrGet("alt") || "";
      }

      if (child.children) {
        return inlineToText(child.children);
      }

      return child.content || "";
    })
    .join("");
}

function inlineToImageNode(children = []) {
  const meaningful = children.filter((child) => {
    if (child.type === "softbreak" || child.type === "hardbreak") {
      return false;
    }

    if (child.type === "text" && !child.content.trim()) {
      return false;
    }

    return true;
  });

  if (meaningful.length !== 1 || meaningful[0].type !== "image") {
    return null;
  }

  const imageToken = meaningful[0];
  return {
    type: "image",
    src: imageToken.attrGet("src") || "",
    caption: imageToken.content || imageToken.attrGet("alt") || "图片"
  };
}

function parseFenceInfo(info = "") {
  const text = info.trim();
  if (!text) {
    return { language: "text", filename: null };
  }

  const [language, ...rest] = text.split(/\s+/);
  const filenameMatch = text.match(/(?:file|title|filename)=([^\s]+)/i);

  return {
    language: language || "text",
    filename: filenameMatch ? filenameMatch[1].replace(/^['"]|['"]$/g, "") : rest.join(" ") || null
  };
}

function consumeList(tokens, startIndex) {
  const listType = tokens[startIndex].type;
  const closeType = listType === "ordered_list_open" ? "ordered_list_close" : "bullet_list_close";
  const ordered = listType === "ordered_list_open";
  const items = [];
  let index = startIndex + 1;

  while (index < tokens.length && tokens[index].type !== closeType) {
    if (tokens[index].type === "list_item_open") {
      const lines = [];
      index += 1;

      while (index < tokens.length && tokens[index].type !== "list_item_close") {
        if (tokens[index].type === "paragraph_open") {
          const inline = tokens[index + 1];
          const text = inlineToText(inline.children).trim();
          if (text) {
            lines.push(text);
          }
          index += 3;
          continue;
        }

        if (tokens[index].type === "bullet_list_open" || tokens[index].type === "ordered_list_open") {
          const nested = consumeList(tokens, index);
          nested.node.items.forEach((item) => lines.push(item));
          index = nested.nextIndex;
          continue;
        }

        index += 1;
      }

      if (lines.length) {
        items.push(lines.join(" "));
      }
    }

    index += 1;
  }

  return {
    node: {
      type: "list",
      ordered,
      items
    },
    nextIndex: index + 1
  };
}

export function parseMarkdownToAst(markdown) {
  const tokens = md.parse(markdown, {});
  const ast = [];
  let index = 0;
  let pendingFilename = null;

  while (index < tokens.length) {
    const token = tokens[index];

    if (token.type === "heading_open") {
      const level = Number(token.tag.replace("h", "")) || 1;
      const inline = tokens[index + 1];
      const text = inlineToText(inline.children).trim();
      if (text) {
        ast.push({ type: "heading", level, text });
      }
      index += 3;
      continue;
    }

    if (token.type === "paragraph_open") {
      const inline = tokens[index + 1];
      const text = inlineToText(inline.children).trim();
      const imageNode = inlineToImageNode(inline.children);

      if (imageNode) {
        ast.push(imageNode);
      } else if (/^(文件|file)\s*[:：]\s*/i.test(text)) {
        pendingFilename = text.replace(/^(文件|file)\s*[:：]\s*/i, "").trim();
      } else if (text) {
        ast.push({ type: "paragraph", text });
      }

      index += 3;
      continue;
    }

    if (token.type === "fence") {
      const info = parseFenceInfo(token.info);
      ast.push({
        type: "code",
        language: info.language,
        filename: info.filename || pendingFilename,
        content: token.content.replace(/\n$/, "")
      });
      pendingFilename = null;
      index += 1;
      continue;
    }

    if (token.type === "bullet_list_open" || token.type === "ordered_list_open") {
      const parsedList = consumeList(tokens, index);
      if (parsedList.node.items.length) {
        ast.push(parsedList.node);
      }
      index = parsedList.nextIndex;
      continue;
    }

    index += 1;
  }

  return ast;
}
