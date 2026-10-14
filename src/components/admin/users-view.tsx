"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminChart, SERIES_COLORS } from "./admin-chart";
import { AdminToolbar, CsvLink, DataTable, LoadState, Panel, formatDate, formatDateTime, formatNumber, formatPercent, useAdminData, useAdminFilters, useDebounced } from "./admin-kit";

type UserRow = { id: string; name: string | null; email: string | null; role: string; joined: string; last_active: string | null; answered: number; accuracy: number | null; favourite_cert: string | null; exams: number };
type UsersResponse = { rows: UserRow[]; total: number; page: number; pageSize: number };

export function UsersView() {
  const { params, set, query, rangeQuery } = useAdminFilters();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const debouncedSearch = useDebounced(search);
  useEffect(() => {
    if (debouncedSearch !== (params.get("q") ?? "")) set({ q: debouncedSearch, page: null });
  }, [debouncedSearch, params, set]);

  const { data, error, loading } = useAdminData<UsersResponse>(`/api/admin/users?${query}`);
  const sort = { key: params.get("sort") ?? "lastActive", direction: (params.get("dir") === "asc" ? "asc" : "desc") as "asc" | "desc" };
  const page = data?.page ?? 1;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <AdminToolbar showBots={false}>
        <input className="text-input admin-search" type="search" placeholder="Search name or email" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search users" />
        <CsvLink href={`/api/admin/users?${query}&format=csv`} />
      </AdminToolbar>
      <LoadState loading={loading && !data} error={error} />
      {data && (
        <Panel title={`Users (${formatNumber(data.total)})`} note="Answered, accuracy, favourite cert, and exams cover the selected range. Last active covers all time.">
          <DataTable<UserRow>
            rows={data.rows}
            rowKey={(row) => row.id}
            sort={sort}
            onSort={(key) => set({ sort: key, dir: sort.key === key && sort.direction === "desc" ? "asc" : "desc", page: null })}
            columns={[
              { key: "name", label: "User", sortable: true, render: (row) => <Link className="admin-link" href={`/admin/users/${row.id}?${rangeQuery}`}><strong>{row.name ?? "—"}</strong> <span className="admin-muted">{row.email}</span>{row.role === "ADMIN" && <span className="admin-badge">admin</span>}</Link> },
              { key: "joined", label: "Joined", sortable: true, render: (row) => formatDate(row.joined) },
              { key: "lastActive", label: "Last active", sortable: true, render: (row) => formatDateTime(row.last_active) },
              { key: "answered", label: "Answered", sortable: true, align: "right", render: (row) => formatNumber(row.answered) },
              { key: "accuracy", label: "Accuracy", sortable: true, align: "right", render: (row) => formatPercent(row.accuracy) },
              { key: "favourite_cert", label: "Favourite cert", render: (row) => row.favourite_cert ?? "—" },
              { key: "exams", label: "Quizzes done", sortable: true, align: "right", render: (row) => formatNumber(row.exams) },
            ]}
          />
          <div className="admin-pager">
            <button className="button button-secondary" type="button" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>Previous</button>
            <span>Page {page} of {pages}</span>
            <button className="button button-secondary" type="button" disabled={page >= pages} onClick={() => set({ page: String(page + 1) })}>Next</button>
          </div>
        </Panel>
      )}
    </>
  );
}

type Detail = {
  user: { id: string; name: string | null; email: string | null; role: string; createdAt: string };
  certs: { certification: string; answered: number; accuracy: number }[];
  domains: { certification: string; objective: string; domain: string; answered: number; accuracy: number }[];
  scores: { completed_at: string; certification: string; mode: string; total: number; correct: number; score: number }[];
  timeline: { ts: string; kind: string; detail: string }[];
};

export function UserDetailView({ id }: { id: string }) {
  const { rangeQuery } = useAdminFilters();
  const { data, error, loading } = useAdminData<Detail>(`/api/admin/users/${id}?${rangeQuery}`);
  const csv = (table: string) => <CsvLink href={`/api/admin/users/${id}?${rangeQuery}&format=csv&table=${table}`} />;
  const scoreSeries = useMemo(() => (data ? [{ label: "Score", data: data.scores.map((score) => score.score), color: SERIES_COLORS[0] }] : []), [data]);
  const scoreLabels = useMemo(() => (data ? data.scores.map((score) => new Date(score.completed_at).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" })) : []), [data]);

  return (
    <>
      <Link className="back-link" href={`/admin/users?${rangeQuery}`}>← All users</Link>
      <AdminToolbar />
      <LoadState loading={loading && !data} error={error} />
      {data && (
        <div className="admin-stack">
          <div className="admin-user-head">
            <h2>{data.user.name ?? "Unnamed user"} {data.user.role === "ADMIN" && <span className="admin-badge">admin</span>}</h2>
            <p>{data.user.email} · joined {formatDate(data.user.createdAt)} · <span className="admin-mono">{data.user.id}</span></p>
          </div>
          <Panel title="Quiz scores over time" actions={csv("scores")}>
            {data.scores.length ? <AdminChart type="line" labels={scoreLabels} series={scoreSeries} suffix="%" ariaLabel="Line chart of this user's completed quiz scores" /> : <p className="admin-empty">No completed quizzes in this range.</p>}
          </Panel>
          <div className="admin-two-col">
            <Panel title="Accuracy by certification" actions={csv("certs")}>
              <DataTable rows={data.certs} columns={[{ key: "certification", label: "Certification" }, { key: "answered", label: "Answered", align: "right" }, { key: "accuracy", label: "Accuracy", align: "right", render: (row) => formatPercent(row.accuracy) }]} />
            </Panel>
            <Panel title="Accuracy by domain" actions={csv("domains")}>
              <DataTable rows={data.domains} columns={[{ key: "certification", label: "Cert" }, { key: "domain", label: "Domain", render: (row) => `${row.objective} ${row.domain}` }, { key: "answered", label: "Answered", align: "right" }, { key: "accuracy", label: "Accuracy", align: "right", render: (row) => formatPercent(row.accuracy) }]} />
            </Panel>
          </div>
          <Panel title="Activity timeline" actions={csv("timeline")} note="Most recent 200 events and quiz sessions in this range.">
            <DataTable rows={data.timeline} columns={[{ key: "ts", label: "Time (UTC)", render: (row) => formatDateTime(row.ts) }, { key: "kind", label: "Activity", render: (row) => <span className="admin-type">{row.kind.replace(/_/g, " ")}</span> }, { key: "detail", label: "Detail" }]} />
          </Panel>
        </div>
      )}
    </>
  );
}
