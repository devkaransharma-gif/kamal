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

function isAuthorized(req) {
  if (!DASHBOARD_USER || !DASHBOARD_PASSWORD) return false;

  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) return false;

  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 0) return false;

  const user = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);

  return user === DASHBOARD_USER && password === DASHBOARD_PASSWORD;
}

function requireAuth(req, res) {
  if (isAuthorized(req)) return true;

  res.writeHead(401, {
    "WWW-Authenticate": 'Basic realm="Testbook Sales Dashboard"',
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify({ error: "Authentication required" }));
  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/health") {
      return sendJson(res, 200, { status: "ok" });
    }

    if (!requireAuth(req, res)) return;

    if (req.url === "/" || req.url === "/dashboard") {
      return sendHtml(res);
    }

    if (req.url === "/sales/summary") {
      const records = normalizeSales(await getTestbookSales());
      return sendJson(res, 200, summary(records));
    }

    if (req.url === "/sales/manager-wise") {
      const records = normalizeSales(await getTestbookSales());
      const data = summary(records);
      return sendJson(res, 200, {
        totalRevenue: data.totalRevenue,
        totalOrders: data.totalOrders,
        managerRevenue: data.managerRevenue
      });
    }

    if (req.url === "/sales/tl-wise") {
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
