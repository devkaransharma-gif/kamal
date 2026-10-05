function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const cleaned = String(value).replace(/[₹,\s%]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function getRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function normalizeDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  // Excel/CSV serial date support.
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // Unix timestamp support (seconds or milliseconds).
  if (/^\d{10,13}$/.test(raw)) {
    const n = Number(raw);
    const parsed = new Date(raw.length === 10 ? n * 1000 : n);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  // Explicitly parse common DD/MM/YYYY, DD-MM-YYYY and DD.MM.YYYY formats.
  const dmy = raw.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})(?:[ T].*)?$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]) - 1;
    const year = Number(dmy[3]);
    const parsed = new Date(year, month, day);
    if (parsed.getFullYear() === year && parsed.getMonth() === month && parsed.getDate() === day) {
      return parsed;
    }
  }

  // YYYY/MM/DD and YYYY-MM-DD variants.
  const ymd = raw.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[ T].*)?$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]) - 1;
    const day = Number(ymd[3]);
    const parsed = new Date(year, month, day);
    if (parsed.getFullYear() === year && parsed.getMonth() === month && parsed.getDate() === day) {
      return parsed;
    }
  }

  // Standard ISO/RFC date strings. Date.parse supports the standardized date-time format.
  const timestamp = Date.parse(raw);
  if (!Number.isNaN(timestamp)) return new Date(timestamp);

  // Common textual date format such as "04 Oct 2026".
  const textual = raw.match(/^(\d{1,2})[ -]([A-Za-z]{3,9})[ -](\d{4})(?:[ T].*)?$/);
  if (textual) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function first(row, keys) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }
  return null;
}

function normalizeSales(payload) {
  return getRows(payload).map((row) => ({
    date: first(row, ["date","Date","Sale_Date","sale_date","Sale Date","created_at","createdAt","createdAtUtc","order_date","Order Date","transaction_date","Transaction Date","payment_date","Payment Date","purchase_date","Purchase Date","created_on","Created On","timestamp","Timestamp","datetime","DateTime"]),
    leadDate: first(row, ["assignOn","Assign_Date","assign_date","Assign Date","lead_date","Lead Date","created_at","createdAt"]),
    manager: first(row, ["manager","Manager","manager_name","Manager Name","ASM","asm","Sale_Team","Sale Team"]),
    tl: first(row, ["tl","TL","team_leader","teamLeader","team_leader_name","TL Name","team_name","Team Name"]),
    counselor: first(row, ["assign_BD","Assign_BD","assign_bd","counselor","Counselor","counsellor","Counsellor","counselor_name","Counselor Name","agent","Agent","Sale_Agent","Sale Agent","Emp_id","employeeEmail"]),
    revenue: toNumber(first(row, ["revenue","Revenue","amount","Amount","paid_amount","Paid Amount","net_revenue","Net Revenue","Sale_Amount","Sale Amount"])),
    product: first(row, ["product","Product","course","Course","product_name","Product Name","course_name","Course Name","Sale_Product","Sale Product"]),
    orderId: first(row, ["orderId","order_id","Order ID","order","Order","transaction_id","Transaction ID","Sale_Number","Sale Number"])
  }));
}

function filterPeriod(records, period, referenceDate = new Date()) {
  return records.filter((record) => {
    const date = normalizeDate(record.date);
    if (!date) return false;
    if (period === "today") {
      return date.getFullYear() === referenceDate.getFullYear() &&
        date.getMonth() === referenceDate.getMonth() &&
        date.getDate() === referenceDate.getDate();
    }
    return date.getFullYear() === referenceDate.getFullYear() &&
      date.getMonth() === referenceDate.getMonth();
  });
}

function aggregateBy(records, field, label) {
  const totals = new Map();
  for (const record of records) {
    const key = record[field] || "Unknown";
    const current = totals.get(key) || { [label]: key, revenue: 0, orders: 0 };
    current.revenue += record.revenue;
    current.orders += 1;
    totals.set(key, current);
  }
  return [...totals.values()].sort((a, b) => b.revenue - a.revenue);
}

function dateKey(value) {
  const d = normalizeDate(value);
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateWisePerformance(records, referenceDate = new Date()) {
  const mtdStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const buckets = new Map();

  for (const r of records) {
    const leadDate = normalizeDate(r.leadDate);
    const saleDate = normalizeDate(r.date);

    if (leadDate && leadDate >= mtdStart && leadDate <= referenceDate) {
      const key = dateKey(leadDate);
      if (!buckets.has(key)) buckets.set(key, { date: key, leads: 0, sales: 0, revenue: 0 });
      buckets.get(key).leads += 1;
    }

    if (saleDate && saleDate >= mtdStart && saleDate <= referenceDate) {
      const key = dateKey(saleDate);
      if (!buckets.has(key)) buckets.set(key, { date: key, leads: 0, sales: 0, revenue: 0 });
      buckets.get(key).sales += 1;
      buckets.get(key).revenue += r.revenue;
    }
  }

  return [...buckets.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(x => ({ ...x, cvr: x.leads > 0 ? (x.sales / x.leads) * 100 : 0 }));
}


function counselorLeadCounts(records, referenceDate = new Date()) {
  const counts = new Map();
  let validLeadDates = 0;
  for (const r of records) {
    const counselor = String(r.counselor || '').trim() || 'Unknown';
    if (normalizeDate(r.leadDate)) validLeadDates++;
    if (!counts.has(counselor)) counts.set(counselor, {
      manager: r.manager || 'Unknown', tl: r.tl || 'Unknown', counselor, leads: 0
    });
    counts.get(counselor).leads += 1;
  }
  return { counts, validLeadDates, usedMtdDates: false };
}
function managerWiseRevenue(records) { return aggregateBy(records, "manager", "manager"); }
function tlWiseRevenue(records) { return aggregateBy(records, "tl", "tl"); }
function counselorWiseRevenue(records) { return aggregateBy(records, "counselor", "counselor"); }
function productWiseRevenue(records) { return aggregateBy(records, "product", "product"); }

function hierarchy(records, referenceDate = new Date()) {
  const mtd = filterPeriod(records, "mtd", referenceDate);
  const today = filterPeriod(records, "today", referenceDate);
  const keyOf = (r, fields) => fields.map(f => r[f] || "Unknown").join("|||");
  const build = (rows, fields, labels) => {
    const map = new Map();
    for (const r of rows) {
      const key = keyOf(r, fields);
      if (!map.has(key)) {
        const item = { revenue: 0, orders: 0 };
        fields.forEach((f, i) => item[labels[i]] = r[f] || "Unknown");
        map.set(key, item);
      }
      const item = map.get(key);
      item.revenue += r.revenue;
      item.orders += 1;
    }
    return [...map.values()].sort((a,b) => b.revenue - a.revenue);
  };
  return {
    managers: hierarchyLevel(mtd, today, ["manager"], "manager"),
    tls: hierarchyLevel(mtd, today, ["manager","tl"], "tl"),
    counselors: hierarchyLevel(mtd, today, ["manager","tl","counselor"], "counselor"),
    products: hierarchyLevel(mtd, today, ["product"], "product")
  };
}

function hierarchyLevel(mtd, today, fields, label) {
  const keyOf = r => fields.map(f => r[f] || "Unknown").join("|||");
  const m = new Map(), t = new Map();
  for (const r of mtd) {
    const key = keyOf(r);
    if (!m.has(key)) m.set(key, { [label]: r[fields[fields.length-1]] || "Unknown", revenue:0, orders:0, ...Object.fromEntries(fields.map(f=>[f,r[f]||"Unknown"])) });
    const x=m.get(key); x.revenue+=r.revenue; x.orders++;
  }
  for (const r of today) {
    const key=keyOf(r);
    if (!t.has(key)) t.set(key,0);
    t.set(key,t.get(key)+r.revenue);
  }
  return [...m.entries()].map(([key,x])=>({...x,todayRevenue:t.get(key)||0})).sort((a,b)=>b.revenue-a.revenue);
}

function parseJsonEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

function targetFor(targets, type, name) {
  const value = targets?.[type]?.[name] ?? targets?.[type]?.default ?? 0;
  return toNumber(value);
}

function incentiveFor(revenue, slabs) {
  let matched = null;
  for (const slab of slabs) {
    const threshold = toNumber(slab.threshold);
    if (revenue >= threshold && (!matched || threshold > matched.threshold)) {
      matched = { threshold, incentive: toNumber(slab.incentive) };
    }
  }
  const sorted = slabs.map(s => ({ threshold: toNumber(s.threshold), incentive: toNumber(s.incentive) }))
    .filter(s => s.threshold > revenue).sort((a,b)=>a.threshold-b.threshold);
  const next = sorted[0] || null;
  return { current: matched, next, gapToNext: next ? Math.max(0, next.threshold - revenue) : 0 };
}

function enrich(rows, targetType, targets, slabs) {
  return rows.map(row => {
    const target = targetFor(targets, targetType, row[targetType]);
    const achievement = target > 0 ? (row.revenue / target) * 100 : null;
    return {
      ...row,
      target,
      achievement,
      incentive: incentiveFor(row.revenue, slabs)
    };
  });
}

function buildSummary(records, referenceDate = new Date()) {
  const validDateRecords = records.filter(r => normalizeDate(r.date));
  const revenueRecords = records.filter(r => Number.isFinite(r.revenue) && r.revenue !== 0);
  console.log("NORMALIZED SALES:", JSON.stringify({
    records: records.length,
    validDates: validDateRecords.length,
    revenueRows: revenueRecords.length,
    totalRevenue: records.reduce((sum, r) => sum + r.revenue, 0),
    referenceDate: referenceDate.toISOString().slice(0, 10)
  }));
  const todayRecords = filterPeriod(records, "today", referenceDate);
  const mtdRecords = filterPeriod(records, "mtd", referenceDate);
  const sum = rows => rows.reduce((total,row)=>total+row.revenue,0);
  const targets = parseJsonEnv("SALES_TARGETS_JSON", {});
  const slabs = parseJsonEnv("INCENTIVE_SLABS_JSON", []);
  const managers = hierarchyLevel(mtdRecords,todayRecords,["manager"],"manager");
  const tls = hierarchyLevel(mtdRecords,todayRecords,["manager","tl"],"tl");
  const salesCounselors = hierarchyLevel(mtdRecords,todayRecords,["manager","tl","counselor"],"counselor");
  const leadResult = counselorLeadCounts(records, referenceDate);
  const counselorMap = new Map();
  for (const lead of leadResult.counts.values()) {
    counselorMap.set(lead.counselor, {
      manager: lead.manager, tl: lead.tl, counselor: lead.counselor,
      leads: lead.leads, revenue: 0, orders: 0, todayRevenue: 0
    });
  }
  for (const sale of salesCounselors) {
    const counselor = String(sale.counselor || '').trim() || 'Unknown';
    const existing = counselorMap.get(counselor);
    counselorMap.set(counselor, {
      ...(existing || {}), ...sale, counselor, leads: existing?.leads || 0
    });
  }

  const counselors = [...counselorMap.values()]
    .sort((a,b) => b.revenue - a.revenue || b.leads - a.leads);

  console.log("COUNSELOR LEADS:", JSON.stringify({
    sourceRows: records.length,
    validLeadDates: leadResult.validLeadDates,
    usedMtdDates: leadResult.usedMtdDates,
    counselorCount: counselors.length,
    totalLeads: counselors.reduce((sum, row) => sum + row.leads, 0)
  }));

  const products = hierarchyLevel(mtdRecords,todayRecords,["product"],"product");
  return {
    generatedAt: new Date().toISOString(),
    totalRevenue: sum(records),
    totalOrders: records.length,
    todayRevenue: sum(todayRecords),
    todayOrders: todayRecords.length,
    mtdRevenue: sum(mtdRecords),
    mtdOrders: mtdRecords.length,
    managers: enrich(managers,"manager",targets,slabs),
    tls: enrich(tls,"tl",targets,slabs),
    counselors: enrich(counselors,"counselor",targets,slabs),
    products: products.map(p=>({...p, contribution: sum(mtdRecords)>0 ? (p.revenue/sum(mtdRecords))*100 : 0})),
    dateWise: dateWisePerformance(records, referenceDate),
    managerRevenue: enrich(managerWiseRevenue(records),"manager",targets,slabs),
    tlRevenue: enrich(tlWiseRevenue(records),"tl",targets,slabs),
    incentiveSlabs: slabs
  };
}

function summary(records, referenceDate = new Date()) {
  return buildSummary(records, referenceDate);
}

module.exports = {
  normalizeSales,
  managerWiseRevenue,
  tlWiseRevenue,
  counselorWiseRevenue,
  productWiseRevenue,
  summary,
  buildSummary
};
