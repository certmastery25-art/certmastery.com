import assert from "node:assert/strict";
import { test } from "node:test";
import { nsePathways, toOptions } from "../../prisma/nse/content";
import { nseLabs } from "../../prisma/nse/labs";
import { foundationBank } from "../../prisma/nse/practice/foundation";
import { nse45Bank } from "../../prisma/nse/practice/nse4-5";
import { nse67Bank } from "../../prisma/nse/practice/nse6-7";
import { gradeResponse, isResponseShapeValid, toPublicQuestion, type GradableOption } from "../../src/lib/nse/grading";
import { createLabState, executeLabLine, isTaskComplete, labDefinitionSchema, replayTranscript } from "../../src/lib/nse/lab-engine";
import { calculateReadiness } from "../../src/lib/nse/readiness";
import { selectWeighted } from "../../src/lib/nse/selection";

const option = (label: string, extra: Partial<GradableOption> = {}): GradableOption => ({ label, text: `text ${label}`, rationale: `why ${label}`, isCorrect: false, position: null, matchTo: null, ...extra });

test("grading: single and multiple need exactly the right answers", () => {
  const single = [option("A", { isCorrect: true }), option("B")];
  assert.equal(gradeResponse("SINGLE", single, ["A"]), true);
  assert.equal(gradeResponse("SINGLE", single, ["B"]), false);
  assert.equal(gradeResponse("SINGLE", single, ["A", "B"]), false);
  const multiple = [option("A", { isCorrect: true }), option("B", { isCorrect: true }), option("C")];
  assert.equal(gradeResponse("MULTIPLE", multiple, ["B", "A"]), true);
  assert.equal(gradeResponse("MULTIPLE", multiple, ["A"]), false, "no partial credit");
  assert.equal(gradeResponse("MULTIPLE", multiple, ["A", "B", "C"]), false);
  assert.equal(gradeResponse("MULTIPLE", multiple, ["A", "A"]), false, "a repeated answer isn't two answers");
});

test("grading: matching and ordering", () => {
  const ordering = [option("A", { position: 2 }), option("B", { position: 1 })];
  assert.equal(gradeResponse("ORDERING", ordering, ["B", "A"]), true);
  assert.equal(gradeResponse("ORDERING", ordering, ["A", "B"]), false);
  const matching = [option("A", { matchTo: "X" }), option("B", { matchTo: "Y" })];
  assert.equal(gradeResponse("MATCHING", matching, { A: "X", B: "Y" }), true);
  assert.equal(gradeResponse("MATCHING", matching, { A: "Y", B: "X" }), false);
  assert.equal(gradeResponse("MATCHING", matching, { A: "X" }), false);
  assert.equal(gradeResponse("MATCHING", matching, ["A", "B"]), false);
});

test("response shape is checked against the question's options", () => {
  assert.equal(isResponseShapeValid("SINGLE", [option("A")], ["Z"]), false);
  assert.equal(isResponseShapeValid("MATCHING", [option("A")], ["A"]), false);
  assert.equal(isResponseShapeValid("MATCHING", [option("A")], { A: "X" }), true);
  assert.equal(isResponseShapeValid("SINGLE", [option("A")], { A: "X" }), false);
});

test("the public question contains nothing that reveals the answer", () => {
  for (const pathway of nsePathways) for (const module of pathway.modules) for (const question of module.questions) {
    const options = toOptions(question) as GradableOption[];
    const type = question.type ?? (question.c && question.c.length > 1 ? "MULTIPLE" : "SINGLE");
    const visible = toPublicQuestion({ type, prompt: question.p, exhibit: question.x ?? null, difficulty: question.d, options }, options.map((item) => item.label));
    const json = JSON.stringify(visible);
    assert.doesNotMatch(json, /"(isCorrect|rationale|explanation|position|matchTo)":/);
    for (const item of options) assert.equal(json.includes(item.rationale), false);
  }
});

test("seed content is complete and well formed", () => {
  const prompts = new Set<string>();
  assert.equal(nsePathways.length, 17);
  for (const pathway of nsePathways) {
    assert.ok(pathway.modules.length > 0, pathway.slug);
    assert.ok(pathway.officialExams.length > 0, pathway.slug);
    for (const module of pathway.modules) {
      assert.ok(module.objectives.length > 0 && module.concepts.length > 0 && module.sources.length > 0, module.slug);
      assert.ok(module.questions.length >= 2, `${module.slug} needs questions`);
      for (const question of module.questions) {
        assert.equal(prompts.has(question.p), false, `duplicate: ${question.p}`);
        prompts.add(question.p);
        assert.ok(question.e && question.topic && question.tech, question.p);
        assert.ok(toOptions(question).every((item) => item.text && item.rationale), `missing rationale: ${question.p}`);
        const type = question.type ?? "SINGLE";
        if (type === "SINGLE") assert.ok(question.c?.length, question.p);
        if (type === "MULTIPLE") assert.ok((question.c?.length ?? 0) >= 2 && /Choose/.test(question.p), question.p);
        if (type === "MATCHING") assert.ok(question.a.every((row) => row.length === 3), question.p);
        if (type === "ORDERING") assert.ok(question.a.every((row) => row.length === 2), question.p);
      }
    }
  }
});

test("practice questions don't give away the answer by position, and options are distinct", () => {
  const practice = Object.values({ ...foundationBank, ...nse45Bank, ...nse67Bank }).flat().filter((question) => question.c?.length === 1);
  assert.ok(practice.length > 300);
  assert.ok(practice.filter((question) => question.c![0] === 0).length < practice.length * 0.4);
  for (const pathway of nsePathways) for (const module of pathway.modules) for (const question of module.questions) {
    const texts = toOptions(question).map((item) => item.text);
    assert.equal(new Set(texts).size, texts.length, question.p);
  }
});

test("weighted selection follows weights, spills over and doesn't repeat", () => {
  const candidates = [...Array.from({ length: 50 }, (_, index) => ({ id: `a${index}`, moduleId: "a" })), ...Array.from({ length: 50 }, (_, index) => ({ id: `b${index}`, moduleId: "b" }))];
  const picked = selectWeighted(candidates, new Map([["a", 80], ["b", 20]]), 10);
  assert.equal(picked.filter((id) => id.startsWith("a")).length, 8);
  assert.equal(new Set(picked).size, 10);
  const scarce = [{ id: "a1", moduleId: "a" }, ...Array.from({ length: 20 }, (_, index) => ({ id: `b${index}`, moduleId: "b" }))];
  assert.equal(selectWeighted(scarce, new Map([["a", 90], ["b", 10]]), 10).length, 10);
  assert.equal(selectWeighted(scarce, new Map(), 500).length, 21);
});

test("readiness needs more than one exam and rewards consistency", () => {
  const answers = Array.from({ length: 30 }, (_, index) => ({ moduleId: index % 2 ? "a" : "b", difficulty: "ADVANCED", isCorrect: true }));
  const one = calculateReadiness({ moduleIds: ["a", "b"], answers, exams: [{ percent: 100, submittedAt: new Date() }], labsTotal: 2, labsCompleted: 2 });
  assert.equal(one.score, null, "one exam can't produce a score");
  assert.ok(one.missing.length > 0);
  const steady = calculateReadiness({ moduleIds: ["a", "b"], answers, exams: [{ percent: 80, submittedAt: new Date(2) }, { percent: 80, submittedAt: new Date(1) }], labsTotal: 0, labsCompleted: 0 });
  const swingy = calculateReadiness({ moduleIds: ["a", "b"], answers, exams: [{ percent: 80, submittedAt: new Date(2) }, { percent: 30, submittedAt: new Date(1) }], labsTotal: 0, labsCompleted: 0 });
  assert.ok(steady.score! > swingy.score!);
  assert.ok(steady.score! <= 100);
});

test("every lab validates, starts incomplete and is solved by its own commands", () => {
  assert.ok(nseLabs.length >= 18);
  for (const lab of nseLabs) {
    const definition = labDefinitionSchema.parse({ hostname: "FGT-SIM", initial: lab.initial ?? [], outputs: lab.outputs ?? [], tasks: lab.tasks.map((task) => ({ ...task, checks: task.checks ?? [] })) });
    assert.ok(definition.tasks.every((task) => task.checks.length > 0 || task.verify), `${lab.slug} has a task that can't be graded`);
    assert.equal(replayTranscript(definition, []).complete, false, `${lab.slug} starts complete`);
    const transcript = definition.tasks.flatMap((task) => task.commands.map((command) => command.replace(/<[^>]+>/, "lab-value")));
    const { state, complete } = replayTranscript(definition, transcript);
    assert.ok(complete, `${lab.slug}: ${definition.tasks.filter((task) => !isTaskComplete(definition, state, task.id)).map((task) => task.id).join(", ")} not solved`);
    assert.equal(state.stack.length, 0, `${lab.slug} leaves the CLI inside a table`);
  }
});

test("the simulator tracks config levels and any valid order passes", () => {
  const definition = labDefinitionSchema.parse({ hostname: "FGT", initial: [], outputs: [], tasks: [{ id: "t", title: "t", instruction: "i", commands: [], expected: "e", hint: "h", checks: [{ path: ["system interface", "port1"], key: "ip", includes: ["10.0.0.1"] }] }] });
  const state = createLabState(definition);
  assert.match(executeLabLine(definition, state, "set ip 1.1.1.1"), /parse error/);
  assert.match(executeLabLine(definition, state, "edit port1"), /parse error/);
  for (const line of ["config system interface", "edit \"port1\"", "set allowaccess ping", "set ip 10.0.0.1 255.255.255.0"]) executeLabLine(definition, state, line);
  assert.equal(isTaskComplete(definition, state, "t"), true);
  executeLabLine(definition, state, "end");
  assert.equal(state.stack.length, 0, "end from an edit also leaves the table");
  assert.match(executeLabLine(definition, state, "show system interface"), /set ip 10.0.0.1/);
  assert.match(executeLabLine(definition, state, "fake command"), /Unknown action/);
});
