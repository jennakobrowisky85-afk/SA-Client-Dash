import { google } from "googleapis";

// Server-only: never import this file from a "use client" component.
// Reads the three tabs (Centres, Retainers, HoursLogged) from the Google Sheet
// and shapes them into exactly what <ClientOpsDashboard /> expects as props.

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
  // Vercel env vars store newlines as literal "\n" — convert back to real newlines.
  const key = rawKey.replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY environment variables. " +
        "See README.md for setup steps."
    );
  }

  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

async function fetchRange(sheetId, range) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  });
  return res.data.values || [];
}

// Converts a raw [header, ...rows] 2D array (what the Sheets API returns) into
// an array of plain objects keyed by the header row.
function rowsToObjects(rows) {
  if (!rows.length) return [];
  const [header, ...body] = rows;
  return body
    .filter((r) => r.some((cell) => cell !== "" && cell !== undefined))
    .map((r) => {
      const obj = {};
      header.forEach((key, i) => {
        obj[key] = r[i] !== undefined ? r[i] : "";
      });
      return obj;
    });
}

function num(v) {
  if (v === "" || v === undefined || v === null) return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

const MONTH_LABELS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];

export async function getDashboardData() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error("Missing GOOGLE_SHEET_ID environment variable. See README.md for setup steps.");
  }

  const [centresRows, retainersRows, hoursRows] = await Promise.all([
    fetchRange(sheetId, "Centres!A:Z"),
    fetchRange(sheetId, "Retainers!A:Z"),
    fetchRange(sheetId, "HoursLogged!A:Z"),
  ]);

  const centresRaw = rowsToObjects(centresRows);
  const retainersRaw = rowsToObjects(retainersRows);
  const hoursRaw = rowsToObjects(hoursRows);

  const centres = centresRaw.map((r) => ({
    lead: r.Lead,
    centre: r.Client,
    monthlyBudget: num(r.MonthlyBudget),
    spend: num(r.Spend),
    overUnder: num(r.OverUnder),
    yearlyBudget: num(r.YearlyBudget),
    remainingYearly: num(r.RemainingYearly),
    cpl: num(r.CPL),
    formFills: num(r.FormFills),
    targetCpl: num(r.TargetCPL),
    targetFf: num(r.TargetFormFills),
    cplHistory: MONTH_LABELS.map((m) => num(r[`CPL_${m}`])),
    ffHistory: MONTH_LABELS.map((m) => num(r[`FF_${m}`])),
  }));

  const retainers = {};
  retainersRaw.forEach((r) => {
    retainers[r.Client] = {
      lead: r.Lead,
      type: r.Type,
      allocation: num(r.Allocation),
      bauAllocation: num(r.BAUAllocation),
      tacticalAllocation: num(r.TacticalAllocation),
      contact: r.Contact,
    };
  });

  const mockUsedHours = {};
  hoursRaw.forEach((r) => {
    mockUsedHours[r.Client] = {
      bau: num(r.BAUUsed) || 0,
      tactical: num(r.TacticalUsed) || 0,
    };
  });

  // Any client in Retainers that doesn't have a row in Centres is treated as a
  // non-media, hours-only client (e.g. CLEAN Linen Services, Sports Surfaces UK).
  const nonMediaClients = retainersRaw
    .filter((r) => !centresRaw.some((c) => c.Client === r.Client))
    .map((r) => r.Client);

  return { centres, retainers, mockUsedHours, nonMediaClients };
}
