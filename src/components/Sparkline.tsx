import React, { useEffect, useRef } from "react";

type Props = {
  values: number[];
  width?: number;  // CSS width (px)
  height?: number; // CSS height (px)
  stroke?: string; // line color
  fill?: string;   // gradient fill under
};

export default function Sparkline({
  values,
  width = 120,
  height = 36,
  stroke = "#22c55e",
  fill = "rgba(34,197,94,.12)",
}: Props) {
  const ref = useRef<HTMLCanvasElement|null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || values.length < 2) return;

    // upscale for crispness on HiDPI
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    el.width = width * dpr;
    el.height = height * dpr;
    el.style.width = width + "px";
    el.style.height = height + "px";

    const ctx = el.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const w = width, h = height, pad = 4;
    ctx.clearRect(0,0,w,h);

    const min = Math.min(...values), max = Math.max(...values);
    const x = (i:number) => pad + i*( (w-2*pad) / (values.length-1) );
    const y = (v:number) => pad + (max-v) * ((h-2*pad)/Math.max(1e-9, max-min));

    // fill
    const grad = ctx.createLinearGradient(0,0,0,h);
    grad.addColorStop(0, fill);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    values.forEach((v,i)=>{ const xx=x(i), yy=y(v); if(i===0) ctx.moveTo(xx,yy); else ctx.lineTo(xx,yy); });
    ctx.lineTo(w-pad,h-pad); ctx.lineTo(pad,h-pad); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    // line
    ctx.beginPath();
    values.forEach((v,i)=>{ const xx=x(i), yy=y(v); if(i===0) ctx.moveTo(xx,yy); else ctx.lineTo(xx,yy); });
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.6; ctx.stroke();
  }, [values, width, height, stroke, fill]);

  return <canvas ref={ref} />;
}
