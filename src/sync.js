const { getTestbookSales } = require("./testbookApi");
const { normalizeSales, managerWiseRevenue } = require("./salesProcessor");

async function main() {
  const records = normalizeSales(await getTestbookSales());

  console.log(JSON.stringify({
    totalRevenue: records.reduce((sum, row) => sum + row.revenue, 0),
    totalRecords: records.length,
    managerRevenue: managerWiseRevenue(records)
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
