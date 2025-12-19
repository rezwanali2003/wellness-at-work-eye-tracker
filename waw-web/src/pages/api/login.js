// Server-side proxy for /auth/login -> EC2 backend
const API_BASE = "http://16.171.137.237";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ detail: "Method not allowed" });
  }

  try {
    const backendRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const text = await backendRes.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text || null;
    }

    res.status(backendRes.status).json(data);
  } catch (err) {
    console.error("Proxy login error:", err);
    res.status(500).json({ detail: "Login proxy failed" });
  }
}
