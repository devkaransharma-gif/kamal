const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { getTestbookSales } = require("./testbookApi");
const { normalizeSales, summary } = require("./salesProcessor");

const PORT = Number(process.env.PORT || 3000);
const DASHBOARD_USER = process.env.DASHBOARD_USER || "";
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "";
const dashboard = fs.readFileSync(path.join(__dirname, "dashboard.html"), "utf8");

function sendJson(res, status, payload) {
  res.writeHead(status, {"Content-Type":"application/json","Cache-Control":"no-store"});
  res.end(JSON.stringify(payload));
}
function csvEscape(value) { const text = value == null ? "" : String(value); return /[",\n\r]/.test(text) ? "\"" + text.replace(/"/g, '\"') + "\"" : text; }
function sendCsv(res, rows) { const headers = ["Lead ID","Assign Date","Counselor","Manager","TL","Sale Date","Sale Product","Sale Amount","Sale Agent","Sale Number"]; const lines = [headers.join(",")]; for (const r of rows) lines.push([r.Lead_id,r.Assign_Date || r.assignOn,r.assign_BD,r.ASM,r.team_name,r.Sale_Date,r.Sale_Product,r.Sale_Amount,r.Sale_Agent,r.Sale_Number].map(csvEscape).join(",")); res.writeHead(200, {"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=\"testbook-sales-export.csv\"","Cache-Control":"no-store"}); res.end("\uFEFF" + lines.join("\r\n")); }
function sendHtml(res) {
  res.writeHead(200, {"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
  res.end(dashboard);
}
function parseCookies(req) {
  const cookies={};
  for (const part of (req.headers.cookie||"").split(";")) {
    const i=part.indexOf("=");
    if(i>0) cookies[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());
  }
  return cookies;
}
function sessionToken() {
  if (!DASHBOARD_USER || !DASHBOARD_PASSWORD) return "";
  return crypto.createHmac("sha256", DASHBOARD_PASSWORD).update(DASHBOARD_USER).digest("hex");
}
function validSession(req) {
  const expected=sessionToken(), actual=parseCookies(req).dashboard_session||"";
  return Boolean(expected && actual && actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual),Buffer.from(expected)));
}
function loginPage(error=false) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Testbook Dashboard Login</title><style>body{font-family:Arial;background:#f5f7fb;display:flex;justify-content:center;align-items:center;min-height:100vh}.box{background:white;padding:30px;border-radius:14px;width:340px;box-shadow:0 8px 30px #0001}input,button{width:100%;box-sizing:border-box;padding:12px;margin:8px 0}button{background:#111827;color:white;border:0;border-radius:8px}.error{color:#b91c1c}</style></head><body><div class="box"><h2>Testbook Dashboard</h2>${error?"<p class='error'>Invalid username or password.</p>":""}<form method="post" action="/login"><input name="username" placeholder="Username" required><input name="password" type="password" placeholder="Password" required><button type="submit">Sign in</button></form></div></body></html>`;
}
function logError(pathname,error) {
  console.error(`SALES DASHBOARD ERROR [${pathname}]:`, error?.stack || error?.message || error);
}
const server=http.createServer(async(req,res)=>{
  const requestUrl=new URL(req.url,"http://localhost");
  try {
    if(requestUrl.pathname==="/health") return sendJson(res,200,{status:"ok"});
    if(requestUrl.pathname==="/login"&&req.method==="GET"){
      res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}); return res.end(loginPage());
    }
    if(requestUrl.pathname==="/login"&&req.method==="POST"){
      let body=""; for await(const chunk of req) body+=chunk;
      const form=new URLSearchParams(body);
      if(form.get("username")!==DASHBOARD_USER||form.get("password")!==DASHBOARD_PASSWORD){
        res.writeHead(401,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}); return res.end(loginPage(true));
      }
      res.writeHead(302,{Location:"/dashboard","Set-Cookie":"dashboard_session="+encodeURIComponent(sessionToken())+"; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax","Cache-Control":"no-store"});
      return res.end();
    }
    if(!validSession(req)){res.writeHead(302,{Location:"/login"});return res.end();}
    if(requestUrl.pathname==="/"||requestUrl.pathname==="/dashboard") return sendHtml(res);
    if(requestUrl.pathname==="/sales/export.csv"&&req.method==="GET"){
      try { return sendCsv(res, await getTestbookSales()); } catch(error) { logError("/sales/export.csv",error); return sendJson(res,500,{error:"Unable to export Testbook data."}); }
    }
    if(requestUrl.pathname==="/sales/summary"){
      try {
        const records=normalizeSales(await getTestbookSales());
        return sendJson(res,200,summary(records));
      } catch(error) {
        logError("/sales/summary",error);
        return sendJson(res,500,{error:"Unable to load sales data. Check Render logs for the underlying Testbook API error."});
      }
    }
    if(requestUrl.pathname==="/sales/manager-wise"||requestUrl.pathname==="/sales/tl-wise"){
      const records=normalizeSales(await getTestbookSales()), data=summary(records);
      return sendJson(res,200,requestUrl.pathname.endsWith("manager-wise")?{totalRevenue:data.totalRevenue,totalOrders:data.totalOrders,managerRevenue:data.managerRevenue}:{totalRevenue:data.totalRevenue,totalOrders:data.totalOrders,tlRevenue:data.tlRevenue});
    }
    return sendJson(res,404,{error:"Route not found"});
  } catch(error) {
    logError(requestUrl.pathname,error);
    return sendJson(res,500,{error:"Internal server error"});
  }
});
server.listen(PORT,"0.0.0.0",()=>console.log(`Sales dashboard API running on port ${PORT}`));
