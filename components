"use client";

import React, { useMemo, useState } from "react";
import { Search, ArrowUp, ArrowDown, Minus, AlertTriangle, Clock } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

// ---------------------------------------------------------------------------
// Data (centresByMonth, retainers, mockUsedHoursByMonth, nonMediaClients) now arrives as
// props from app/page.js, which fetches it server-side from the Google Sheet
// via lib/googleSheets.js. Nothing below is hardcoded anymore.
// ---------------------------------------------------------------------------

// Fiscal year runs April to March (UK tax year). "Today" is mid-September, ~5.5 months elapsed.
const fiscalYearElapsedFraction = 5.5 / 12;

function fmtNum(n, decimals = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(decimals);
}

function fmtGBP(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}£${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function Sparkline({ data, color }) {
  const points = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ width: 56, height: 24 }} className="flex-shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Trend({ current, baseline, invert }) {
  const diff = current - baseline;
  const pct = baseline ? (diff / baseline) * 100 : 0;
  const isFlat = Math.abs(pct) < 3;
  const isUp = pct > 0;
  const good = invert ? !isUp : isUp;
  const color = isFlat ? "#8A8578" : good ? "#2F6B4F" : "#B5482A";
  const Icon = isFlat ? Minus : isUp ? ArrowUp : ArrowDown;
  return (
    <span style={{ color }} className="inline-flex items-center gap-0.5 text-xs font-medium">
      <Icon size={12} strokeWidth={2.5} />
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function HoursBar({ hasRetainerData, usedObj, allocation, bauAllocation, tacticalAllocation, type }) {
  if (!hasRetainerData) {
    return <span className="text-xs text-[#B0AA98] italic">Not in handover file</span>;
  }
  if (!allocation) {
    return <span className="text-xs text-[#8A8578] italic">Not yet agreed</span>;
  }
  const used = usedObj.bau + usedObj.tactical;
  const pct = Math.min((used / allocation) * 100, 130);
  const expectedPct = type === "annual" ? fiscalYearElapsedFraction * 100 : null;
  const overExpected = expectedPct !== null && pct - expectedPct > 15;
  const barColor = pct > 100 ? "#B5482A" : overExpected ? "#C9822B" : "#2F6B4F";
  return (
    <div className="w-36">
      <div className="flex justify-between text-[11px] text-[#5B5648] mb-1">
        <span>{used}h / {allocation}h</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#EAE6DA] overflow-hidden relative">
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
        {expectedPct !== null && (
          <div className="absolute top-0 bottom-0 w-px bg-[#3D5A73]" style={{ left: `${Math.min(expectedPct, 100)}%` }} title="Expected pace (Apr–Mar year)" />
        )}
      </div>
      <div className="text-[10px] text-[#8A8578] mt-1">
        BAU {usedObj.bau}h{bauAllocation ? `/${bauAllocation}h` : ""} · Tactical {usedObj.tactical}h{tacticalAllocation ? `/${tacticalAllocation}h` : ""}
      </div>
    </div>
  );
}

export default function ClientOpsDashboard({ monthsAvailable, monthLabels, centresByMonth, retainers, mockUsedHoursByMonth, nonMediaClients }) {
  const [query, setQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(monthsAvailable[monthsAvailable.length - 1]);

  const rows = useMemo(() => {
    const centres = centresByMonth[selectedMonth] || [];
    const centreRows = centres.map((c) => ({
      client: c.centre,
      lead: c.lead,
      hasMedia: true,
      ...c,
      retainer: retainers[c.centre] || null,
    }));
    const otherRows = nonMediaClients.map((name) => ({
      client: name,
      lead: retainers[name]?.lead || "Miya",
      hasMedia: false,
      retainer: retainers[name],
    }));
    return [...centreRows, ...otherRows];
  }, [selectedMonth, centresByMonth, retainers, nonMediaClients]);

  const filtered = rows.filter((r) => r.client.toLowerCase().includes(query.toLowerCase()));

  const overBudgetCount = rows.filter((r) => r.hasMedia && r.overUnder < 0).length;
  const cplWorseCount = rows.filter((r) => r.hasMedia && r.targetCpl != null && r.cpl != null && r.cpl > r.targetCpl * 1.1).length;
  const hoursAtRiskCount = rows.filter((r) => {
    const alloc = r.retainer?.allocation;
    const usedObj = mockUsedHoursByMonth[selectedMonth]?.[r.client];
    if (!alloc || !usedObj) return false;
    const used = usedObj.bau + usedObj.tactical;
    const pct = used / alloc;
    if (r.retainer.type === "monthly") return pct > 1;
    return pct - fiscalYearElapsedFraction > 0.15 || pct > 1;
  }).length;

  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#242019]" style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      <div className="max-w-[1400px] mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6 pb-6 border-b border-[#E4DFD1]">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Client Ops Dashboard</h1>
            <p className="text-sm text-[#5B5648] mt-1">Media spend pacing, KPI tracking and retainer hours — one screen, no Teamwork tab-switching. Showing <span className="font-medium text-[#242019]">{monthLabels[selectedMonth] || selectedMonth} 2026</span>.</p>
          </div>
          <div className="flex items-center gap-2 bg-[#FFF4E4] border border-[#EAD3A8] text-[#8A5A1E] text-xs font-medium px-3 py-2 rounded">
            <Clock size={14} />
            Hours module uses placeholder data — Teamwork API not yet connected
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div>
            <div className="text-3xl font-semibold tabular-nums">{rows.length}</div>
            <div className="text-xs text-[#5B5648] mt-1">Clients tracked</div>
          </div>
          <div>
            <div className="text-3xl font-semibold tabular-nums" style={{ color: overBudgetCount ? "#B5482A" : "#242019" }}>{overBudgetCount}</div>
            <div className="text-xs text-[#5B5648] mt-1">Over media budget this month</div>
          </div>
          <div>
            <div className="text-3xl font-semibold tabular-nums" style={{ color: cplWorseCount ? "#B5482A" : "#242019" }}>{cplWorseCount}</div>
            <div className="text-xs text-[#5B5648] mt-1">CPL worse than KPI target</div>
          </div>
          <div>
            <div className="text-3xl font-semibold tabular-nums" style={{ color: hoursAtRiskCount ? "#C9822B" : "#242019" }}>{hoursAtRiskCount}</div>
            <div className="text-xs text-[#5B5648] mt-1">Hours pacing at risk (mock)</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-sm font-medium px-3 py-2 rounded border border-[#E4DFD1] bg-white"
          >
            {monthsAvailable.map((m) => (
              <option key={m} value={m}>{monthLabels[m] || m} 2026</option>
            ))}
          </select>
          <div className="flex items-center gap-2 bg-white border border-[#E4DFD1] rounded px-3 py-2 w-64">
            <Search size={14} className="text-[#8A8578]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search client or centre..."
              className="text-sm outline-none w-full bg-transparent placeholder:text-[#B0AA98]"
            />
          </div>
        </div>

        {/* Table */}
        <div className="border border-[#E4DFD1] rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F3EFE4] text-left text-[11px] uppercase tracking-wide text-[#8A8578]">
                <th className="px-4 py-3 font-medium">Client / Centre</th>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Retainer hours (mock)</th>
                <th className="px-4 py-3 font-medium">Monthly budget</th>
                <th className="px-4 py-3 font-medium">Spend this month</th>
                <th className="px-4 py-3 font-medium">Over / under</th>
                <th className="px-4 py-3 font-medium">CPL (6-mo trend)</th>
                <th className="px-4 py-3 font-medium">Form fills (6-mo trend)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.client} className="border-t border-[#EFEBDE] hover:bg-[#FBFAF6]">
                  <td className="px-4 py-3 font-medium">{r.client}</td>
                  <td className="px-4 py-3 text-[#5B5648]">{r.lead}</td>
                  <td className="px-4 py-3">
                    <HoursBar
                      hasRetainerData={!!r.retainer}
                      usedObj={mockUsedHoursByMonth[selectedMonth]?.[r.client] || { bau: 0, tactical: 0 }}
                      allocation={r.retainer?.allocation}
                      bauAllocation={r.retainer?.bauAllocation}
                      tacticalAllocation={r.retainer?.tacticalAllocation}
                      type={r.retainer?.type}
                    />
                  </td>
                  {r.hasMedia ? (
                    <>
                      <td className="px-4 py-3 tabular-nums">{fmtGBP(r.monthlyBudget)}</td>
                      <td className="px-4 py-3 tabular-nums">{fmtGBP(r.spend)}</td>
                      <td className="px-4 py-3 tabular-nums font-medium" style={{ color: r.overUnder < 0 ? "#B5482A" : "#2F6B4F" }}>
                        {r.overUnder < 0 ? "-" : "+"}{fmtGBP(Math.abs(r.overUnder))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Sparkline data={r.cplHistory} color={r.cpl > r.targetCpl * 1.1 ? "#B5482A" : "#2F6B4F"} />
                          <div>
                            <div className="tabular-nums font-medium flex items-center gap-1.5">
                              £{fmtNum(r.cpl)} <Trend current={r.cpl} baseline={r.targetCpl} invert />
                            </div>
                            <div className="text-[10px] text-[#8A8578]">Target £{fmtNum(r.targetCpl)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Sparkline data={r.ffHistory} color={r.formFills < r.targetFf * 0.9 ? "#B5482A" : "#2F6B4F"} />
                          <div>
                            <div className="tabular-nums font-medium flex items-center gap-1.5">
                              {r.formFills} <Trend current={r.formFills} baseline={r.targetFf} />
                            </div>
                            <div className="text-[10px] text-[#8A8578]">Target {fmtNum(r.targetFf)}</div>
                          </div>
                        </div>
                      </td>
                    </>
                  ) : (
                    <td className="px-4 py-3 text-xs text-[#8A8578] italic" colSpan={5}>
                      No media spend tracked in this workbook — likely reported elsewhere
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer notes */}
        <div className="mt-6 flex items-start gap-2 text-xs text-[#8A8578] max-w-3xl">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <p>
            Media spend and KPI figures are real, pulled from the OI Master Report, scoped to Miya's former book. Use the month dropdown above to browse any month the sheet has data for.
            KPI targets are the average of CPL/Form Fills across every month <em>before</em> the one you're viewing (e.g. viewing August compares it against the Mar–Jul average) — so a target never includes the month it's measuring, and it automatically extends as more months are added to the sheet. Earlier months have fewer prior months to average, so their targets are less reliable — clients missing entirely from early months (like Workington) simply don't show a target until enough history exists.
            Retainer hour totals are real (from the account handover doc); BAU/Tactical <em>sub-allocations</em> are only contractually defined for CLEAN and Sports Surfaces UK — for the Oi centres, Teamwork will still log BAU vs Tactical time, but there's no separate target to pace against, only the total.
            Hours <em>used</em> are placeholder values standing in for the Teamwork API — but they're now month-aware: monthly retainers (CLEAN, Sports Surfaces UK) show that single month's hours, while annual retainers show the running total from the earliest tracked month through the one selected. Annual retainer pacing assumes an April–March UK tax year, per your confirmation.
          </p>
        </div>
      </div>
    </div>
  );
}
