"use client";

import { useMemo } from "react";
import { AdminChart, SERIES_COLORS } from "./admin-chart";
import { AdminToolbar, CsvLink, DataTable, KpiCard, LoadState, Panel, formatNumber, formatPercent, useAdminData, useAdminFilters } from "./admin-kit";

type Kpis = { visitors: number; visitorsApproximate: boolean; activeUsers: number; signups: number; pageViews: number; questionsAnswered: number; accuracy: number | null; quizzesCompleted: number };
type Day = { day: string; visitors: number; activeUsers: number; signedIn: number; anonymous: number; bot: number };
type Overview = { range: { includeBots: boolean }; current: Kpis; previous: Kpis; series: Day[]; source: string };

const shortDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

export function OverviewView() {
  const { rangeQuery } = useAdminFilters();
  const { data, error, loading } = useAdminData<Overview>(`/api/admin/overview?${rangeQuery}`);

  const charts = useMemo(() => {
    if (!data) return null;
    const labels = data.series.map((day) => shortDay(day.day));
    const views: { label: string; data: number[]; color: string }[] = [
      { label: "Signed in", data: data.series.map((day) => day.signedIn), color: SERIES_COLORS[0] },
      { label: "Anonymous", data: data.series.map((day) => day.anonymous), color: SERIES_COLORS[1] },
    ];
    if (data.range.includeBots) views.push({ label: "Bots", data: data.series.map((day) => day.bot), color: SERIES_COLORS[2] });
    return {
      labels,
      people: [
        { label: "Visitors", data: data.series.map((day) => day.visitors), color: SERIES_COLORS[0] },
        { label: "Active users", data: data.series.map((day) => day.activeUsers), color: SERIES_COLORS[1] },
      ],
      views,
    };
  }, [data]);

  return (
    <>
      <AdminToolbar><CsvLink href={`/api/admin/overview?${rangeQuery}&format=csv`} label="Daily CSV" /></AdminToolbar>
      <LoadState loading={loading && !data} error={error} />
      {data && charts && (
        <>
          <div className="admin-kpi-grid">
            <KpiCard label="UNIQUE VISITORS" value={data.current.visitors} previous={data.previous.visitors} note={data.current.visitorsApproximate ? "Sum of daily visitors (range exceeds raw retention)" : undefined} />
            <KpiCard label="ACTIVE USERS" value={data.current.activeUsers} previous={data.previous.activeUsers} />
            <KpiCard label="NEW SIGNUPS" value={data.current.signups} previous={data.previous.signups} />
            <KpiCard label="PAGE VIEWS" value={data.current.pageViews} previous={data.previous.pageViews} />
            <KpiCard label="QUESTIONS ANSWERED" value={data.current.questionsAnswered} previous={data.previous.questionsAnswered} />
            <KpiCard label="ACCURACY" value={data.current.accuracy} previous={data.previous.accuracy} format={formatPercent} />
            <KpiCard label="QUIZZES COMPLETED" value={data.current.quizzesCompleted} previous={data.previous.quizzesCompleted} />
          </div>
          <div className="admin-two-col">
            <Panel title="Visitors and active users per day">
              <AdminChart type="line" labels={charts.labels} series={charts.people} ariaLabel="Line chart of daily visitors and active users" />
            </Panel>
            <Panel title="Page views per day">
              <AdminChart type="bar" stacked labels={charts.labels} series={charts.views} ariaLabel="Stacked bar chart of daily page views by signed-in and anonymous visitors" />
            </Panel>
          </div>
          <Panel title="Daily figures" note={data.source === "events" ? "From raw events." : "Whole days come from the DailyStat rollup; the rest from raw events."}>
            <details className="admin-details">
              <summary>Show table</summary>
              <DataTable<Day> rows={[...data.series].reverse()} rowKey={(row) => row.day} columns={[
                { key: "day", label: "Day", render: (row) => shortDay(row.day) },
                { key: "visitors", label: "Visitors", align: "right", render: (row) => formatNumber(row.visitors) },
                { key: "activeUsers", label: "Active users", align: "right", render: (row) => formatNumber(row.activeUsers) },
                { key: "signedIn", label: "Views signed in", align: "right", render: (row) => formatNumber(row.signedIn) },
                { key: "anonymous", label: "Views anonymous", align: "right", render: (row) => formatNumber(row.anonymous) },
                ...(data.range.includeBots ? [{ key: "bot", label: "Bot views", align: "right" as const, render: (row: Day) => formatNumber(row.bot) }] : []),
              ]} />
            </details>
          </Panel>
        </>
      )}
    </>
  );
}
