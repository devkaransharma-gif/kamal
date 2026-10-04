const http = require("node:http");
const { getTestbookSales } = require("./testbookApi");
const { normalizeSales, managerWiseRevenue } = require("./salesProcessor");

const PORT = Number(process.env.PORT || 3000);

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/health") {
      return sendJson(res, 200, { status: "ok" });
    }

    if (req.url === "/sales/manager-wise") {
      const records = normalizeSales(await getTestbookSales());

      return sendJson(res, 200, {
        totalRevenue: records.reduce((sum, row) => sum + row.revenue, 0),
        totalRecords: records.length,
        managerRevenue: managerWiseRevenue(records)
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
