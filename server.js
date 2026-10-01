// MinWTF Local Development Server & API Route Dispatcher
const http = require("http");
const fs = require("fs");
const path = require("path");

// Load .env variables into process.env if present
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  try {
    const content = fs.readFileSync(envPath, "utf8");
    content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    });
  } catch {}
}

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

// Route registry for /api/ai/* serverless handlers
const API_ROUTES = {
  "/api/ai/comment": require("./api/ai/comment.js"),
  "/api/ai/reply": require("./api/ai/reply.js"),
  "/api/ai/extras": require("./api/ai/extras.js"),
  "/api/ai/queue": require("./api/ai/queue.js"),
  "/api/ai/chat": require("./api/ai/chat.js"),
  "/api/ai/challenge": require("./api/ai/challenge.js"),
  "/api/ai/mood": require("./api/ai/mood.js"),
  "/api/ai/settings": require("./api/ai/settings.js")
};

const server = http.createServer(async (req, res) => {
  const [urlPath, queryString] = req.url.split("?");

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Dispatch API Routes
  if (API_ROUTES[urlPath]) {
    const handler = API_ROUTES[urlPath];
    let body = "";

    req.on("data", chunk => {
      body += chunk;
      if (body.length > 5000000) req.destroy();
    });

    req.on("end", async () => {
      let parsedBody = {};
      if (body) {
        try {
          parsedBody = JSON.parse(body);
        } catch {
          parsedBody = {};
        }
      }

      // Parse query params
      const query = {};
      if (queryString) {
        new URLSearchParams(queryString).forEach((v, k) => {
          query[k] = v;
        });
      }

      // Vercel serverless request wrapper
      const mockReq = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: parsedBody,
        query
      };

      // Vercel serverless response wrapper
      const mockRes = {
        statusCode: 200,
        setHeader: (k, v) => res.setHeader(k, v),
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        json: function(data) {
          res.writeHead(this.statusCode, { "Content-Type": "application/json" });
          res.end(JSON.stringify(data));
        },
        end: function(data) {
          res.writeHead(this.statusCode);
          res.end(data);
        }
      };

      try {
        await handler(mockReq, mockRes);
      } catch (err) {
        console.error(`Error in ${urlPath}:`, err);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message || "Internal server error" }));
        }
      }
    });
    return;
  }

  // Static File Serving
  let filePath = urlPath === "/" ? "/index.html" : urlPath;
  const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, "");
  const fullPath = path.join(__dirname, safePath);

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }

    fs.readFile(fullPath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("500 Server Error");
      } else {
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content);
      }
    });
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n[ERROR] Port ${PORT} is already in use.`);
    console.error(`Set a different port, e.g. PORT=3001 npm run dev\n`);
    process.exit(1);
  } else {
    console.error("[SERVER ERROR]", err);
  }
});

server.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`  MinWTF Web is running locally with Dual-AI Crew!`);
  console.log(`  -> URL: http://localhost:${PORT}/`);
  console.log(`  -> Residents: Gossip (Hype) & Critic (Judge) - Live`);
  console.log(`=================================================\n`);
});
