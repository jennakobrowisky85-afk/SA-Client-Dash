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

const MONTH_ORDER = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
const MONTH_FULL = { Mar:"March", Apr:"April", May:"May", Jun:"June", Jul:"July", Aug:"August", Sep:"September", Oct:"October", Nov:"November", Dec:"December", Jan:"January", Feb:"February" };

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

  // "Centres" is now long-format: one row per (Month, Client), not one row per client.
  const centresLongRaw = rowsToObjects(centresRows);
  const retainersRaw = rowsToObjects(retainersRows);
  const hoursRaw = rowsToObjects(hoursRows);

  // Group into byClient[client][month] = { ...that month's numbers }
  const byClient = {};
  centresLongRaw.forEach((r) => {
    if (!byClient[r.Client]) byClient[r.Client] = {};
    byClient[r.Client][r.Month] = {
      lead: r.Lead,
      monthlyBudget: num(r.MonthlyBudget),
      spend: num(r.Spend),
      overUnder: num(r.OverUnder),
      yearlyBudget: num(r.YearlyBudget),
      remainingYearly: num(r.RemainingYearly),
      cpl: num(r.CPL),
      formFills: num(r.FormFills),
    };
  });

  const clientNames = Object.keys(byClient);
  // Only months that actually appear in the sheet, in chronological order.
  const monthsAvailable = MONTH_ORDER.filter((m) => centresLongRaw.some((r) => r.Month === m));
  const monthLabels = Object.fromEntries(monthsAvailable.map((m) => [m, MONTH_FULL[m] || m]));

  // Full CPL/Form-Fills history per client, aligned to monthsAvailable — always shows the
  // whole trend in sparklines regardless of which month is selected in the dropdown.
  const historyByClient = {};
  clientNames.forEach((client) => {
    historyByClient[client] = {
      cplHistory: monthsAvailable.map((m) => byClient[client][m]?.cpl ?? null),
      ffHistory: monthsAvailable.map((m) => byClient[client][m]?.formFills ?? null),
    };
  });

  // For each month, build that month's row per client, with a KPI target computed
  // dynamically as the average of CPL/Form Fills across whichever months come BEFORE it
  // in the sheet — so the target always excludes the month being measured against it.
  const centresByMonth = {};
  monthsAvailable.forEach((month, idx) => {
    const priorMonths = monthsAvailable.slice(0, idx);
    centresByMonth[month] = clientNames
      .filter((client) => byClient[client][month])
      .map((client) => {
        const rec = byClient[client][month];
        const priorCpl = priorMonths.map((pm) => byClient[client][pm]?.cpl).filter((v) => v != null);
        const priorFf = priorMonths.map((pm) => byClient[client][pm]?.formFills).filter((v) => v != null);
        const targetCpl = priorCpl.length ? Math.round((priorCpl.reduce((a, b) => a + b, 0) / priorCpl.length) * 100) / 100 : null;
        const targetFf = priorFf.length ? Math.round((priorFf.reduce((a, b) => a + b, 0) / priorFf.length) * 100) / 100 : null;
        return {
          lead: rec.lead,
          centre: client,
          monthlyBudget: rec.monthlyBudget,
          spend: rec.spend,
          overUnder: rec.overUnder,
          yearlyBudget: rec.yearlyBudget,
          remainingYearly: rec.remainingYearly,
          cpl: rec.cpl,
          formFills: rec.formFills,
          targetCpl,
          targetFf,
          cplHistory: historyByClient[client].cplHistory,
          ffHistory: historyByClient[client].ffHistory,
        };
      });
  });

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

  // HoursLogged is now long-format too: one row per (Month, Client), the hours logged
  // IN that specific month. What counts as "used" against the allocation depends on
  // the retainer type:
  //  - "monthly" retainers reset every month, so "used" = that single month's hours.
  //  - "annual" retainers pool across the fiscal year, so "used" = the running total
  //    from the earliest tracked month through the one being viewed.
  const hoursRawByClientMonth = {};
  hoursRaw.forEach((r) => {
    if (!hoursRawByClientMonth[r.Client]) hoursRawByClientMonth[r.Client] = {};
    hoursRawByClientMonth[r.Client][r.Month] = {
      bau: num(r.BAUUsed) || 0,
      tactical: num(r.TacticalUsed) || 0,
    };
  });
  const hoursClients = Object.keys(hoursRawByClientMonth);
  const hoursMonthsAvailable = MONTH_ORDER.filter((m) => hoursRaw.some((r) => r.Month === m));

  const mockUsedHoursByMonth = {};
  hoursMonthsAvailable.forEach((month, idx) => {
    mockUsedHoursByMonth[month] = {};
    hoursClients.forEach((client) => {
      const isAnnual = retainers[client]?.type === "annual";
      if (isAnnual) {
        const monthsToDate = hoursMonthsAvailable.slice(0, idx + 1);
        let bau = 0, tactical = 0;
        monthsToDate.forEach((m) => {
          const rec = hoursRawByClientMonth[client][m];
          if (rec) { bau += rec.bau; tactical += rec.tactical; }
        });
        mockUsedHoursByMonth[month][client] = {
          bau: Math.round(bau * 10) / 10,
          tactical: Math.round(tactical * 10) / 10,
        };
      } else {
        mockUsedHoursByMonth[month][client] = hoursRawByClientMonth[client][month] || { bau: 0, tactical: 0 };
      }
    });
  });

  // Any client in Retainers that doesn't have a row in Centres is treated as a
  // non-media, hours-only client (e.g. CLEAN Linen Services, Sports Surfaces UK).
  const nonMediaClients = retainersRaw
    .filter((r) => !clientNames.includes(r.Client))
    .map((r) => r.Client);

  return { monthsAvailable, monthLabels, centresByMonth, retainers, mockUsedHoursByMonth, nonMediaClients };
}
