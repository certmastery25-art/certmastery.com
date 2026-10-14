"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Download, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const RANGE_KEYS = ["range", "from", "to", "bots"] as const;

// Filters live in the URL so views are shareable and CSV exports use exactly what is on screen.
export function useAdminFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const set = useCallback((updates: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined || value === "") next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  // Only the shared range and bots settings, for links between admin pages.
  const rangeQuery = useMemo(() => {
    const shared = new URLSearchParams();
    for (const key of RANGE_KEYS) {
      const value = searchParams.get(key);
      if (value) shared.set(key, value);
    }
    return shared.toString();
  }, [searchParams]);

  return { params: searchParams, set, rangeQuery, query: searchParams.toString() };
}

export function useDebounced<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useAdminData<T>(url: string | null, refreshKey = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Could not load this data.");
        setData(body as T);
      })
      .catch((fetchError: unknown) => {
        if (!controller.signal.aborted) setError(fetchError instanceof Error ? fetchError.message : "Could not load this data.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [url, refreshKey]);

  return { data, error, loading };
}

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "custom", label: "Custom" },
];

// Date-range picker and bot toggle shown at the top of every admin page.
export function AdminToolbar({ children, showBots = true }: { children?: React.ReactNode; showBots?: boolean }) {
  const { params, set } = useAdminFilters();
  const range = params.get("range") ?? "7d";
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(params.get("from") ?? today);
  const [to, setTo] = useState(params.get("to") ?? today);

  return (
    <div className="admin-toolbar">
      <div className="admin-segmented" role="group" aria-label="Date range">
        {PRESETS.map((preset) => (
          <button key={preset.value} type="button" aria-pressed={range === preset.value} className={cn(range === preset.value && "admin-segment-active")}
            onClick={() => set(preset.value === "custom" ? { range: "custom", from, to, page: null, cursor: null } : { range: preset.value, from: null, to: null, page: null, cursor: null })}>
            {preset.label}
          </button>
        ))}
      </div>
      {range === "custom" && (
        <div className="admin-custom-range">
          <label>From <input className="text-input" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>To <input className="text-input" type="date" value={to} min={from} max={today} onChange={(event) => setTo(event.target.value)} /></label>
          <button className="button button-secondary" type="button" onClick={() => set({ range: "custom", from, to, page: null, cursor: null })}>Apply</button>
        </div>
      )}
      {showBots && (
        <label className="admin-toggle">
          <input type="checkbox" checked={params.get("bots") === "1"} onChange={(event) => set({ bots: event.target.checked ? "1" : null, cursor: null })} />
          <span>Show bots</span>
        </label>
      )}
      <span className="admin-utc">Dates in UTC</span>
      {children && <div className="admin-toolbar-extra">{children}</div>}
    </div>
  );
}

export function CsvLink({ href, label = "CSV" }: { href: string; label?: string }) {
  return <a className="admin-csv" href={href} download><Download size={13} /> {label}</a>;
}

export function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : value.toLocaleString("en-US");
}

export function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${value}%`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });
}

// Shows the change against the previous period of the same length.
export function KpiCard({ label, value, previous, format = formatNumber, note }: { label: string; value: number | null; previous: number | null; format?: (value: number | null) => string; note?: string }) {
  let change: React.ReactNode = <span className="admin-kpi-flat">no change</span>;
  if (value !== null && previous !== null && value !== previous) {
    const up = value > previous;
    const text = previous === 0 ? "new" : `${Math.abs(Math.round(((value - previous) / previous) * 100))}%`;
    change = <span className={up ? "admin-kpi-up" : "admin-kpi-down"}>{up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{text}</span>;
  }
  return (
    <div className="admin-kpi">
      <span className="overview-label">{label}</span>
      <strong>{format(value)}</strong>
      <span className="admin-kpi-change">{change} <span>vs previous {format(previous)}</span></span>
      {note && <span className="admin-kpi-note">{note}</span>}
    </div>
  );
}

export function Panel({ title, actions, children, note }: { title: string; actions?: React.ReactNode; children: React.ReactNode; note?: string }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head"><h2>{title}</h2>{actions && <div className="admin-panel-actions">{actions}</div>}</div>
      {note && <p className="admin-panel-note">{note}</p>}
      {children}
    </section>
  );
}

export type Column<T> = {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  align?: "right";
  sortable?: boolean;
};

export function DataTable<T extends Record<string, unknown>>({ columns, rows, empty = "No data for this range yet.", rowClassName, sort, onSort, rowKey }: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  rowClassName?: (row: T) => string | undefined;
  sort?: { key: string; direction: "asc" | "desc" };
  onSort?: (key: string) => void;
  rowKey?: (row: T, index: number) => string;
}) {
  if (!rows.length) return <p className="admin-empty">{empty}</p>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={cn(column.align === "right" && "admin-num")} aria-sort={sort?.key === column.key ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}>
                {column.sortable && onSort ? (
                  <button type="button" className="admin-sort" onClick={() => onSort(column.key)}>
                    {column.label}{sort?.key === column.key && (sort.direction === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                  </button>
                ) : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey ? rowKey(row, index) : index} className={rowClassName?.(row)}>
              {columns.map((column) => (
                <td key={column.key} className={cn(column.align === "right" && "admin-num")}>
                  {column.render ? column.render(row) : (row[column.key] as React.ReactNode) ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LoadState({ loading, error }: { loading: boolean; error: string }) {
  if (error) return <p className="form-alert" role="alert">{error}</p>;
  if (loading) return <p className="admin-loading" role="status"><LoaderCircle className="spin" size={16} /> Loading</p>;
  return null;
}
