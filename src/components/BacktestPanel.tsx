// src/components/BacktestPanel.tsx
import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import HelpTip from "./HelpTip";

type Props = {
  apiBase: string;
  symbol: string;
  tf: "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
  fastDefault?: number;
  slowDefault?: number;
};

type CurvePoint = { t: number; equity: number };

export default function BacktestPanel({
  apiBase,
  symbol,
  tf,
  fastDefault = 12,
  slowDefault = 26,
}: Props) {
  const [sym, setSym] = useState(symbol || "EURUSD");
  const [timeframe, setTimeframe] = useState(tf || "1m");
  const [fast, setFast] = useState<number>(fastDefault);
  const [slow, setSlow] = useState<number>(slowDefault);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [curve, setCurve] = useState<CurvePoint[]>([]);
  const [stats, setStats] = useState<{ ret?: number; trades?: number } | null>(
    null
  );

  const run = async () => {
    setLoading(true);
    setErr(null);
    setCurve([]);
    setStats(null);
    try {
      const url = `${apiBase}/api/backtest/ema?symbol=${encodeURIComponent(
        sym
      )}&tf=${encodeURIComponent(timeframe)}&fast=${fast}&slow=${slow}`;
      const res = await fetch(url, { cache: "no-store" });
      const j = await res.json();

      if (!res.ok || j.error) {
        throw new Error(j.error || "Backtest failed");
      }

      // Expected shape: { curve: [{t,equity}], stats:{ret,trades} }
      const c: CurvePoint[] = Array.isArray(j.curve) ? j.curve : [];
      setCurve(
        c.map((p) => ({
          t: typeof p.t === "number" ? p.t : Date.now(),
          equity: Number(p.equity ?? 0),
        }))
      );
      setStats(j.stats || null);
    } catch (e: any) {
      setErr(e?.message || "Backtest failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel">
      <div
        className="panelHeader"
        style={{ display: "flex", alignItems: "center", gap: 6 }}
      >
        Backtest — EMA Crossover
        <HelpTip
          title="Backtest"
          body="Runs a simple EMA-crossover strategy: BUY when the fast EMA crosses above the slow EMA, SELL when it crosses below. This preview assumes 1 unit, no fees/slippage/overnight. Upgrade for risk sizing, commissions, filters, and walk-forward testing."
        />
      </div>

      <div className="panelBody">
        <div className="controls" style={{ gap: 8 }}>
          <div className="controls-row" style={{ alignItems: "center" }}>
            <label className="label">Symbol</label>
            <input
              className="input"
              value={sym}
              onChange={(e) => setSym(e.target.value.toUpperCase())}
              style={{ maxWidth: 160 }}
            />

            <label className="label" style={{ display: "inline-flex", gap: 6 }}>
              TF
              <HelpTip
                title="Timeframe"
                body="Candle compression used for both indicator calculations and trade signals."
              />
            </label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as any)}
              style={{ maxWidth: 120 }}
            >
              {["1m", "5m", "15m", "1h", "4h", "1d"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="controls-row" style={{ alignItems: "center" }}>
            <label className="label" style={{ display: "inline-flex", gap: 6 }}>
              Fast
              <HelpTip
                title="Fast EMA"
                body="Short-term EMA period. Smaller = more sensitive signals."
              />
            </label>
            <input
              className="num"
              type="number"
              value={fast}
              onChange={(e) => setFast(parseInt(e.target.value || "0") || 0)}
              style={{ width: 70 }}
            />

            <label className="label" style={{ display: "inline-flex", gap: 6 }}>
              Slow
              <HelpTip
                title="Slow EMA"
                body="Long-term EMA period. Larger = smoother, fewer signals."
              />
            </label>
            <input
              className="num"
              type="number"
              value={slow}
              onChange={(e) => setSlow(parseInt(e.target.value || "0") || 0)}
              style={{ width: 70 }}
            />

            <button
              className="gb-btn gb-solid"
              onClick={run}
              disabled={loading}
              style={{ marginLeft: 6 }}
            >
              {loading ? "Running…" : "Run"}
            </button>
          </div>
        </div>

        {err ? (
          <div style={{ color: "#ff6b6b", marginTop: 6 }}>{err}</div>
        ) : null}

        <div style={{ height: 220, marginTop: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curve} margin={{ top: 10, right: 12, left: 0, bottom: 6 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="t"
                tickFormatter={(t) =>
                  new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
                }
                tick={{ fontSize: 11, fill: "rgba(231,231,231,.8)" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "rgba(231,231,231,.8)" }}
                domain={["auto", "auto"]}
              />
              <Tooltip
                formatter={(v: any) => [Number(v).toFixed(2), "Equity"]}
                labelFormatter={(ts) => new Date(ts as number).toLocaleString()}
                contentStyle={{
                  background: "#0f141b",
                  border: "1px solid rgba(212,175,55,.25)",
                  borderRadius: 8,
                }}
              />
              <Line
                type="monotone"
                dataKey="equity"
                dot={false}
                stroke="#ffd700"
                strokeWidth={1.8}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ opacity: 0.8, fontSize: 12, marginTop: 6 }}>
          {stats ? (
            <>
              Return: <b>{(stats.ret ?? 0).toFixed(2)}%</b> · Trades:{" "}
              <b>{stats.trades ?? 0}</b>
            </>
          ) : (
            "Note: this preview uses a simple 1-unit position, no fees/slippage/overnight."
          )}
        </div>
      </div>
    </div>
  );
}
