import assert from "node:assert/strict";
import { test } from "node:test";
import { azurePathways } from "../../prisma/azure/pathways";
import { nsePathways, toOptions } from "../../prisma/nse/content";

const bySlug = new Map(azurePathways.map((pathway) => [pathway.slug, pathway]));

test("the four Azure pathways are separate, published and sourced from Microsoft", () => {
  assert.deepEqual(azurePathways.map((pathway) => pathway.slug), ["az-900", "az-104", "az-700", "az-305"]);
  const fortinet = new Set(nsePathways.map((pathway) => pathway.slug));
  for (const pathway of azurePathways) {
    assert.equal(pathway.programme, "AZURE");
    assert.equal(pathway.status, "PUBLISHED", pathway.slug);
    assert.equal(fortinet.has(pathway.slug), false);
    assert.match(pathway.officialUrl ?? "", /^https:\/\/learn\.microsoft\.com\//);
    assert.ok(pathway.skillsAsOf && !Number.isNaN(Date.parse(pathway.skillsAsOf)), pathway.slug);
    assert.match(pathway.officialSpec ?? "", /700 or greater/);
  }
});

test("domain weightings match Microsoft's published ranges", () => {
  const ranges: Record<string, [number, number][]> = {
    "az-900": [[25, 30], [35, 40], [30, 35]],
    "az-104": [[20, 25], [15, 20], [20, 25], [15, 20], [10, 15]],
    "az-700": [[25, 30], [20, 25], [15, 20], [10, 15], [15, 20]],
    "az-305": [[25, 30], [20, 25], [15, 20], [30, 35]],
  };
  for (const pathway of azurePathways) {
    assert.deepEqual(pathway.modules.map((module) => module.weightRange), ranges[pathway.slug], pathway.slug);
    const low = pathway.modules.reduce((sum, module) => sum + module.weightRange![0], 0);
    const high = pathway.modules.reduce((sum, module) => sum + module.weightRange![1], 0);
    assert.ok(low <= 100 && high >= 100, `${pathway.slug} ranges can add up to 100%`);
    for (const module of pathway.modules) assert.ok(module.weight >= module.weightRange![0] && module.weight <= module.weightRange![1], module.slug);
  }
});

test("every domain has objectives with skills, and slugs are unique", () => {
  for (const pathway of azurePathways) {
    assert.equal(new Set(pathway.modules.map((module) => module.slug)).size, pathway.modules.length);
    for (const module of pathway.modules) {
      const objectives = module.examObjectives ?? [];
      assert.ok(objectives.length >= 2, module.slug);
      assert.equal(new Set(objectives.map((item) => item.slug)).size, objectives.length, module.slug);
      for (const item of objectives) assert.ok(item.skills.length > 0 && item.skills.every((skill) => skill.trim()), item.slug);
      assert.deepEqual(module.objectives, objectives.map((item) => item.title));
    }
  }
});

test("AZ-305 requires AZ-104, and AZ-700 stays optional", () => {
  assert.deepEqual(bySlug.get("az-305")!.requires?.map((item) => [item.slug, item.kind]), [["az-104", "REQUIRED"]]);
  for (const pathway of azurePathways) {
    for (const requirement of pathway.requires ?? []) assert.ok(bySlug.has(requirement.slug), requirement.slug);
    if (pathway.slug !== "az-305") assert.ok((pathway.requires ?? []).every((item) => item.kind === "RECOMMENDED"), `${pathway.slug} has no Microsoft requirement`);
  }
  assert.ok(azurePathways.every((pathway) => !(pathway.requires ?? []).some((item) => item.slug === "az-700")), "nothing requires AZ-700");
});

test("mock times follow Microsoft's published exam durations where they exist", () => {
  assert.deepEqual(bySlug.get("az-900")!.mock, [40, 45], "45 minutes");
  assert.deepEqual(bySlug.get("az-104")!.mock, [50, 100], "100 minutes");
  assert.deepEqual(bySlug.get("az-700")!.mock, [50, 100], "100 minutes");
});

for (const pathway of azurePathways) test(`${pathway.slug} questions cover every objective, are tagged correctly and don't give the answer away`, () => {
  const handWritten: { correct: string; options: string[] }[] = [];
  for (const module of pathway.modules) {
    const objectives = new Set((module.examObjectives ?? []).map((item) => item.slug));
    const used = new Set(module.questions.map((question) => question.obj));
    for (const objective of objectives) assert.ok(used.has(objective), `${pathway.slug}/${module.slug}/${objective} has no questions`);
    for (const question of module.questions) {
      assert.ok(question.obj && objectives.has(question.obj), `${question.p} is tagged ${question.obj}`);
      assert.ok(question.e && toOptions(question).every((item) => item.text && item.rationale), question.p);
      const texts = toOptions(question).map((item) => item.text);
      assert.equal(new Set(texts).size, texts.length, question.p);
      if ((question.type ?? "SINGLE") === "SINGLE" && !/drill/.test(question.p)) handWritten.push({ correct: question.a[question.c![0]][0], options: texts });
    }
  }
  const longest = handWritten.filter((item) => item.correct.length >= Math.max(...item.options.map((text) => text.length))).length;
  assert.ok(longest < handWritten.length * 0.35, `the correct answer is the longest option in ${longest} of ${handWritten.length} questions`);
});

test("no Azure question repeats a prompt from anywhere in the bank", () => {
  const prompts = [...nsePathways, ...azurePathways].flatMap((pathway) => pathway.modules.flatMap((module) => module.questions.map((question) => question.p)));
  assert.equal(new Set(prompts).size, prompts.length);
});
