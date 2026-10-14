"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { AdminToolbar, CsvLink, DataTable, LoadState, Panel, formatDateTime, formatNumber, useAdminData, useAdminFilters, useDebounced } from "./admin-kit";

const SLOW_MS = 1000;
const EVENT_TYPES = ["page_view", "session_start", "exam_started", "exam_finished", "signup", "login", "error"];
const TEXT_FILTERS = [
  { key: "path", label: "Path contains", placeholder: "/practice" },
  { key: "user", label: "User", placeholder: "Email or user ID" },
  { key: "cert", label: "Cert", placeholder: "ccna" },
  { key: "country", label: "Country", placeholder: "US" },
] as const;

type LogRow = { id: string; ts: string; type: string; path: string | null; method: string | null; status: number | null; duration_ms: number | null; user_id: string | null; user_email: string | null; user_name: string | null; cert_slug: string | null; mode: string | null; country: string | null; device: string | null; referrer_host: string | null; is_bot: boolean };
type ErrorRow = { path: string | null; status: number | null; count: number; last_seen: string };

function TextFilters() {
  const { params, set } = useAdminFilters();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(TEXT_FILTERS.map((filter) => [filter.key, params.get(filter.key) ?? ""])));
  const debounced = useDebounced(values);
  useEffect(() => {
    const changed = TEXT_FILTERS.some((filter) => (debounced[filter.key] ?? "") !== (params.get(filter.key) ?? ""));
    if (changed) set({ ...debounced, cursor: null });
  }, [debounced, params, set]);

  return (
    <div className="admin-filters">
      <label>Event type
        <select className="text-input select-input" value={params.get("type") ?? ""} onChange={(event) => set({ type: event.target.value, cursor: null })}>
          <option value="">All types</option>
          {EVENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </label>
      <label>Status
        <select className="text-input select-input" value={params.get("status") ?? ""} onChange={(event) => set({ status: event.target.value, cursor: null })}>
          <option value="">Any status</option>
          {["2xx", "3xx", "4xx", "5xx"].map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </label>
      {TEXT_FILTERS.map((filter) => (
        <label key={filter.key}>{filter.label}
          <input className="text-input" type="search" placeholder={filter.placeholder} value={values[filter.key]} onChange={(event) => setValues((current) => ({ ...current, [filter.key]: event.target.value }))} />
        </label>
      ))}
    </div>
  );
}

export function LogsView() {
  const { params, set, query, rangeQuery } = useAdminFilters();
  const tab = params.get("tab") === "errors" ? "errors" : "events";
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [tick, setTick] = useState(0);
  const onFirstPage = !params.get("cursor");

  useEffect(() => {
    if (!autoRefresh || !onFirstPage) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, onFirstPage]);

  const events = useAdminData<{ rows: LogRow[]; nextCursor: string | null }>(tab === "events" ? `/api/admin/logs?${query}` : null, tick);
  const errors = useAdminData<{ rows: ErrorRow[] }>(tab === "errors" ? `/api/admin/errors?${rangeQuery}` : null, tick);
  const exportQuery = new URLSearchParams(query);
  exportQuery.delete("cursor");
  exportQuery.delete("tab");

  return (
    <>
      <AdminToolbar>
        <label className="admin-toggle"><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} /><span>Auto-refresh 30s</span></label>
        {tab === "events" ? <CsvLink href={`/api/admin/logs?${exportQuery}&format=csv`} /> : <CsvLink href={`/api/admin/errors?${rangeQuery}&format=csv`} />}
      </AdminToolbar>
      <div className="admin-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "events"} className={cn(tab === "events" && "admin-tab-active")} onClick={() => set({ tab: null })}>Events</button>
        <button type="button" role="tab" aria-selected={tab === "errors"} className={cn(tab === "errors" && "admin-tab-active")} onClick={() => set({ tab: "errors", cursor: null })}>Errors</button>
      </div>

      {tab === "events" ? (
        <Panel title="Recent events" note="Newest first. 4xx and 5xx responses are highlighted, as are requests slower than 1,000 ms.">
          <TextFilters />
          <LoadState loading={events.loading && !events.data} error={events.error} />
          {events.data && (
            <>
              <DataTable<LogRow>
                rows={events.data.rows}
                rowKey={(row) => row.id}
                empty="No events match these filters."
                rowClassName={(row) => cn((row.status ?? 0) >= 500 || row.type === "error" ? "admin-row-error" : (row.status ?? 0) >= 400 ? "admin-row-warn" : undefined, (row.duration_ms ?? 0) > SLOW_MS && "admin-row-slow")}
                columns={[
                  { key: "ts", label: "Time (UTC)", render: (row) => formatDateTime(row.ts) },
                  { key: "type", label: "Type", render: (row) => <span className="admin-type">{row.type}{row.is_bot && " · bot"}</span> },
                  { key: "path", label: "Path", render: (row) => <span className="admin-mono">{row.method && row.method !== "GET" ? `${row.method} ` : ""}{row.path ?? [row.cert_slug, row.mode].filter(Boolean).join(" · ") ?? "—"}</span> },
                  { key: "status", label: "Status", align: "right", render: (row) => row.status ?? "—" },
                  { key: "duration_ms", label: "ms", align: "right", render: (row) => (row.duration_ms === null ? "—" : formatNumber(row.duration_ms)) },
                  { key: "user", label: "User", render: (row) => (row.user_id ? <Link className="admin-link" href={`/admin/users/${row.user_id}?${rangeQuery}`}>{row.user_email ?? row.user_id}</Link> : <span className="admin-muted">anonymous</span>) },
                  { key: "country", label: "Country", render: (row) => row.country ?? "—" },
                  { key: "device", label: "Device", render: (row) => row.device ?? "—" },
                  { key: "referrer_host", label: "Referrer", render: (row) => row.referrer_host ?? "—" },
                ]}
              />
              <div className="admin-pager">
                <button className="button button-secondary" type="button" disabled={onFirstPage} onClick={() => set({ cursor: null })}>Newest</button>
                <button className="button button-secondary" type="button" disabled={!events.data.nextCursor} onClick={() => set({ cursor: events.data?.nextCursor })}>Older</button>
              </div>
            </>
          )}
        </Panel>
      ) : (
        <Panel title="Errors by path and status" note="Responses with status 400 or above, and server errors, in the selected range.">
          <LoadState loading={errors.loading && !errors.data} error={errors.error} />
          {errors.data && (
            <DataTable<ErrorRow>
              rows={errors.data.rows}
              empty="No errors in this range."
              rowClassName={(row) => ((row.status ?? 500) >= 500 ? "admin-row-error" : "admin-row-warn")}
              columns={[
                { key: "path", label: "Path", render: (row) => <button type="button" className="admin-link admin-mono" onClick={() => set({ tab: null, path: row.path, status: row.status ? `${String(row.status)[0]}xx` : null, cursor: null })}>{row.path ?? "—"}</button> },
                { key: "status", label: "Status", align: "right", render: (row) => row.status ?? "error" },
                { key: "count", label: "Count", align: "right", render: (row) => formatNumber(row.count) },
                { key: "last_seen", label: "Last seen (UTC)", render: (row) => formatDateTime(row.last_seen) },
              ]}
            />
          )}
        </Panel>
      )}
    </>
  );
}
