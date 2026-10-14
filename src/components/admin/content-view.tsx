"use client";

import Link from "next/link";
import { AdminToolbar, CsvLink, DataTable, LoadState, Panel, formatNumber, formatPercent, useAdminData, useAdminFilters, type Column } from "./admin-kit";

type Row = Record<string, unknown>;
type Content = { tables: Record<string, Row[]>; eventsClipped: boolean; range: { retentionStart: string } };

const num = (key: string, label: string): Column<Row> => ({ key, label, align: "right", render: (row) => formatNumber(row[key] as number) });
const percent = (key: string, label: string): Column<Row> => ({ key, label, align: "right", render: (row) => formatPercent(row[key] as number | null) });

export function ContentView() {
  const { rangeQuery } = useAdminFilters();
  const { data, error, loading } = useAdminData<Content>(`/api/admin/content?${rangeQuery}`);
  const csv = (table: string) => <CsvLink href={`/api/admin/content?${rangeQuery}&format=csv&table=${table}`} />;
  const questionLink: Column<Row> = {
    key: "prompt", label: "Question",
    render: (row) => <Link className="admin-link" href={`/admin/questions/${row.question_id as string}?${rangeQuery}`}><span className="admin-mono">{row.question_id as string}</span> {row.prompt as string}</Link>,
  };
  const eventNote = data?.eventsClipped ? `Event-based lists cover ${data.range.retentionStart} onward; older raw events are deleted after 90 days.` : undefined;

  const domains = data?.tables.domains ?? [];
  const lowestAccuracy = [...domains].filter((row) => (row.answered as number) >= 10).sort((a, b) => (a.accuracy as number) - (b.accuracy as number)).slice(0, 10);

  return (
    <>
      <AdminToolbar />
      <LoadState loading={loading && !data} error={error} />
      {data && (
        <div className="admin-stack">
          <div className="admin-two-col">
            <Panel title="Top pages" actions={csv("pages")} note={eventNote}>
              <DataTable rows={data.tables.pages} columns={[{ key: "path", label: "Path", render: (row) => <span className="admin-mono">{row.path as string}</span> }, num("views", "Views"), num("visitors", "Visitors")]} />
            </Panel>
            <Panel title="Certifications" actions={csv("certifications")}>
              <DataTable rows={data.tables.certifications} columns={[{ key: "certification", label: "Certification" }, num("sessions", "Sessions"), num("answered", "Answered"), percent("accuracy", "Accuracy")]} />
            </Panel>
          </div>
          <div className="admin-two-col">
            <Panel title="Study modes" actions={csv("modes")}>
              <DataTable rows={data.tables.modes} columns={[{ key: "mode", label: "Mode", render: (row) => String(row.mode).toLowerCase() }, num("sessions", "Sessions"), percent("share", "Share"), num("completed", "Completed"), percent("completion_rate", "Completion")]} />
            </Panel>
            <Panel title="Difficulty filter" actions={csv("difficulty")} note={eventNote}>
              <DataTable rows={data.tables.difficulty} columns={[{ key: "difficulty", label: "Difficulty", render: (row) => (row.difficulty === "ANY" ? "Any (no filter)" : String(row.difficulty).toLowerCase()) }, num("sessions", "Quizzes"), percent("share", "Share")]} />
            </Panel>
          </div>
          <div className="admin-two-col">
            <Panel title="Most practised domains" actions={csv("domains")}>
              <DataTable rows={domains.slice(0, 10)} columns={[{ key: "certification", label: "Cert" }, { key: "domain", label: "Domain", render: (row) => `${row.objective} ${row.domain}` }, num("answered", "Answered"), percent("accuracy", "Accuracy")]} />
            </Panel>
            <Panel title="Lowest-accuracy domains" note="Domains with at least 10 answers in this range.">
              <DataTable rows={lowestAccuracy} columns={[{ key: "certification", label: "Cert" }, { key: "domain", label: "Domain", render: (row) => `${row.objective} ${row.domain}` }, num("answered", "Answered"), percent("accuracy", "Accuracy")]} />
            </Panel>
          </div>
          <Panel title="Hardest questions" actions={csv("hardest")} note="Lowest share of correct answers, with at least 20 attempts in this range.">
            <DataTable rows={data.tables.hardest} empty="No question has 20 or more attempts in this range yet." columns={[{ key: "certification", label: "Cert" }, questionLink, num("attempts", "Attempts"), percent("correct_rate", "Correct")]} />
          </Panel>
          <Panel title="Most-skipped questions" actions={csv("skipped")} note="Questions left unanswered in finished sessions, including timed exams that ran out of time.">
            <DataTable rows={data.tables.skipped} columns={[{ key: "certification", label: "Cert" }, questionLink, num("skips", "Skips"), num("shown", "Shown")]} />
          </Panel>
          <div className="admin-two-col">
            <Panel title="Top search terms" actions={csv("search")} note={eventNote ?? "From the Search question text box when a quiz is started."}>
              <DataTable rows={data.tables.search} columns={[{ key: "term", label: "Search term" }, num("searches", "Quizzes")]} />
            </Panel>
            <Panel title="Traffic sources" actions={csv("referrers")} note={eventNote}>
              <DataTable rows={data.tables.referrers} empty="No external referrers in this range." columns={[{ key: "value", label: "Referrer" }, num("views", "Views"), num("visitors", "Visitors")]} />
            </Panel>
          </div>
          <div className="admin-two-col">
            <Panel title="Countries" actions={csv("countries")} note={eventNote}>
              <DataTable rows={data.tables.countries} columns={[{ key: "value", label: "Country" }, num("views", "Views"), num("visitors", "Visitors")]} />
            </Panel>
            <Panel title="Devices" actions={csv("devices")} note={eventNote}>
              <DataTable rows={data.tables.devices} columns={[{ key: "value", label: "Device" }, num("views", "Views"), num("visitors", "Visitors")]} />
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
