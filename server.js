/**
 * InterviewAI — server.js
 * Pure Node.js. Zero npm dependencies.
 *
 * 1. Reads GEMINI_API_KEY from .env
 * 2. Serves /public as static files
 * 3. POST /api/gemini → proxies to Google Gemini API
 *
 * Run:  node server.js
 * Open: http://localhost:3000
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const url = require("url");

// ── Load .env ──────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const t = line.trim();
      if (!t || t.startsWith("#")) return;
      const i = t.indexOf("=");
      if (i === -1) return;
      process.env[t.slice(0, i).trim()] = t
        .slice(i + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    });
}
loadEnv();

const API_KEY = process.env.GEMINI_API_KEY || "";
const PORT = parseInt(process.env.PORT || "3001", 10);

if (!API_KEY) {
  console.error("\n❌  GEMINI_API_KEY not set in .env!");
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".ico": "image/x-icon",
};

// ── Proxy to Gemini ────────────────────────────────────
// Browser sends: { systemPrompt, userPrompt }
// We call: POST generativelanguage.googleapis.com
//          /v1beta/models/gemini-1.5-flash:generateContent?key=...
function proxyToGemini(body, res) {
  // Combine system + user into one prompt
  const fullPrompt = `${body.systemPrompt}\n\n${body.userPrompt}`;

  const contents = [];
  const parts = [{ text: fullPrompt }];

  // If file provided (multimodal)
  if (body.fileData && body.fileType) {
    parts.push({
      inline_data: {
        mime_type: body.fileType,
        data: body.fileData,
      },
    });
  }

  contents.push({ parts });

  const geminiBody = JSON.stringify({
    contents,
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
  });

  const options = {
    hostname: "generativelanguage.googleapis.com",
    path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(geminiBody),
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    let data = "";
    proxyRes.on("data", (chunk) => {
      data += chunk;
    });
    proxyRes.on("end", () => {
      console.log(`\n🤖 Gemini Response [${proxyRes.statusCode}]:`);
      console.log(data.length > 500 ? data.slice(0, 500) + "..." : data);

      res.writeHead(proxyRes.statusCode, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(data);
    });
  });

  proxyReq.on("error", (err) => {
    console.error("Proxy error:", err.message);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Proxy error: " + err.message }));
  });

  proxyReq.write(geminiBody);
  proxyReq.end();
}

// ── HTTP Server ────────────────────────────────────────
const server = http.createServer((req, res) => {
  const pathname = url.parse(req.url).pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // POST /api/gemini
  if (pathname === "/api/gemini" && req.method === "POST") {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        proxyToGemini(JSON.parse(raw), res);
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  // Static files
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(__dirname, "public", safePath);
  if (!filePath.startsWith(path.join(__dirname, "public"))) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("404 Not Found");
      return;
    }
    const mime =
      MIME_TYPES[path.extname(filePath).toLowerCase()] ||
      "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n✅  InterviewAI running at http://localhost:${PORT}`);
  console.log(
    `🔑  Gemini key: ${API_KEY ? API_KEY.slice(0, 10) + "****" : "❌ NOT SET"}`
  );
  console.log(`🤖  Model: gemini-1.5-flash\n`);
});
