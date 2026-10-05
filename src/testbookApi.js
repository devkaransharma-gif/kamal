require("dotenv").config();
const { parse } = require("csv-parse/sync");

async function getTestbookSales() {
  const apiUrl = process.env.TESTBOOK_API_URL;
  const apiKey = process.env.TESTBOOK_API_KEY;

  if (!apiUrl) throw new Error("TESTBOOK_API_URL is not configured");
  if (!apiKey) throw new Error("TESTBOOK_API_KEY is not configured");

  let url;
  try {
    url = new URL(apiUrl);
  } catch {
    throw new Error("TESTBOOK_API_URL is not a valid URL");
  }

  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url, {
    headers: {
      Accept: "text/csv, application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    const detail = body.replace(/api_key=[^&\s]*/gi, "api_key=[REDACTED]").slice(0, 300);
    throw new Error(`Testbook API error: ${response.status}${detail ? ` - ${detail}` : ""}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();

  if (contentType.includes("json") || apiUrl.endsWith(".json")) {
    try {
      return JSON.parse(body);
    } catch {
      throw new Error("Testbook API returned invalid JSON");
    }
  }

  try {
    const rows = parse(body, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      relax_column_count: true,
      trim: true
    });

    // Safe diagnostics: log counts only; never row values or API credentials.
    console.log("SALE FIELD COUNTS:", JSON.stringify({ saleDate: rows.filter(r => r.Sale_Date != null && String(r.Sale_Date).trim() !== "").length, saleAmount: rows.filter(r => r.Sale_Amount != null && String(r.Sale_Amount).trim() !== "").length, saleAgent: rows.filter(r => r.Sale_Agent != null && String(r.Sale_Agent).trim() !== "").length, saleNumber: rows.filter(r => r.Sale_Number != null && String(r.Sale_Number).trim() !== "").length }));
    console.log("LEAD FIELD COUNTS:", JSON.stringify({
      assignDate: rows.filter(r => r.Assign_Date != null && String(r.Assign_Date).trim() !== "").length,
      assignOn: rows.filter(r => r.assignOn != null && String(r.assignOn).trim() !== "").length,
      assignBD: rows.filter(r => r.assign_BD != null && String(r.assign_BD).trim() !== "").length,
      empId: rows.filter(r => r.Emp_id != null && String(r.Emp_id).trim() !== "").length,
      employeeEmail: rows.filter(r => r.employeeEmail != null && String(r.employeeEmail).trim() !== "").length,
      teamName: rows.filter(r => r.team_name != null && String(r.team_name).trim() !== "").length,
      asm: rows.filter(r => r.ASM != null && String(r.ASM).trim() !== "").length
    }));
    console.log("TESTBOOK DATA:", JSON.stringify({
      format: "csv",
      rows: rows.length,
      columns: Object.keys(rows[0] || {})
    }));

    return rows;
  } catch {
    throw new Error("Testbook API returned data that could not be parsed as CSV");
  }
}

module.exports = { getTestbookSales };
