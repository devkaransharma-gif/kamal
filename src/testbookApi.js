require("dotenv").config();

async function getTestbookSales() {
  if (!process.env.TESTBOOK_API_URL) throw new Error("TESTBOOK_API_URL is not configured");
  if (!process.env.TESTBOOK_API_KEY) throw new Error("TESTBOOK_API_KEY is not configured");

  const url = new URL(process.env.TESTBOOK_API_URL);
  url.searchParams.set("api_key", process.env.TESTBOOK_API_KEY);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Testbook API error: ${response.status}`);

  return response.json();
}

module.exports = { getTestbookSales };
