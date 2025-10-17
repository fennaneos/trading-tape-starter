// src/components/MiniChartPro.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };
type ChartMode = 'candles' | 'line' | 'both';

/* ---------- math helpers ---------- */
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
  const eFast = ema(values, fast);
  const eSlow = ema(values, slow);
  const macdLine = eFast.map((v, i) => v - eSlow[i]);
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
function fmt(n: number, p = 5) {
  if (!isFinite(n)) return '-';
  const s = n.toFixed(p);
  return s.replace(/0+$/, '').replace(/\.$/, '');
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
  width?: number; height?: number;
  mode?: ChartMode;
  showVolume?: boolean;
  emaFast?: number; emaSlow?: number;
  rsiPane?: boolean; rsiPeriod?: number;
  macdPane?: boolean;
  showBB?: boolean; bbPeriod?: number; bbK?: number;
  crosshair?: boolean;
  annotations?: { level: number; type: 'support' | 'resistance' }[];
  signals?: any[];
}) {
  const [data, setData] = useState<Candle[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: width, h: height });

  // mobile crosshair lock / long-press
  const lockRef = useRef<{ locked: boolean; i: number | null }>({ locked: false, i: null });
  const touchTimer = useRef<number | null>(null);

  const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:4000';

  /* fetch candles */
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

  /* observe size */
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

  /* indicators & ranges */
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

  /* draw base (price, volume, panes) */
  useEffect(() => {
    const base = baseRef.current;
    if (!base) return;

    const w = (base.width = (containerSize.w || width));
    const h = (base.height = (containerSize.h || height));

    const ctx = base.getContext('2d')!;
    ctx.fillStyle = '#0d1218';
    ctx.fillRect(0, 0, w, h);

    if (!data.length) return;

    const extraPaneCount = (rsiPane ? 1 : 0) + (macdPane ? 1 : 0);
    const paneH = 88;
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
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
    }

    // BB fill
    if (bb) {
      ctx.fillStyle = 'rgba(255, 215, 0, .07)';
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < data.length; i++) {
        const u = bb.upper[i]; if (isNaN(u)) continue;
        const x = xAt(i), y = yAt(u);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      for (let i = data.length - 1; i >= 0; i--) {
        const l = bb.lower[i]; if (isNaN(l)) continue;
        const x = xAt(i), y = yAt(l);
        ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
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
        ctx.beginPath(); ctx.moveTo(x, yH); ctx.lineTo(x, yL); ctx.stroke();
        const bx = x - cw / 2;
        const by = Math.min(yO, yC);
        const bh = Math.max(2, Math.abs(yC - yO));
        ctx.fillRect(bx, by, cw, bh);
      });
    }

    // close line
    if (mode !== 'candles') {
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      closes.forEach((c, i) => { const x = xAt(i), y = yAt(c); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.stroke();
    }

    // EMAs
    ctx.strokeStyle = '#4dc9ff'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    emaF.forEach((c, i) => { const x = xAt(i), y = yAt(c); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();

    ctx.strokeStyle = '#ffa14d';
    ctx.beginPath();
    emaS.forEach((c, i) => { const x = xAt(i), y = yAt(c); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();

    // BB lines
    if (bb) {
      ctx.strokeStyle = 'rgba(255,215,0,.65)'; ctx.lineWidth = 1;
      ctx.beginPath();
      bb.upper.forEach((v, i) => { if (isNaN(v)) return; const x = xAt(i), y = yAt(v); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.stroke();
      ctx.beginPath();
      bb.lower.forEach((v, i) => { if (isNaN(v)) return; const x = xAt(i), y = yAt(v); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.stroke();
    }

    // annotations
    ctx.setLineDash([6, 6]); ctx.lineWidth = 1;
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
      const yR = (val: number) => paneTop + ((100 - val) * (paneH / 100));
      ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.strokeRect(pad.l, paneTop, plotW, paneH);
      ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,.15)';
      [30, 50, 70].forEach(level => { const y = yR(level); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke(); });
      ctx.setLineDash([]);
      ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      metrics.rsiArr.forEach((v, i) => { if (isNaN(v)) return; const x = xAt(i), y = yR(v); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.stroke();
      paneTop += paneH + 10;
    }

    // MACD pane
    if (macdPane && metrics.macdObj) {
      const { macdObj } = metrics;
      const vals = [...macdObj.macdLine, ...macdObj.signalLine, ...macdObj.hist].filter(v => isFinite(v));
      const mMax = (vals.length ? Math.max(...vals) : 1);
      const mMin = (vals.length ? Math.min(...vals) : -1);
      const yM = (val: number) => paneTop + ((mMax - val) * (paneH / (mMax - mMin + 1e-9)));

      ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.strokeRect(pad.l, paneTop, plotW, paneH);
      const y0 = yM(0);
      ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.moveTo(pad.l, y0); ctx.lineTo(w - pad.r, y0); ctx.stroke(); ctx.setLineDash([]);

      const barW = Math.max(1, (plotW / data.length) * 0.7);
      macdObj.hist.forEach((v, i) => {
        if (!isFinite(v)) return;
        const x = xAt(i), y = yM(v);
        ctx.fillStyle = v >= 0 ? 'rgba(46,204,113,.6)' : 'rgba(231,76,60,.6)';
        ctx.fillRect(x - barW / 2, Math.min(y0, y), barW, Math.abs(y - y0));
      });

      ctx.strokeStyle = '#4dc9ff'; ctx.lineWidth = 1.3;
      ctx.beginPath();
      macdObj.macdLine.forEach((v, i) => { if (!isFinite(v)) return; const x = xAt(i), y = yM(v); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.stroke();

      ctx.strokeStyle = '#ffa14d';
      ctx.beginPath();
      macdObj.signalLine.forEach((v, i) => { if (!isFinite(v)) return; const x = xAt(i), y = yM(v); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.stroke();
    }

    // last price line/pill
    const last = closes[closes.length - 1];
    const ly = yAt(last);
    ctx.strokeStyle = 'rgba(255,215,0,.7)'; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(pad.l, ly); ctx.lineTo(w - pad.r - 44, ly); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffd700'; ctx.fillRect(w - pad.r - 44, ly - 9, 44, 18);
    ctx.fillStyle = '#000'; ctx.font = '12px system-ui';
    ctx.fillText(fmt(last), w - pad.r - 42, ly + 4);
  }, [
    containerSize, data, mode, showVolume, emaFast, emaSlow,
    showBB, bbPeriod, bbK, annotations, metrics, width, height, rsiPane, macdPane
  ]);

  /* crosshair + tooltip overlay (mouse + touch) */
  useEffect(() => {
    const overlay = overlayRef.current;
    const base = baseRef.current;
    if (!overlay || !base) return;

    overlay.width = base.width;
    overlay.height = base.height;

    const ctx = overlay.getContext('2d')!;
    const w = overlay.width, h = overlay.height;

    if (!data.length || !crosshair) {
      ctx.clearRect(0, 0, w, h);
      return;
    }

    // panes + bounds
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
    const idxAtX = (x: number) => Math.max(0, Math.min(data.length - 1, Math.round(((x - pad.l) / plotW) * (data.length - 1))));
    const yAt = (px: number) => pad.t + ((max - px) * plotH) / (max - min + 1e-9);

    const drawTooltip = (mx: number, my: number, i: number) => {
      const c = data[i];
      const lines: Array<[string, string]> = [
        ['Time', formatTime(c.t)],
        ['Price', fmt(c.c)],
        ['Open', fmt(c.o)], ['High', fmt(c.h)], ['Low', fmt(c.l)], ['Close', fmt(c.c)],
        ['Volume', fmt(c.v, 2)]
      ];
      if (isFinite(metrics.emaF[i])) lines.push(['EMA Fast', fmt(metrics.emaF[i])]);
      if (isFinite(metrics.emaS[i])) lines.push(['EMA Slow', fmt(metrics.emaS[i])]);
      if (metrics.bb) {
        const u = metrics.bb.upper[i], m = metrics.bb.middle[i], l = metrics.bb.lower[i];
        if (isFinite(u)) lines.push(['BB Upper', fmt(u)]);
        if (isFinite(m)) lines.push(['BB Mid', fmt(m)]);
        if (isFinite(l)) lines.push(['BB Lower', fmt(l)]);
      }
      if (metrics.rsiArr && isFinite(metrics.rsiArr[i])) lines.push(['RSI', fmt(metrics.rsiArr[i], 2)]);
      if (metrics.macdObj) {
        const macd = metrics.macdObj.macdLine[i];
        const sig = metrics.macdObj.signalLine[i];
        const hist = metrics.macdObj.hist[i];
        if (isFinite(macd)) lines.push(['MACD', fmt(macd, 4)]);
        if (isFinite(sig)) lines.push(['Signal', fmt(sig, 4)]);
        if (isFinite(hist)) lines.push(['Hist', fmt(hist, 4)]);
      }

      ctx.font = '12px system-ui';
      const labelW = Math.max(...lines.map(([k]) => ctx.measureText(k).width)) + 8;
      const valueW = Math.max(...lines.map(([, v]) => ctx.measureText(v).width)) + 8;
      const boxW = Math.max(160, labelW + valueW + 12);
      const boxH = lines.length * 18 + 10;

      let x = mx + 12, y = my + 12;
      if (x + boxW > w - 4) x = mx - boxW - 12;
      if (y + boxH > h - 4) y = my - boxH - 12;
      x = Math.max(4, Math.min(x, w - boxW - 4));
      y = Math.max(4, Math.min(y, h - boxH - 4));

      ctx.fillStyle = 'rgba(12,18,24,.95)'; ctx.strokeStyle = 'rgba(212,175,55,.4)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.rect(x, y, boxW, boxH); ctx.fill(); ctx.stroke();

      let yy = y + 8;
      lines.forEach(([k, v]) => {
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText(k, x + 8, yy + 10);
        ctx.fillStyle = '#ffd700'; ctx.fillText(v, x + 8 + labelW, yy + 10);
        yy += 18;
      });
    };

    const drawAtIndex = (i: number, mx: number, my: number) => {
      const c = data[i];
      const x = xAt(i);
      const y = yAt(c.c);

      ctx.clearRect(0, 0, w, h);

      // crosshair
      ctx.strokeStyle = 'rgba(255,255,255,.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, h - pad.b); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.setLineDash([]);

      // price pill
      ctx.fillStyle = '#ffd700';
      const priceText = fmt(c.c);
      const pw = Math.max(44, ctx.measureText(priceText).width + 10);
      ctx.fillRect(w - pad.r - pw, y - 9, pw, 18);
      ctx.fillStyle = '#000';
      ctx.fillText(priceText, w - pad.r - pw + 6, y + 4);

      // time pill
      const timeText = formatTime(c.t);
      const tw = Math.max(40, ctx.measureText(timeText).width + 10);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(x - tw / 2, h - pad.b + 6, tw, 18);
      ctx.fillStyle = '#000';
      ctx.fillText(timeText, x - tw / 2 + 6, h - pad.b + 18 - 9 + 4);

      drawTooltip(mx, my, i);
      lockRef.current.i = i;
    };

    const clearOverlay = () => ctx.clearRect(0, 0, w, h);

    /* ---- mouse ---- */
    const onMove = (e: MouseEvent) => {
      if (lockRef.current.locked) {
        // follow x when locked and dragging with mouse button
        if (e.buttons !== 1) return;
      }
      const rect = overlay.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (mx < pad.l || mx > w - pad.r || my < pad.t || my > h - pad.b) { if (!lockRef.current.locked) clearOverlay(); return; }
      const i = idxAtX(mx);
      drawAtIndex(i, mx, my);
    };
    const onLeave = () => { if (!lockRef.current.locked) clearOverlay(); };
    const onClick = (e: MouseEvent) => {
      // toggle lock on click
      const rect = overlay.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const i = idxAtX(mx);
      lockRef.current.locked = !lockRef.current.locked;
      if (lockRef.current.locked) drawAtIndex(i, mx, my);
      else clearOverlay();
    };

    /* ---- touch (mobile) ---- */
    const longPressMs = 300;

    const touchPos = (ev: TouchEvent) => {
      const t = ev.touches[0] || ev.changedTouches[0];
      const rect = overlay.getBoundingClientRect();
      return { mx: t.clientX - rect.left, my: t.clientY - rect.top };
    };

    const touchstart = (ev: TouchEvent) => {
      ev.preventDefault();
      if (touchTimer.current) window.clearTimeout(touchTimer.current);
      // long-press: show but not lock
      touchTimer.current = window.setTimeout(() => {
        if (!ev.touches.length) return;
        const { mx, my } = touchPos(ev);
        const i = idxAtX(mx);
        drawAtIndex(i, mx, my);
        lockRef.current.locked = false;
      }, longPressMs);
    };
    const touchmove = (ev: TouchEvent) => {
      ev.preventDefault();
      if (!ev.touches.length) return;
      const { mx, my } = touchPos(ev);
      const i = idxAtX(mx);
      // if locked, follow finger; if long-press fired (overlay visible), also follow
      if (lockRef.current.locked || overlayHasPixels()) drawAtIndex(i, mx, my);
    };
    const touchend = (ev: TouchEvent) => {
      ev.preventDefault();
      if (touchTimer.current) { window.clearTimeout(touchTimer.current); touchTimer.current = null; }

      // single tap: toggle lock
      if (ev.changedTouches && ev.changedTouches.length === 1) {
        const { mx, my } = touchPos(ev as any);
        const i = idxAtX(mx);
        // If overlay is basically empty -> this was a tap: toggle lock on
        if (!overlayHasPixels()) {
          lockRef.current.locked = true;
          drawAtIndex(i, mx, my);
          return;
        }
      }
      // if not locked, clear after long-press release
      if (!lockRef.current.locked) clearOverlay();
    };

    const overlayHasPixels = () => {
      // lightweight check: read 1px alpha in the center of overlay
      const p = ctx.getImageData(Math.floor(w / 2), Math.floor(h / 2), 1, 1).data;
      return p[3] !== 0;
    };

    // set proper touch-action to avoid page scroll while interacting
    (overlay.style as any).touchAction = 'none';

    overlay.addEventListener('mousemove', onMove);
    overlay.addEventListener('mouseleave', onLeave);
    overlay.addEventListener('click', onClick);

    overlay.addEventListener('touchstart', touchstart, { passive: false });
    overlay.addEventListener('touchmove', touchmove, { passive: false });
    overlay.addEventListener('touchend', touchend, { passive: false });
    overlay.addEventListener('touchcancel', touchend, { passive: false });

    return () => {
      overlay.removeEventListener('mousemove', onMove);
      overlay.removeEventListener('mouseleave', onLeave);
      overlay.removeEventListener('click', onClick);

      overlay.removeEventListener('touchstart', touchstart as any);
      overlay.removeEventListener('touchmove', touchmove as any);
      overlay.removeEventListener('touchend', touchend as any);
      overlay.removeEventListener('touchcancel', touchend as any);
    };
  }, [data, crosshair, containerSize, showVolume, rsiPane, macdPane, metrics]);

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
          style={{ position: 'absolute', inset: 0, cursor: crosshair ? 'crosshair' : 'default', touchAction: 'none' as any }}
        />
      </div>
    </div>
  );
}
