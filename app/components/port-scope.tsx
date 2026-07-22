"use client";

import { useEffect, useRef } from "react";

export function PortScope({
  samples,
  label,
}: {
  samples: number[];
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1),
      width = Math.max(1, canvas.clientWidth),
      height = Math.max(1, canvas.clientHeight);
    if (canvas.width !== Math.round(width * ratio))
      canvas.width = Math.round(width * ratio);
    if (canvas.height !== Math.round(height * ratio))
      canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.strokeStyle = "#303d37";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, height / 2 + 0.5);
    context.lineTo(width, height / 2 + 0.5);
    context.stroke();
    if (samples.length < 2) return;
    context.strokeStyle = "#64d6a0";
    context.lineWidth = 1.25;
    context.beginPath();
    samples.forEach((sample, index) => {
      const x = (index / (samples.length - 1)) * width,
        y = height / 2 - Math.max(-10, Math.min(10, sample)) * (height / 22);
      if (index) context.lineTo(x, y);
      else context.moveTo(x, y);
    });
    context.stroke();
  }, [samples]);
  return <canvas ref={ref} aria-label={label} role="img" />;
}
