const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { getTestbookSales } = require("./testbookApi");
const { normalizeSales, summary } = require("./salesProcessor");

const PORT = Number(process.env.PORT || 3000);
const DASHBOARD_USER = process.env.DASHBOARD_USER;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;
const dashboard = fs.readFileSync(path.join(__dirname, "dashboard.html"), "utf8");

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(res) {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(dashboard);
}

function parseCookies(req) {
  const cookies = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return cookies;
}

function sessionToken() {
  return Buffer.from(DASHBOARD_USER + ":" + DASHBOARD_PASSWORD).toString("base64");
}

function validSession(req) {
  return parseCookies(req).dashboard_session === sessionToken();
}

function loginPage(error = false) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Testbook Dashboard Login</title><style>body{font-family:Arial;background:#f5f7fb;display:flex;justify-content:center;align-items:center;min-height:100vh}.box{background:white;padding:30px;border-radius:14px;width:340px;box-shadow:0 8px 30px #0001}input,button{width:100%;box-sizing:border-box;padding:12px;margin:8px 0}button{background:#111827;color:white;border:0;border-radius:8px}.error{color:#b91c1c}</style></head><body><div class="box"><h2>Testbook Dashboard</h2>${error ? "<p class='error'>Invalid username or password.</p>" : ""}<form method="post" action="/login"><input name="username" placeholder="Username" required><input name="password" type="password" placeholder="Password" required><button type="submit">Sign in</button></form></div></body></html>`;
}

function requireSession(req, res) {
  if (validSession(req)) return true;
  res.writeHead(302, { Location: "/login" });
  res.end();
  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, "http://localhost");

    // Render health checks must work without dashboard credentials.
    if (requestUrl.pathname === "/health") {
      return sendJson(res, 200, { status: "ok" });
    }

    if (requestUrl.pathname === "/login" && req.method === "GET") {
      res.writeHead(200, {"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
      return res.end(loginPage());
    }

    if (requestUrl.pathname === "/login" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const form = new URLSearchParams(body);
      if (form.get("username") !== DASHBOARD_USER || form.get("password") !== DASHBOARD_PASSWORD) {
        res.writeHead(401, {"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
        return res.end(loginPage(true));
      }
      res.writeHead(302, {
        Location: "/dashboard",
        "Set-Cookie": "dashboard_session=" + encodeURIComponent(sessionToken()) + "; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax",
        "Cache-Control": "no-store"
      });
      return res.end();
    }

    if (!requireSession(req, res)) return;

    if (requestUrl.pathname === "/" || requestUrl.pathname === "/dashboard") {
      return sendHtml(res);
    }

    if (requestUrl.pathname === "/sales/summary") {
      const records = normalizeSales(await getTestbookSales());
      return sendJson(res, 200, summary(records));
    }

    if (requestUrl.pathname === "/sales/manager-wise") {
      const records = normalizeSales(await getTestbookSales());
      const data = summary(records);
      return sendJson(res, 200, {
        totalRevenue: data.totalRevenue,
        totalOrders: data.totalOrders,
        managerRevenue: data.managerRevenue
      });
    }

    if (requestUrl.pathname === "/sales/tl-wise") {
      const records = normalizeSales(await getTestbookSales());
      const data = summary(records);
      return sendJson(res, 200, {
        totalRevenue: data.totalRevenue,
        totalOrders: data.totalOrders,
        tlRevenue: data.tlRevenue
      });
    }

    return sendJson(res, 404, { error: "Route not found" });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Sales dashboard API running on port ${PORT}`);
});
