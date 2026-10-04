const { getTestbookSales } = require("./testbookApi");
const { normalizeSales, summary } = require("./salesProcessor");

async function main() {
  const records = normalizeSales(await getTestbookSales());

  console.log(JSON.stringify(summary(records), null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
