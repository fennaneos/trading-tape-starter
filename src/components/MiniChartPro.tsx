// src/components/MiniChartPro.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

/* ---------- types & helpers ---------- */
type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };
type ChartMode = 'candles' | 'line' | 'both';

function ema(values: number[], period: number) {
  if (!values.length || period <= 1) return values.slice();
  const k = 2 / (period + 1);
  const out = new Array(values.length);
  out[0] = values[0];
  for (let i = 1; i < values.length; i++) out[i] = values[i] * k + out[i - 1] * (1 - k);
  return out;
}
function sma(values: number[], period: number) {
  const out = new Array(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}
function stddev(values: number[], period: number) {
  const out = new Array(values.length).fill(NaN);
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue;
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const v = Math.sqrt(slice.reduce((s, x) => s + (x - mean) ** 2, 0) / period);
    out[i] = v;
  }
  return out;
}
function bollinger(values: number[], period: number, k: number) {
  const m = sma(values, period);
  const sd = stddev(values, period);
  const upper = m.map((mv, i) => (isNaN(mv) || isNaN(sd[i]) ? NaN : mv + k * sd[i]));
  const lower = m.map((mv, i) => (isNaN(mv) || isNaN(sd[i]) ? NaN : mv - k * sd[i]));
  return { middle: m, upper, lower };
}
function rsi(values: number[], period = 14) {
  if (!values.length) return [];
  const out = new Array(values.length).fill(NaN);
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = values[i] - values[i - 1];
    if (ch >= 0) gain += ch; else loss -= ch;
  }
  let avgG = gain / period;
  let avgL = loss / period;
  out[period] = 100 - 100 / (1 + (avgG / (avgL || 1e-9)));
  for (let i = period + 1; i < values.length; i++) {
    const ch = values[i] - values[i - 1];
    const g = Math.max(0, ch);
    const l = Math.max(0, -ch);
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
    out[i] = 100 - 100 / (1 + (avgG / (avgL || 1e-9)));
  }
  return out;
}
function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const macdLine = ema(values, fast).map((v, i) => v - ema(values, slow)[i]);
  const signalLine = ema(macdLine, signal);
  const hist = macdLine.map((v, i) => v - signalLine[i]);
  return { macdLine, signalLine, hist };
}
function mockCandles(n = 240): Candle[] {
  const arr: Candle[] = [];
  let p = 1.1;
  for (let i = 0; i < n; i++) {
    const t = (Date.now() - (n - i) * 60000) / 1000;
    const drift = (Math.sin(i / 18) + Math.cos(i / 33)) * 0.002;
    const vol = 0.0035;
    const prev = p;
    p = Math.max(0.4, prev + drift + (Math.random() - 0.5) * vol);
    const o = prev;
    const c = p;
    const h = Math.max(o, c) + Math.random() * 0.002;
    const l = Math.min(o, c) - Math.random() * 0.002;
    const v = 50 + Math.random() * 200;
    arr.push({ t, o, h, l, c, v });
  }
  return arr;
}
function formatTime(tsSec: number) {
  const d = new Date(tsSec * 1000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/* ---------- component ---------- */
export default function MiniChartPro({
  symbol,
  tf = '1m',
  width = 760,
  height = 440,
  mode = 'both',
  showVolume = true,
  emaFast = 12,
  emaSlow = 26,
  rsiPane = false,
  rsiPeriod = 14,
  macdPane = false,
  showBB = false,
  bbPeriod = 20,
  bbK = 2,
  crosshair = true,
  annotations = [],
  signals = [],
}: {
  symbol: string;
  tf?: string;
  width?: number;
  height?: number;
  mode?: ChartMode;
  showVolume?: boolean;
  emaFast?: number;
  emaSlow?: number;
  rsiPane?: boolean;
  rsiPeriod?: number;
  macdPane?: boolean;
  showBB?: boolean;
  bbPeriod?: number;
  bbK?: number;
  crosshair?: boolean;
  annotations?: { level: number; type: 'support' | 'resistance' }[];
  signals?: any[];
}) {
  const [data, setData] = useState<Candle[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: width, h: height });

  const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:4000';

  // fetch candles
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/candles?symbol=${encodeURIComponent(symbol)}&tf=${tf}&limit=240`,
          { cache: 'no-store' }
        );
        if (res.ok) {
          const j = await res.json();
          if (alive) setData(j);
        } else {
          if (alive) setData(mockCandles(240));
        }
      } catch {
        if (alive) setData(mockCandles(240));
      }
    })();
    return () => { alive = false; };
  }, [symbol, tf, API_BASE]);

  // resize observer
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerSize({ w: el.clientWidth || width, h: el.clientHeight || height });
    });
    ro.observe(el);
    setContainerSize({ w: el.clientWidth || width, h: el.clientHeight || height });
    return () => ro.disconnect();
  }, [width, height]);

  // precompute metrics & indicators
  const metrics = useMemo(() => {
    const closes = data.map(d => d.c);
    const highs = data.map(d => d.h);
    const lows = data.map(d => d.l);
    const max = highs.length ? Math.max(...highs) : 1;
    const min = lows.length ? Math.min(...lows) : 0;
    const volMax = data.length ? Math.max(...data.map(d => d.v)) : 1;

    const emaF = ema(closes, Math.max(2, emaFast | 0));
    const emaS = ema(closes, Math.max(2, emaSlow | 0));

    const bb = showBB ? bollinger(closes, Math.max(2, bbPeriod | 0), bbK) : null;
    const rsiArr = rsiPane ? rsi(closes, Math.max(2, rsiPeriod | 0)) : null;
    const macdObj = macdPane ? macd(closes, 12, 26, 9) : null;

    return { closes, max, min, volMax, emaF, emaS, bb, rsiArr, macdObj };
  }, [data, emaFast, emaSlow, showBB, bbPeriod, bbK, rsiPane, rsiPeriod, macdPane]);

  // main draw on base canvas
  useEffect(() => {
    const base = baseRef.current;
    const wrap = wrapRef.current;
    if (!base || !wrap) return;

    const w = (base.width = (containerSize.w || width));
    const h = (base.height = (containerSize.h || height));

    const ctx = base.getContext('2d')!;
    ctx.fillStyle = '#0d1218';
    ctx.fillRect(0, 0, w, h);

    if (!data.length) return;

    // layout
    const extraPaneCount = (rsiPane ? 1 : 0) + (macdPane ? 1 : 0);
    const paneH = 88; // each indicator pane height
    const extraH = extraPaneCount * (paneH + 10);
    const pad = { l: 48, r: 12, t: 10, b: (showVolume ? 90 : 40) + extraH };

    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;

    const { closes, max, min, volMax, emaF, emaS, bb, rsiArr, macdObj } = metrics;

    const xAt = (i: number) => pad.l + (i * plotW) / Math.max(1, data.length - 1);
    const yAt = (px: number) => pad.t + ((max - px) * plotH) / (max - min + 1e-9);

    // grid
    ctx.strokeStyle = 'rgba(255,255,255,.06)';
    ctx.lineWidth = 1;
    for (let g = 0; g <= 5; g++) {
      const yy = pad.t + (plotH / 5) * g;
      ctx.beginPath();
      ctx.moveTo(pad.l, yy);
      ctx.lineTo(w - pad.r, yy);
      ctx.stroke();
    }

    // Bollinger fill first (under price)
    if (bb) {
      ctx.fillStyle = 'rgba(255, 215, 0, .07)';
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < data.length; i++) {
        const u = bb.upper[i];
        if (isNaN(u)) continue;
        const x = xAt(i), y = yAt(u);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      // lower back
      for (let i = data.length - 1; i >= 0; i--) {
        const l = bb.lower[i];
        if (isNaN(l)) continue;
        const x = xAt(i), y = yAt(l);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }

    // candles
    if (mode !== 'line') {
      const cw = Math.max(1, (plotW / data.length) * 0.7);
      data.forEach((d, i) => {
        const x = xAt(i);
        const yO = yAt(d.o), yC = yAt(d.c), yH = yAt(d.h), yL = yAt(d.l);
        const up = d.c >= d.o;
        ctx.strokeStyle = up ? '#2ecc71' : '#e74c3c';
        ctx.fillStyle = up ? 'rgba(46,204,113,.8)' : 'rgba(231,76,60,.8)';
        // wick
        ctx.beginPath();
        ctx.moveTo(x, yH); ctx.lineTo(x, yL); ctx.stroke();
        // body
        const bx = x - cw / 2;
        const by = Math.min(yO, yC);
        const bh = Math.max(2, Math.abs(yC - yO));
        ctx.fillRect(bx, by, cw, bh);
      });
    }

    // line (close)
    if (mode !== 'candles') {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      closes.forEach((c, i) => {
        const x = xAt(i), y = yAt(c);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // EMAs
    ctx.strokeStyle = '#4dc9ff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    emaF.forEach((c, i) => {
      const x = xAt(i), y = yAt(c);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.strokeStyle = '#ffa14d';
    ctx.beginPath();
    emaS.forEach((c, i) => {
      const x = xAt(i), y = yAt(c);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // BB lines
    if (bb) {
      ctx.strokeStyle = 'rgba(255,215,0,.65)';
      ctx.lineWidth = 1;
      // upper
      ctx.beginPath();
      bb.upper.forEach((v, i) => {
        if (isNaN(v)) return;
        const x = xAt(i), y = yAt(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      // lower
      ctx.beginPath();
      bb.lower.forEach((v, i) => {
        if (isNaN(v)) return;
        const x = xAt(i), y = yAt(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // annotations (support/resistance dashed)
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1;
    annotations.forEach(a => {
      ctx.strokeStyle = a.type === 'support' ? 'rgba(46,204,113,.7)' : 'rgba(255,206,86,.85)';
      const yy = yAt(a.level);
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
    });
    ctx.setLineDash([]);

    // volume
    if (showVolume) {
      const vh = 70;
      const vy0 = h - (extraPaneCount * (paneH + 10)) - vh - 8;
      const barW = Math.max(1, (plotW / data.length) * 0.7);
      data.forEach((d, i) => {
        const x = xAt(i);
        const up = d.c >= d.o;
        const vH = (d.v / (volMax || 1)) * vh;
        ctx.fillStyle = up ? 'rgba(46,204,113,.6)' : 'rgba(231,76,60,.6)';
        ctx.fillRect(x - barW / 2, vy0 + (vh - vH), barW, vH);
      });
    }

    // RSI pane
    let paneTop = h - (extraPaneCount * (paneH + 10)) + 10;
    if (rsiPane && metrics.rsiArr) {
      const yR = (val: number) => {
        const top = paneTop, bottom = paneTop + paneH;
        const rng = 100 - 0;
        return top + ((100 - val) * (paneH / rng));
      };
      // box
      ctx.strokeStyle = 'rgba(255,255,255,.08)';
      ctx.strokeRect(pad.l, paneTop, plotW, paneH);
      // guides
      ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,.15)';
      [30, 50, 70].forEach(level => {
        const y = yR(level);
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      });
      ctx.setLineDash([]);

      // line
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      metrics.rsiArr.forEach((v, i) => {
        if (isNaN(v)) return;
        const x = xAt(i), y = yR(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();

      paneTop += paneH + 10;
    }

    // MACD pane
    if (macdPane && metrics.macdObj) {
      const { macdObj } = metrics;
      const vals = [...macdObj.macdLine, ...macdObj.signalLine, ...macdObj.hist];
      const mMax = Math.max(...vals.filter(v => isFinite(v))) || 1;
      const mMin = Math.min(...vals.filter(v => isFinite(v))) || -1;
      const yM = (val: number) => {
        const top = paneTop, bottom = paneTop + paneH;
        return top + ((mMax - val) * (paneH / (mMax - mMin + 1e-9)));
      };

      // box
      ctx.strokeStyle = 'rgba(255,255,255,.08)';
      ctx.strokeRect(pad.l, paneTop, plotW, paneH);
      // zero line
      const y0 = yM(0);
      ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,.15)';
      ctx.beginPath(); ctx.moveTo(pad.l, y0); ctx.lineTo(w - pad.r, y0); ctx.stroke();
      ctx.setLineDash([]);

      // histogram
      const barW = Math.max(1, (plotW / data.length) * 0.7);
      metrics.macdObj.hist.forEach((v, i) => {
        if (!isFinite(v)) return;
        const x = xAt(i);
        const y = yM(v);
        ctx.fillStyle = v >= 0 ? 'rgba(46,204,113,.6)' : 'rgba(231,76,60,.6)';
        ctx.fillRect(x - barW / 2, Math.min(y0, y), barW, Math.abs(y - y0));
      });

      // macd + signal
      ctx.strokeStyle = '#4dc9ff'; ctx.lineWidth = 1.3;
      ctx.beginPath();
      metrics.macdObj.macdLine.forEach((v, i) => {
        if (!isFinite(v)) return;
        const x = xAt(i), y = yM(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.strokeStyle = '#ffa14d';
      ctx.beginPath();
      metrics.macdObj.signalLine.forEach((v, i) => {
        if (!isFinite(v)) return;
        const x = xAt(i), y = yM(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();

      paneTop += paneH + 10;
    }

    // last price label
    const last = closes[closes.length - 1];
    const ly = yAt(last);
    ctx.strokeStyle = 'rgba(255,215,0,.7)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(pad.l, ly); ctx.lineTo(w - pad.r - 44, ly); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(w - pad.r - 44, ly - 9, 44, 18);
    ctx.fillStyle = '#000';
    ctx.font = '12px system-ui';
    ctx.fillText(last.toFixed(2), w - pad.r - 42, ly + 4);
  }, [
    containerSize, data, mode, showVolume,
    emaFast, emaSlow, showBB, bbPeriod, bbK,
    annotations, metrics, width, height, rsiPane, macdPane
  ]);

  // crosshair overlay
  useEffect(() => {
    const overlay = overlayRef.current;
    const base = baseRef.current;
    const wrap = wrapRef.current;
    if (!overlay || !base || !wrap) return;

    // size sync
    overlay.width = base.width;
    overlay.height = base.height;

    const ctx = overlay.getContext('2d')!;
    const w = overlay.width;
    const h = overlay.height;

    if (!data.length || !crosshair) {
      ctx.clearRect(0, 0, w, h);
      return;
    }

    const extraPaneCount = (rsiPane ? 1 : 0) + (macdPane ? 1 : 0);
    const paneH = 88;
    const extraH = extraPaneCount * (paneH + 10);
    const pad = { l: 48, r: 12, t: 10, b: (showVolume ? 90 : 40) + extraH };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;

    const highs = data.map(d => d.h);
    const lows = data.map(d => d.l);
    const max = highs.length ? Math.max(...highs) : 1;
    const min = lows.length ? Math.min(...lows) : 0;

    const xAt = (i: number) => pad.l + (i * plotW) / Math.max(1, data.length - 1);
    const idxAtX = (x: number) => {
      const i = Math.round(((x - pad.l) / plotW) * (data.length - 1));
      return Math.max(0, Math.min(data.length - 1, i));
    };
    const yAt = (px: number) => pad.t + ((max - px) * plotH) / (max - min + 1e-9);

    const onMove = (e: MouseEvent) => {
      const rect = overlay.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      ctx.clearRect(0, 0, w, h);

      // bounds
      if (mx < pad.l || mx > w - pad.r || my < pad.t || my > h - pad.b) return;

      // nearest index
      const i = idxAtX(mx);
      const c = data[i];
      const x = xAt(i);
      const y = yAt(c.c);

      // crosshair lines
      ctx.strokeStyle = 'rgba(255,255,255,.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, h - pad.b); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.setLineDash([]);

      // y price pill
      ctx.fillStyle = '#ffd700';
      const priceText = c.c.toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
      const pw = Math.max(44, ctx.measureText(priceText).width + 10);
      ctx.fillRect(w - pad.r - pw, y - 9, pw, 18);
      ctx.fillStyle = '#000';
      ctx.font = '12px system-ui';
      ctx.fillText(priceText, w - pad.r - pw + 6, y + 4);

      // x time pill
      const timeText = formatTime(c.t);
      const tw = Math.max(40, ctx.measureText(timeText).width + 10);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(x - tw / 2, h - pad.b + 6, tw, 18);
      ctx.fillStyle = '#000';
      ctx.fillText(timeText, x - tw / 2 + 6, h - pad.b + 18 - 9 + 4);
    };

    const onLeave = () => { ctx.clearRect(0, 0, w, h); };

    overlay.addEventListener('mousemove', onMove);
    overlay.addEventListener('mouseleave', onLeave);
    return () => {
      overlay.removeEventListener('mousemove', onMove);
      overlay.removeEventListener('mouseleave', onLeave);
    };
  }, [data, crosshair, containerSize, showVolume, rsiPane, macdPane]);

  return (
    <div>
      <div style={{ marginBottom: 6, fontWeight: 700 }}>
        {symbol} - {tf} - {mode}{showVolume ? ' + vol' : ''}
      </div>

      <div
        ref={wrapRef}
        className="chart-root"
        style={{ position: 'relative', width: '100%', height: height, minHeight: 320 }}
      >
        <canvas ref={baseRef} style={{ position: 'absolute', inset: 0 }} />
        <canvas
          ref={overlayRef}
          style={{ position: 'absolute', inset: 0, cursor: crosshair ? 'crosshair' : 'default' }}
        />
      </div>
    </div>
  );
}
