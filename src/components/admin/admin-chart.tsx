"use client";

import { useEffect, useRef } from "react";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";

Chart.register(BarController, BarElement, CategoryScale, Legend, LineController, LineElement, LinearScale, PointElement, Tooltip);

// Fixed categorical order, validated for color-vision deficiency and contrast on the white panel surface.
// Assign series to slots in this order; never cycle or reuse a slot for another meaning.
export const SERIES_COLORS = ["#009182", "#d0542f", "#3a64c8"] as const;

const INK = "#5d6b63";
const GRID = "#eceee8";

type Series = { label: string; data: number[]; color: string };

export function AdminChart({ type, labels, series, stacked = false, height = 240, ariaLabel, suffix = "" }: {
  type: "line" | "bar";
  labels: string[];
  series: Series[];
  stacked?: boolean;
  height?: number;
  ariaLabel: string;
  suffix?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvas.current) return;
    const font = { family: getComputedStyle(document.body).fontFamily, size: 11 };
    const chart = new Chart(canvas.current, {
      type,
      data: {
        labels,
        datasets: series.map((item) => (type === "line"
          ? { label: item.label, data: item.data, borderColor: item.color, backgroundColor: item.color, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, pointHitRadius: 10, tension: 0.25 }
          // A 2px surface-colored border separates stacked segments and neighboring bars.
          : { label: item.label, data: item.data, backgroundColor: item.color, borderColor: "#ffffff", borderWidth: 2, borderRadius: 4, borderSkipped: false, maxBarThickness: 28 })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: series.length > 1, position: "top", align: "start", labels: { color: INK, font, usePointStyle: true, pointStyle: "circle", boxWidth: 8, boxHeight: 8 } },
          tooltip: { backgroundColor: "#1c2a25", titleFont: font, bodyFont: font, padding: 9, callbacks: { label: (context) => ` ${context.dataset.label}: ${Number(context.parsed.y).toLocaleString("en-US")}${suffix}` } },
        },
        scales: {
          x: { stacked, grid: { display: false }, ticks: { color: INK, font, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, border: { color: GRID } },
          y: { stacked, beginAtZero: true, grid: { color: GRID }, ticks: { color: INK, font, precision: 0 }, border: { display: false } },
        },
      },
    });
    return () => chart.destroy();
  }, [type, labels, series, stacked, suffix]);

  return <div className="admin-chart" style={{ height }}><canvas ref={canvas} role="img" aria-label={ariaLabel} /></div>;
}
