export function shuffle<T>(items: readonly T[], random: () => number = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

export type Candidate = { id: string; moduleId: string };

/**
 * Picks questions in proportion to each module's weight (largest remainder). When a module runs out,
 * the shortfall moves to the others, so a small bank gives a shorter exam only when the whole bank is exhausted.
 */
export function selectWeighted(candidates: Candidate[], weights: Map<string, number>, count: number, random: () => number = Math.random) {
  const pools = new Map<string, string[]>();
  for (const candidate of shuffle(candidates, random)) {
    pools.set(candidate.moduleId, [...(pools.get(candidate.moduleId) ?? []), candidate.id]);
  }
  const target = Math.min(count, candidates.length);
  const totalWeight = [...pools.keys()].reduce((sum, id) => sum + Math.max(weights.get(id) ?? 1, 1), 0);
  const quotas = [...pools.keys()].map((id) => {
    const exact = (target * Math.max(weights.get(id) ?? 1, 1)) / totalWeight;
    return { id, take: Math.min(Math.floor(exact), pools.get(id)!.length), remainder: exact - Math.floor(exact) };
  });
  let remaining = target - quotas.reduce((sum, quota) => sum + quota.take, 0);
  quotas.sort((a, b) => b.remainder - a.remainder);
  while (remaining > 0) {
    for (const quota of quotas) {
      if (remaining > 0 && quota.take < pools.get(quota.id)!.length) {
        quota.take += 1;
        remaining -= 1;
      }
    }
  }
  return shuffle(quotas.flatMap((quota) => pools.get(quota.id)!.slice(0, quota.take)), random);
}
