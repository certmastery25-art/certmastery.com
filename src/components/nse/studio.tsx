"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type Status = "DRAFT" | "REVIEW" | "PUBLISHED";
type Row = Record<string, unknown> & { id: string; title: string; status: Status };
type ModuleRow = Row & { pathwayId: string; slug: string; summary: string; objectives: string[]; notes: string; keyConcepts: string[]; exercise: string | null; sources: string[]; productVersion: string | null; weight: number; sortOrder: number; lastReviewedAt: string | null; _count: { questions: number } };
type PathwayRow = Row & { slug: string; level: number; track: string | null; summary: string; overview: string; prerequisites: string[]; objectives: string[]; officialExams: string[]; officialUrl: string; officialSpec: string | null; productVersion: string | null; mockQuestions: number; mockMinutes: number; questionTarget: number; sortOrder: number; modules: ModuleRow[]; _count: { attempts: number } };
type LabRow = Row & { pathwayId: string; slug: string };
type OptionRow = { label: string; text: string; rationale: string; isCorrect: boolean; position: number | null; matchTo: string | null };
type QuestionRow = { id?: string; moduleId: string; type: string; difficulty: string; prompt: string; exhibit: string | null; explanation: string; technology: string; topic: string; reference: string | null; status: Status; reviewNotes: string | null; options: OptionRow[]; answered?: number; correctRate?: number | null; module?: { title: string } };

const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
const STATUS: Status[] = ["DRAFT", "REVIEW", "PUBLISHED"];

async function send(path: string, method: string, body: unknown) {
  const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? "That couldn't be saved.");
  return result;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="nse-field"><span>{label}</span>{children}</label>;
}

function StatusSelect({ value, onChange, isAdmin }: { value: Status; onChange: (next: Status) => void; isAdmin: boolean }) {
  return <select className="text-input" value={value} onChange={(event) => onChange(event.target.value as Status)}>{STATUS.map((status) => <option key={status} value={status} disabled={status === "PUBLISHED" && !isAdmin && value !== "PUBLISHED"}>{status.toLowerCase()}</option>)}</select>;
}

function Text({ value, onChange, rows }: { value: string | number | null; onChange: (next: string) => void; rows?: number }) {
  return rows
    ? <textarea className="text-input nse-textarea" rows={rows} value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    : <input className="text-input" value={value ?? ""} onChange={(event) => onChange(event.target.value)} />;
}

function useSaver(onSaved: () => void) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const save = async (path: string, method: string, body: unknown) => {
    setMessage("");
    setError("");
    try {
      await send(path, method, body);
      setMessage("Saved.");
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "That couldn't be saved.");
    }
  };
  const feedback = <>{message && <p className="nse-saved" role="status">{message}</p>}{error && <p className="form-alert" role="alert">{error}</p>}</>;
  return { save, feedback };
}

function PathwayEditor({ pathway, isAdmin, onSaved }: { pathway: PathwayRow; isAdmin: boolean; onSaved: () => void }) {
  const [form, setForm] = useState(pathway);
  useEffect(() => setForm(pathway), [pathway]);
  const { save, feedback } = useSaver(onSaved);
  const set = (patch: Partial<PathwayRow>) => setForm((current) => ({ ...current, ...patch }));
  const body = { slug: form.slug, level: Number(form.level), track: form.track, title: form.title, summary: form.summary, overview: form.overview, prerequisites: form.prerequisites, objectives: form.objectives, officialExams: form.officialExams, officialUrl: form.officialUrl, officialSpec: form.officialSpec || null, productVersion: form.productVersion || null, mockQuestions: Number(form.mockQuestions), mockMinutes: Number(form.mockMinutes), questionTarget: Number(form.questionTarget), sortOrder: Number(form.sortOrder), status: form.status };
  return (
    <div className="nse-form">
      <Field label="Title"><Text value={form.title} onChange={(title) => set({ title })} /></Field>
      <Field label="Summary"><Text rows={2} value={form.summary} onChange={(summary) => set({ summary })} /></Field>
      <Field label="Overview"><Text rows={4} value={form.overview} onChange={(overview) => set({ overview })} /></Field>
      <Field label="Objectives, one per line"><Text rows={4} value={form.objectives.join("\n")} onChange={(value) => set({ objectives: value.split("\n") })} /></Field>
      <Field label="Prerequisites, one per line"><Text rows={2} value={form.prerequisites.join("\n")} onChange={(value) => set({ prerequisites: value.split("\n") })} /></Field>
      <Field label="Official exams, one per line"><Text rows={3} value={form.officialExams.join("\n")} onChange={(value) => set({ officialExams: value.split("\n") })} /></Field>
      <Field label="Official page"><Text value={form.officialUrl} onChange={(officialUrl) => set({ officialUrl })} /></Field>
      <Field label="Official exam details (only figures Fortinet publishes)"><Text rows={2} value={form.officialSpec} onChange={(officialSpec) => set({ officialSpec })} /></Field>
      <div className="nse-form-row">
        <Field label="Mock questions"><Text value={form.mockQuestions} onChange={(value) => set({ mockQuestions: Number(value) })} /></Field>
        <Field label="Mock minutes"><Text value={form.mockMinutes} onChange={(value) => set({ mockMinutes: Number(value) })} /></Field>
        <Field label="Question target"><Text value={form.questionTarget} onChange={(value) => set({ questionTarget: Number(value) })} /></Field>
        <Field label="Status"><StatusSelect isAdmin={isAdmin} value={form.status} onChange={(status) => set({ status })} /></Field>
      </div>
      <button className="button button-primary" type="button" onClick={() => void save(`/api/nse-studio/pathways/${pathway.id}`, "PUT", { ...body, objectives: lines(form.objectives.join("\n")), prerequisites: lines(form.prerequisites.join("\n")), officialExams: lines(form.officialExams.join("\n")) })}>Save pathway</button>
      {feedback}
    </div>
  );
}

const blankModule = (pathwayId: string, sortOrder: number): ModuleRow => ({ id: "", pathwayId, slug: "", title: "", summary: "", objectives: [], notes: "", keyConcepts: [], exercise: null, sources: [], productVersion: null, weight: 10, sortOrder, status: "DRAFT", lastReviewedAt: null, _count: { questions: 0 } });

function ModuleEditor({ module, isAdmin, onSaved }: { module: ModuleRow; isAdmin: boolean; onSaved: () => void }) {
  const [form, setForm] = useState(module);
  const [markReviewed, setMarkReviewed] = useState(false);
  useEffect(() => { setForm(module); setMarkReviewed(false); }, [module]);
  const { save, feedback } = useSaver(onSaved);
  const set = (patch: Partial<ModuleRow>) => setForm((current) => ({ ...current, ...patch }));
  const body = { pathwayId: form.pathwayId, slug: form.slug, title: form.title, summary: form.summary, objectives: lines(form.objectives.join("\n")), notes: form.notes, keyConcepts: lines(form.keyConcepts.join("\n")), exercise: form.exercise || null, sources: lines(form.sources.join("\n")), productVersion: form.productVersion || null, weight: Number(form.weight), sortOrder: Number(form.sortOrder), status: form.status, markReviewed };
  return (
    <div className="nse-form">
      <div className="nse-form-row"><Field label="Title"><Text value={form.title} onChange={(title) => set({ title })} /></Field><Field label="Slug"><Text value={form.slug} onChange={(slug) => set({ slug })} /></Field></div>
      <Field label="Summary"><Text rows={2} value={form.summary} onChange={(summary) => set({ summary })} /></Field>
      <Field label="Objectives, one per line"><Text rows={3} value={form.objectives.join("\n")} onChange={(value) => set({ objectives: value.split("\n") })} /></Field>
      <Field label="Study notes (### headings, - lists, **bold**, `code`, ``` blocks, | tables)"><Text rows={14} value={form.notes} onChange={(notes) => set({ notes })} /></Field>
      <Field label="Key concepts, one per line"><Text rows={3} value={form.keyConcepts.join("\n")} onChange={(value) => set({ keyConcepts: value.split("\n") })} /></Field>
      <Field label="Practical exercise"><Text rows={2} value={form.exercise} onChange={(exercise) => set({ exercise })} /></Field>
      <Field label="Source URLs, one per line"><Text rows={2} value={form.sources.join("\n")} onChange={(value) => set({ sources: value.split("\n") })} /></Field>
      <div className="nse-form-row">
        <Field label="Product version"><Text value={form.productVersion} onChange={(productVersion) => set({ productVersion })} /></Field>
        <Field label="Exam weight"><Text value={form.weight} onChange={(value) => set({ weight: Number(value) })} /></Field>
        <Field label="Order"><Text value={form.sortOrder} onChange={(value) => set({ sortOrder: Number(value) })} /></Field>
        <Field label="Status"><StatusSelect isAdmin={isAdmin} value={form.status} onChange={(status) => set({ status })} /></Field>
      </div>
      <label className="nse-check"><input type="checkbox" checked={markReviewed} onChange={(event) => setMarkReviewed(event.target.checked)} /> I reviewed this module against current Fortinet sources {form.lastReviewedAt ? `(last reviewed ${new Date(form.lastReviewedAt).toLocaleDateString("en-GB")})` : "(not yet reviewed)"}</label>
      <button className="button button-primary" type="button" onClick={() => void save(form.id ? `/api/nse-studio/modules/${form.id}` : "/api/nse-studio/modules", form.id ? "PUT" : "POST", body)}>Save module</button>
      {feedback}
    </div>
  );
}

const blankQuestion = (moduleId: string): QuestionRow => ({ moduleId, type: "SINGLE", difficulty: "INTERMEDIATE", prompt: "", exhibit: null, explanation: "", technology: "", topic: "", reference: null, status: "DRAFT", reviewNotes: null, options: ["A", "B", "C", "D"].map((label) => ({ label, text: "", rationale: "", isCorrect: false, position: null, matchTo: null })) });

function QuestionEditor({ question, isAdmin, onSaved }: { question: QuestionRow; isAdmin: boolean; onSaved: () => void }) {
  const [form, setForm] = useState(question);
  useEffect(() => setForm(question), [question]);
  const { save, feedback } = useSaver(onSaved);
  const set = (patch: Partial<QuestionRow>) => setForm((current) => ({ ...current, ...patch }));
  const setOption = (index: number, patch: Partial<OptionRow>) => set({ options: form.options.map((option, position) => position === index ? { ...option, ...patch } : option) });
  const body = { moduleId: form.moduleId, type: form.type, difficulty: form.difficulty, prompt: form.prompt, exhibit: form.exhibit || null, explanation: form.explanation, technology: form.technology, topic: form.topic, reference: form.reference || null, status: form.status, reviewNotes: form.reviewNotes || null, options: form.options };
  return (
    <div className="nse-form">
      <div className="nse-form-row">
        <Field label="Type"><select className="text-input" value={form.type} onChange={(event) => set({ type: event.target.value })}>{["SINGLE", "MULTIPLE", "MATCHING", "ORDERING"].map((type) => <option key={type}>{type}</option>)}</select></Field>
        <Field label="Difficulty"><select className="text-input" value={form.difficulty} onChange={(event) => set({ difficulty: event.target.value })}>{["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"].map((level) => <option key={level}>{level}</option>)}</select></Field>
        <Field label="Status"><StatusSelect isAdmin={isAdmin} value={form.status} onChange={(status) => set({ status })} /></Field>
      </div>
      <Field label="Question"><Text rows={3} value={form.prompt} onChange={(prompt) => set({ prompt })} /></Field>
      <Field label="Exhibit (configuration, CLI output or case study)"><Text rows={4} value={form.exhibit} onChange={(exhibit) => set({ exhibit })} /></Field>
      <fieldset className="nse-options-edit"><legend>Options</legend>
        {form.options.map((option, index) => (
          <div key={index} className="nse-option-edit">
            <strong>{option.label}</strong>
            <Field label="Text"><Text value={option.text} onChange={(text) => setOption(index, { text })} /></Field>
            <Field label="Why it is right or wrong"><Text value={option.rationale} onChange={(rationale) => setOption(index, { rationale })} /></Field>
            {(form.type === "SINGLE" || form.type === "MULTIPLE") && <label className="nse-check"><input type="checkbox" checked={option.isCorrect} onChange={(event) => setOption(index, { isCorrect: event.target.checked })} /> Correct</label>}
            {form.type === "MATCHING" && <Field label="Matches"><Text value={option.matchTo} onChange={(matchTo) => setOption(index, { matchTo })} /></Field>}
            {form.type === "ORDERING" && <Field label="Position"><Text value={option.position} onChange={(value) => setOption(index, { position: Number(value) || null })} /></Field>}
            <button className="button button-secondary button-small" type="button" onClick={() => set({ options: form.options.filter((_, position) => position !== index) })}>Remove</button>
          </div>
        ))}
        <button className="button button-secondary button-small" type="button" onClick={() => set({ options: [...form.options, { label: String.fromCharCode(65 + form.options.length), text: "", rationale: "", isCorrect: false, position: null, matchTo: null }] })}>Add option</button>
      </fieldset>
      <Field label="Explanation"><Text rows={3} value={form.explanation} onChange={(explanation) => set({ explanation })} /></Field>
      <div className="nse-form-row">
        <Field label="Technology"><Text value={form.technology} onChange={(technology) => set({ technology })} /></Field>
        <Field label="Topic"><Text value={form.topic} onChange={(topic) => set({ topic })} /></Field>
        <Field label="Reference URL"><Text value={form.reference} onChange={(reference) => set({ reference })} /></Field>
      </div>
      <Field label="Review notes (not shown to students)"><Text rows={2} value={form.reviewNotes} onChange={(reviewNotes) => set({ reviewNotes })} /></Field>
      <button className="button button-primary" type="button" onClick={() => void save(form.id ? `/api/nse-studio/questions/${form.id}` : "/api/nse-studio/questions", form.id ? "PUT" : "POST", body)}>Save question</button>
      {feedback}
    </div>
  );
}

function Questions({ pathway, isAdmin }: { pathway: PathwayRow; isAdmin: boolean }) {
  const [moduleId, setModuleId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; pageSize: number; questions: QuestionRow[] } | null>(null);
  const [editing, setEditing] = useState<QuestionRow | null>(null);
  const load = useCallback(async () => {
    const params = new URLSearchParams({ pathwayId: pathway.id, page: String(page), ...(moduleId ? { moduleId } : {}), ...(status ? { status } : {}) });
    const response = await fetch(`/api/nse-studio/questions?${params}`);
    if (response.ok) setData(await response.json());
  }, [moduleId, page, pathway.id, status]);
  useEffect(() => { void load(); }, [load]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <div>
      <div className="nse-form-row">
        <Field label="Module"><select className="text-input" value={moduleId} onChange={(event) => { setModuleId(event.target.value); setPage(1); }}><option value="">All modules</option>{pathway.modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}</select></Field>
        <Field label="Status"><select className="text-input" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Any</option>{STATUS.map((item) => <option key={item} value={item}>{item.toLowerCase()}</option>)}</select></Field>
        <button className="button button-secondary" type="button" disabled={!pathway.modules.length} onClick={() => setEditing(blankQuestion(moduleId || pathway.modules[0].id))}>New question</button>
      </div>
      <div className="nse-table-wrap" tabIndex={0}><table><thead><tr><th>Question</th><th>Type</th><th>Difficulty</th><th>Status</th><th>Answered</th><th>Correct</th></tr></thead><tbody>
        {data?.questions.map((question) => <tr key={question.id}><td><button className="nse-link-button" type="button" onClick={() => setEditing(question)}>{question.prompt.slice(0, 90)}</button></td><td>{question.type.toLowerCase()}</td><td>{question.difficulty.toLowerCase()}</td><td>{question.status.toLowerCase()}</td><td>{question.answered}</td><td>{question.correctRate === null ? "None yet" : `${question.correctRate}%`}</td></tr>)}
      </tbody></table></div>
      <div className="nse-pager"><button className="button button-secondary button-small" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pages} · {data?.total ?? 0} questions</span><button className="button button-secondary button-small" type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div>
      {editing && <section className="nse-card"><h3>{editing.id ? "Edit question" : "New question"}</h3><QuestionEditor question={editing} isAdmin={isAdmin} onSaved={() => void load()} /></section>}
    </div>
  );
}

function ImportPanel({ pathway, onSaved }: { pathway: PathwayRow; onSaved: () => void }) {
  const [json, setJson] = useState("");
  const { save, feedback } = useSaver(onSaved);
  const example = JSON.stringify([{ moduleId: pathway.modules[0]?.id ?? "module-id", type: "SINGLE", difficulty: "INTERMEDIATE", prompt: "Question text", explanation: "Why", technology: "FortiGate", topic: "Routing", options: [{ label: "A", text: "Answer", rationale: "Why right", isCorrect: true }, { label: "B", text: "Other", rationale: "Why wrong", isCorrect: false }] }], null, 2);
  return (
    <div className="nse-form">
      <p>Paste a JSON array of up to 500 questions. Every question is checked first, then all are added as drafts. If any fails, nothing is added. Only import original content that you have the right to use.</p>
      <Field label="Questions JSON"><Text rows={12} value={json} onChange={setJson} /></Field>
      <button className="button button-primary" type="button" onClick={() => { let parsed: unknown = null; try { parsed = JSON.parse(json); } catch { parsed = "invalid"; } void save("/api/nse-studio/import", "POST", parsed); }}>Import as drafts</button>
      {feedback}
      <details><summary>Format example</summary><pre className="nse-exhibit" tabIndex={0}><code>{example}</code></pre></details>
    </div>
  );
}

function LabEditor({ lab, isAdmin, onSaved }: { lab: LabRow; isAdmin: boolean; onSaved: () => void }) {
  const editable = { ...lab } as Record<string, unknown>;
  for (const key of ["id", "createdAt", "updatedAt"]) delete editable[key];
  const [json, setJson] = useState(JSON.stringify(editable, null, 2));
  const [status, setStatus] = useState<Status>(lab.status);
  const { save, feedback } = useSaver(onSaved);
  return (
    <div className="nse-form">
      <Field label="Status"><StatusSelect isAdmin={isAdmin} value={status} onChange={setStatus} /></Field>
      <Field label="Lab definition (JSON)"><Text rows={16} value={json} onChange={setJson} /></Field>
      <button className="button button-primary" type="button" onClick={() => { let parsed: Record<string, unknown> = {}; try { parsed = JSON.parse(json); } catch { /* the server rejects this */ } void save(`/api/nse-studio/labs/${lab.id}`, "PUT", { ...parsed, status }); }}>Save lab</button>
      {feedback}
    </div>
  );
}

export function NseStudio({ pathways, labs, isAdmin }: { pathways: PathwayRow[]; labs: LabRow[]; isAdmin: boolean }) {
  const router = useRouter();
  const [pathwayId, setPathwayId] = useState(pathways[0]?.id ?? "");
  const [tab, setTab] = useState("modules");
  const [moduleId, setModuleId] = useState<string>("");
  const [labId, setLabId] = useState("");
  const refresh = () => router.refresh();
  const pathway = pathways.find((item) => item.id === pathwayId);
  if (!pathway) return <p>No pathways yet. Run the NSE seed to add the programme.</p>;
  const selectedModule = moduleId === "new" ? blankModule(pathway.id, pathway.modules.length + 1) : pathway.modules.find((item) => item.id === moduleId);
  const lab = labs.find((item) => item.id === labId);
  const pathwayLabs = labs.filter((item) => item.pathwayId === pathway.id);
  const tabs = [["modules", "Modules"], ["questions", "Questions"], ["import", "Bulk import"], ["labs", "Labs"], ["settings", "Pathway and exam settings"]];

  return (
    <div className="nse-studio">
      <Field label="Pathway"><select className="text-input" value={pathwayId} onChange={(event) => { setPathwayId(event.target.value); setModuleId(""); setLabId(""); }}>{pathways.map((item) => <option key={item.id} value={item.id}>{item.title} ({item.status.toLowerCase()})</option>)}</select></Field>
      <div className="nse-tabs" role="tablist">{tabs.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "nse-tab-on" : ""} onClick={() => setTab(key)}>{label}</button>)}</div>

      {tab === "settings" && <PathwayEditor pathway={pathway} isAdmin={isAdmin} onSaved={refresh} />}
      {tab === "modules" && (
        <div>
          <ul className="nse-studio-list">{pathway.modules.map((item) => <li key={item.id}><button className="nse-link-button" type="button" onClick={() => setModuleId(item.id)}>{item.title}</button><span>{item.status.toLowerCase()} · {item._count.questions} questions · {item.lastReviewedAt ? "reviewed" : "awaiting review"}</span></li>)}</ul>
          <button className="button button-secondary" type="button" onClick={() => setModuleId("new")}>New module</button>
          {selectedModule && <section className="nse-card"><ModuleEditor module={selectedModule} isAdmin={isAdmin} onSaved={refresh} /></section>}
        </div>
      )}
      {tab === "questions" && <Questions key={pathway.id} pathway={pathway} isAdmin={isAdmin} />}
      {tab === "import" && <ImportPanel pathway={pathway} onSaved={refresh} />}
      {tab === "labs" && (
        <div>
          {!pathwayLabs.length && <p>This pathway has no labs yet.</p>}
          <ul className="nse-studio-list">{pathwayLabs.map((item) => <li key={item.id}><button className="nse-link-button" type="button" onClick={() => setLabId(item.id)}>{item.title}</button><span>{item.status.toLowerCase()}</span></li>)}</ul>
          {lab && <section className="nse-card"><LabEditor key={lab.id} lab={lab} isAdmin={isAdmin} onSaved={refresh} /></section>}
        </div>
      )}
    </div>
  );
}
