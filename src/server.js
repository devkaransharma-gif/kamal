const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { getTestbookSales } = require("./testbookApi");
const { normalizeSales, summary } = require("./salesProcessor");

const PORT = Number(process.env.PORT || 3000);
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

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/" || req.url === "/dashboard") {
      return sendHtml(res);
    }

    if (req.url === "/health") {
      return sendJson(res, 200, { status: "ok" });
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

server.listen(PORT, () => {
  console.log(`Sales dashboard API running on port ${PORT}`);
});
