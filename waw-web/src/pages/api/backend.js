// src/pages/api/backend.js
// src/pages/api/backend.js
const API_BASE = process.env.BACKEND_BASE

export default async function handler(req, res) {
  // e.g. /api/backend?path=auth/login or path=api/user/me/stats
  const path = req.query.path;
  if (!path || Array.isArray(path)) {
    return res.status(400).json({ detail: "Missing path" });
  }

  // Build query string, but drop the path param itself
  const qs = req.url.split("?")[1] || "";
  const qsWithoutPath = qs
    .split("&")
    .filter((p) => !p.startsWith("path=") && p.length > 0)
    .join("&");

  const url = `${API_BASE}/${path}${qsWithoutPath ? "?" + qsWithoutPath : ""}`;

  const init = {
    method: req.method,
    headers: {
      Authorization: req.headers.authorization || "",
      "Content-Type": req.headers["content-type"] || "application/json",
    },
  };

  if (req.method !== "GET" && req.body && Object.keys(req.body).length) {
    init.body = JSON.stringify(req.body);
  }

  try {
    const backendRes = await fetch(url, init);
    const contentType = backendRes.headers.get("content-type") || "";

    // CSV / binary (export)
    if (
      contentType.includes("text/csv") ||
      contentType.includes("octet-stream")
    ) {
      const buf = Buffer.from(await backendRes.arrayBuffer());
      res.status(backendRes.status);
      res.setHeader("Content-Type", contentType);
      return res.send(buf);
    }

    const text = await backendRes.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text || null;
    }

    res.status(backendRes.status).json(data);
  } catch (err) {
    console.error("Backend proxy error:", err);
    res.status(500).json({ detail: "Backend proxy failed" });
  }
}
