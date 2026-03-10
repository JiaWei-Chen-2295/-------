const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function withBase(path) {
  if (!API_BASE) {
    return path;
  }

  return `${API_BASE}${path}`;
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "请求失败");
  }
  return data;
}

export async function generateReport(payload) {
  const response = await fetch(withBase("/generate"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse(response);
}

export async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(withBase("/upload"), {
    method: "POST",
    body: formData
  });

  return parseResponse(response);
}

export function assetUrl(path) {
  return withBase(path);
}
