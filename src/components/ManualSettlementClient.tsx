"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { Match, Market, MarketOption, Pick as UserPick, User } from "@prisma/client";
import type { MarketType } from "@/lib/markets";
import { useI18n } from "@/i18n/context";
import { getDateFnsLocale } from "@/i18n/dates";

type SettlementMatch = Match & {
  markets: (Market & {
    options: MarketOption[];
    picks: (UserPick & { user: Pick<User, "name" | "email"> })[];
  })[];
};

export function ManualSettlementClient({
  initialMatches,
}: {
  initialMatches: SettlementMatch[];
}) {
  const { t, locale, fmt, te } = useI18n();
  const dateLocale = getDateFnsLocale(locale);
  const [matches, setMatches] = useState(initialMatches);
  const [matchId, setMatchId] = useState(initialMatches[0]?.id ?? "");
  const [marketId, setMarketId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const selected = matches.find((m) => m.id === matchId);
  const unsettledMarkets = selected?.markets.filter((m) => !m.settledAt) ?? [];
  const activeMarketId = marketId || unsettledMarkets[0]?.id || "";
  const selectedMarket = unsettledMarkets.find((m) => m.id === activeMarketId);

  function showMsg(text: string, type: "success" | "error" = "success") {
    setMessage(text);
    setMessageType(type);
  }

  async function handleMarkOption(optionId: string, result: "WON" | "LOST" | "UNSETTLED") {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/market-options/${optionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settlementResult: result }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(te(data.error));

      setMatches((prev) =>
        prev.map((m) =>
          m.id !== matchId
            ? m
            : {
                ...m,
                markets: m.markets.map((mk) =>
                  mk.id !== selectedMarket?.id
                    ? mk
                    : {
                        ...mk,
                        options: mk.options.map((o) =>
                          o.id === optionId ? { ...o, settlementResult: result } : o
                        ),
                      }
                ),
              }
        )
      );
      showMsg(fmt(t.manualSettlement.optionMarked, { result: t.settlementResult[result] }));
    } catch (err) {
      showMsg(err instanceof Error ? err.message : t.common.failed, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSettleMarket() {
    if (!selectedMarket) return;
    if (!confirm(t.manualSettlement.settleConfirm)) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/market-settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: selectedMarket.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(te(data.error));
      showMsg(data.message);
      window.location.reload();
    } catch (err) {
      showMsg(err instanceof Error ? err.message : t.common.failed, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-400">
        {t.manualSettlement.notice}
      </div>

      {message && (
        <div className={`rounded-lg border p-3 text-sm ${
          messageType === "success"
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            : "bg-red-500/10 border-red-500/30 text-red-300"
        }`}>
          {message}
        </div>
      )}

      <div className="card grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">{t.manualSettlement.selectMatch}</label>
          <select className="input" value={matchId} onChange={(e) => { setMatchId(e.target.value); setMarketId(""); }}>
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.teamA} {t.matches.vs} {m.teamB} · {t.matchStatus[m.status]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t.manualSettlement.selectMarket}</label>
          <select
            className="input"
            value={activeMarketId}
            onChange={(e) => setMarketId(e.target.value)}
          >
            {unsettledMarkets.length === 0 ? (
              <option value="">{t.manualSettlement.noUnsettled}</option>
            ) : (
              unsettledMarkets.map((m) => (
                <option key={m.id} value={m.id}>
                  {t.markets[m.type as MarketType]} · {t.admin.manualSource} ({fmt(t.manualSettlement.picksCount, { count: m.picks?.length ?? 0 })})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {selectedMarket && (
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-white">
              {t.markets[selectedMarket.type as MarketType]}
            </h2>
            <button
              type="button"
              onClick={handleSettleMarket}
              disabled={loading}
              className="btn-primary text-sm"
            >
              {loading ? t.manualSettlement.settling : t.manualSettlement.settleMarket}
            </button>
          </div>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-left">
                  <th className="py-2 pr-4">{t.manualSettlement.option}</th>
                  <th className="py-2 pr-4">{t.pick.multiplier}</th>
                  <th className="py-2 pr-4">{t.manualSettlement.result}</th>
                  <th className="py-2">{t.manualMarkets.actions}</th>
                </tr>
              </thead>
              <tbody>
                {selectedMarket.options.map((opt) => (
                  <tr key={opt.id} className="border-t border-slate-800">
                    <td className="py-2 pr-4 text-white">{opt.label}</td>
                    <td className="py-2 pr-4 text-slate-400">x{opt.multiplier}</td>
                    <td className="py-2 pr-4">
                      <span className={`font-semibold ${
                        opt.settlementResult === "WON" ? "text-emerald-400" :
                        opt.settlementResult === "LOST" ? "text-red-400" : "text-amber-400"
                      }`}>
                        {t.settlementResult[opt.settlementResult]}
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => handleMarkOption(opt.id, "WON")} className="text-xs text-emerald-400 hover:underline">{t.settlementResult.WON}</button>
                        <button type="button" onClick={() => handleMarkOption(opt.id, "LOST")} className="text-xs text-red-400 hover:underline">{t.settlementResult.LOST}</button>
                        <button type="button" onClick={() => handleMarkOption(opt.id, "UNSETTLED")} className="text-xs text-slate-400 hover:underline">{t.manualSettlement.clear}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedMarket.picks && selectedMarket.picks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">{t.manualSettlement.pendingPicks}</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-left">
                    <th className="py-2 pr-4">{t.manualSettlement.user}</th>
                    <th className="py-2 pr-4">{t.manualSettlement.option}</th>
                    <th className="py-2 pr-4">{t.manualSettlement.risked}</th>
                    <th className="py-2">{t.admin.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedMarket.picks.map((pick) => (
                    <tr key={pick.id} className="border-t border-slate-800">
                      <td className="py-2 pr-4 text-white">{pick.user.name}</td>
                      <td className="py-2 pr-4 text-slate-300">
                        {selectedMarket.options.find((o) => o.id === pick.marketOptionId)?.label ?? t.common.na}
                      </td>
                      <td className="py-2 pr-4 text-slate-400">{pick.pointsRisked}</td>
                      <td className="py-2 text-amber-400">{t.pickStatus[pick.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedMarket.settledAt && (
            <p className="text-sm text-amber-400 mt-4">
              {fmt(t.manualSettlement.alreadySettled, {
                date: format(new Date(selectedMarket.settledAt), "PPp", { locale: dateLocale }),
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
