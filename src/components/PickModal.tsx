"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import type { Match, Market, MarketOption, Pick } from "@prisma/client";
import {
  PICK_TABS,
  TAB_LABELS,
  TAB_MARKET_TYPES,
  MARKET_TYPE_LABELS,
  type PickTab,
  type MarketType,
} from "@/lib/markets";

export type MatchWithMarkets = Match & {
  markets: (Market & { options: MarketOption[] })[];
  picks?: (Pick & { market?: Market | null; marketOption?: MarketOption | null })[];
};

type PickModalProps = {
  match: MatchWithMarkets;
  userPoints: number;
  userPicks: Pick[];
  onClose: () => void;
  onSuccess: () => void;
};

type OptionWithMarket = MarketOption & { market: Market };

const PRESET_AMOUNTS = [10, 25, 50, 100];

export function PickModal({ match, userPoints, userPicks, onClose, onSuccess }: PickModalProps) {
  const [activeTab, setActiveTab] = useState<PickTab>("winner");
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [amount, setAmount] = useState(25);
  const [customAmount, setCustomAmount] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const locked = match.status !== "UPCOMING" || new Date(match.startTime) <= new Date();
  const pointsRisked = useCustom ? parseInt(customAmount, 10) || 0 : amount;

  const tabMarkets = useMemo(() => {
    const map: Record<PickTab, (Market & { options: MarketOption[] })[]> = {
      winner: [],
      handicap: [],
      totals: [],
      firstHalf: [],
      correctScore: [],
      btts: [],
      corners: [],
      cards: [],
      live: [],
    };
    for (const tab of PICK_TABS) {
      const types = TAB_MARKET_TYPES[tab];
      map[tab] = match.markets
        .filter((m) => types.includes(m.type))
        .filter((m) => m.options.some((o) => o.status === "ACTIVE" || o.status === "SUSPENDED" || o.status === "CLOSED"));
    }
    return map;
  }, [match.markets]);

  const activeMarkets = tabMarkets[activeTab];
  const tabAvailable = activeMarkets.some((m) => m.options.some((o) => o.status === "ACTIVE"));

  const allOptionsWithMarket: OptionWithMarket[] = activeMarkets.flatMap((m) =>
    m.options.map((o) => ({ ...o, market: m }))
  );

  const selectedOption = allOptionsWithMarket.find((o) => o.id === selectedOptionId && o.status === "ACTIVE");
  const existingPickForMarket = selectedOption
    ? userPicks.find((p) => p.marketId === selectedOption.market.id)
    : null;

  const multiplier = selectedOption?.multiplier ?? 0;
  const potentialProfit = Math.round(pointsRisked * multiplier);
  const showManualHint = activeMarkets.some((m) => m.provider === "MANUAL" || m.bookmaker === "Manual");
  const needsManualSettlement = activeTab === "firstHalf" || activeTab === "correctScore" || activeTab === "btts" || activeTab === "corners" || activeTab === "cards" || activeTab === "live";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOptionId) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketOptionId: selectedOptionId, pointsRisked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save pick");
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Make Your Pick</h2>
            <p className="text-slate-400 text-sm">
              {match.teamA} vs {match.teamB} · {format(new Date(match.startTime), "EEE, MMM d · h:mm a")}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">
            ×
          </button>
        </div>

        {locked ? (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4 text-amber-300">
            This match has started. Picks are locked.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex flex-wrap gap-1 border-b border-slate-800 pb-2">
              {PICK_TABS.map((tab) => {
                const hasOptions = tabMarkets[tab].length > 0;
                const hasActive = tabMarkets[tab].some((m) => m.options.some((o) => o.status === "ACTIVE"));
                return (
                  <button
                    key={tab}
                    type="button"
                    disabled={!hasOptions}
                    onClick={() => {
                      setActiveTab(tab);
                      setSelectedOptionId(null);
                    }}
                    className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                      activeTab === tab
                        ? "bg-emerald-600 text-white"
                        : hasActive
                          ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                          : hasOptions
                            ? "bg-slate-900 text-slate-500"
                            : "bg-slate-900 text-slate-600 cursor-not-allowed"
                    }`}
                  >
                    {TAB_LABELS[tab]}
                    {!hasOptions && <span className="block text-[10px] font-normal">N/A</span>}
                  </button>
                );
              })}
            </div>

            {!tabAvailable ? (
              <p className="text-sm text-slate-400 py-4 text-center">
                No active options for this market.
              </p>
            ) : (
              <>
                {showManualHint && (
                  <p className="text-xs text-slate-500">Manual source</p>
                )}

                {activeTab === "firstHalf" || activeTab === "corners" || activeTab === "live" ? (
                  <div className="space-y-4">
                    {activeMarkets.map((market) => (
                      <div key={market.id}>
                        <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                          {MARKET_TYPE_LABELS[market.type as MarketType]}
                          {(market.provider === "MANUAL" || market.bookmaker === "Manual") && (
                            <span className="ml-2 normal-case text-slate-600">· Manual</span>
                          )}
                        </p>
                        <OptionGrid
                          options={market.options.map((o) => ({ ...o, market }))}
                          selectedId={selectedOptionId}
                          onSelect={setSelectedOptionId}
                        />
                      </div>
                    ))}
                  </div>
                ) : activeTab === "correctScore" ? (
                  <OptionGrid
                    options={allOptionsWithMarket}
                    selectedId={selectedOptionId}
                    onSelect={setSelectedOptionId}
                    compact
                  />
                ) : (
                  <OptionGrid
                    options={allOptionsWithMarket}
                    selectedId={selectedOptionId}
                    onSelect={setSelectedOptionId}
                  />
                )}

                {needsManualSettlement && (
                  <p className="text-xs text-amber-400/80">
                    Advanced markets may require admin settlement.
                  </p>
                )}

                <div>
                  <p className="text-sm text-slate-400 mb-2">Points to risk</p>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {PRESET_AMOUNTS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        disabled={preset > userPoints}
                        onClick={() => {
                          setUseCustom(false);
                          setAmount(preset);
                        }}
                        className={`amount-btn ${!useCustom && amount === preset ? "amount-btn-active" : ""} ${preset > userPoints ? "opacity-40" : ""}`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseCustom(true)}
                    className={`amount-btn w-full ${useCustom ? "amount-btn-active" : ""}`}
                  >
                    Custom
                  </button>
                  {useCustom && (
                    <input
                      type="number"
                      min={1}
                      max={userPoints}
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder={`Max ${userPoints}`}
                      className="input mt-2"
                    />
                  )}
                </div>

                {selectedOption && (
                  <div className="rounded-lg bg-slate-800/50 p-3 text-sm">
                    <div className="flex justify-between text-slate-400">
                      <span>Multiplier</span>
                      <span className="text-white">x{multiplier}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 mt-1">
                      <span>Potential profit</span>
                      <span className="text-emerald-400 font-semibold">+{potentialProfit}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 mt-1">
                      <span>Your balance</span>
                      <span className="text-white">{userPoints.toLocaleString()} pts</span>
                    </div>
                  </div>
                )}

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={
                    loading ||
                    !selectedOptionId ||
                    pointsRisked < 1 ||
                    pointsRisked > userPoints
                  }
                  className="btn-primary w-full"
                >
                  {loading ? "Saving..." : existingPickForMarket ? "Update Pick" : "Confirm Pick"}
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

function OptionGrid({
  options,
  selectedId,
  onSelect,
  compact = false,
}: {
  options: OptionWithMarket[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
      {options.map((option) => {
        const isActive = option.status === "ACTIVE";
        const isSelected = selectedId === option.id && isActive;
        const statusLabel =
          option.status === "SUSPENDED" ? "Suspended" :
          option.status === "CLOSED" ? "Closed" : null;

        return (
          <button
            key={option.id}
            type="button"
            disabled={!isActive}
            onClick={() => isActive && onSelect(option.id)}
            className={`flex flex-col items-center justify-center rounded-xl border p-3 min-h-[72px] transition ${
              isSelected
                ? "border-emerald-500 bg-emerald-500/20 text-white"
                : isActive
                  ? "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-500"
                  : "border-slate-800 bg-slate-900/50 text-slate-600 cursor-not-allowed opacity-60"
            }`}
          >
            <span className="font-semibold text-sm text-center leading-tight">{option.label}</span>
            <span className="text-xs text-slate-400 mt-1">x{option.multiplier}</span>
            {statusLabel && (
              <span className="text-[10px] text-amber-500/80 mt-1">{statusLabel}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
