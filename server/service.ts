import { randomInt, randomUUID } from 'node:crypto';
import {
  BLUEPRINTS,
  selectCandidate,
  totalItems,
  type Candidate,
  type SectionPlan,
  type SourceId,
} from '../src/engine/assembly.js';
import {
  GENERATORS,
  checkAnswer,
  itemFromKey,
  paramKey,
  templateKey,
} from '../src/engine/generators.js';
import { estimateAbility, type Response } from '../src/engine/irt.js';
import { generatedKey } from '../src/engine/itemKey.js';
import { SEED_NORMS, bandForAge, type Norm } from '../src/engine/norms.js';
import { assessQuality } from '../src/engine/quality.js';
import { createRng, hashString } from '../src/engine/rng.js';
import { scoreAreas, scoreIq, type AreaResult, type IqResult } from '../src/engine/scoring.js';
import {
  DIFFICULTIES,
  toPublicItem,
  type Area,
  type Difficulty,
  type IrtParams,
  type Item,
  type PublicItem,
  type Track,
} from '../src/engine/types.js';
import { VERBAL_BANK, verbalItem } from '../src/engine/verbal/bank.js';
import type { AttemptRow, NormSet, ResponseRow, Store, Tx } from './store.js';
import { openItemToken, sealItemToken, signTakerId, type Keys } from './tokens.js';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface Deps {
  store: Store;
  keys: Keys;
  now: () => Date;
}

export const RATE_LIMIT = { attempts: 5, windowMs: 60 * 60 * 1000 };
/** Allowance for network delay after a section's time runs out. */
export const SECTION_GRACE_MS = 10_000;
/** In-progress attempts older than this are treated as abandoned. */
export const ABANDON_AFTER_MS = 3 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------------------------
// Public shapes

export interface SectionInfo {
  area: Area;
  items: number;
  seconds: number;
}

export interface ItemPayload {
  /** Encrypted, short-lived; send it back with the answer. */
  token: string;
  number: number;
  total: number;
  section: {
    index: number;
    count: number;
    area: Area;
    itemNumber: number;
    items: number;
    seconds: number;
    endsAt: string;
  };
  serverNow: string;
  item: PublicItem;
}

export interface PreviousResult {
  completedAt: string;
  iqLabel: string;
  low: number;
  high: number;
}

export interface RetakeInfo {
  attemptNumber: number;
  completedBefore: number;
  previous: PreviousResult | null;
}

export interface AttemptStarted {
  takerToken: string;
  attemptId: string;
  track: Track;
  sections: SectionInfo[];
  retake: RetakeInfo;
  next: ItemPayload;
}

export type Progress = { done: true } | { done: false; next: ItemPayload };

export interface ResultView {
  attemptId: string;
  completedAt: string;
  track: Track;
  ageBand: string;
  score: IqResult;
  areas: AreaResult[];
  answered: number;
  correct: number;
  total: number;
  normsVersion: number;
  retake: RetakeInfo;
}

export interface TakerSummary {
  takerToken: string | null;
  completedBefore: number;
  previous: PreviousResult | null;
}

// ---------------------------------------------------------------------------------------------
// Helpers

const sectionsOf = (track: Track): SectionInfo[] =>
  BLUEPRINTS[track].map(({ area, items, seconds }) => ({ area, items, seconds }));

function normFor(norms: NormSet, band: string): Norm {
  const norm = norms.byBand[band] ?? SEED_NORMS[band];
  if (!norm) throw new Error(`No norm for band ${band}`);
  return norm;
}

const asResponses = (rows: readonly ResponseRow[]): Response[] =>
  rows.map(({ a, b, isCorrect }) => ({ a, b, correct: isCorrect }));

function previousResult(attempts: readonly AttemptRow[], before?: Date): PreviousResult | null {
  const done = attempts
    .filter(
      (a) =>
        a.status === 'completed' &&
        a.result &&
        (!before || (a.completedAt ?? a.startedAt) < before),
    )
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));
  const last = done[0];
  if (!last?.result || !last.completedAt) return null;
  const s = last.result.score;
  return {
    completedAt: last.completedAt.toISOString(),
    iqLabel: s.iqLabel,
    low: s.low,
    high: s.high,
  };
}

function sectionDeadline(attempt: AttemptRow): number {
  const plan = BLUEPRINTS[attempt.track][attempt.state.section] as SectionPlan;
  return Date.parse(attempt.state.sectionStartedAt) + plan.seconds * 1000;
}

interface Context {
  params: Map<string, IrtParams>;
  seen: Set<string>;
  norm: Norm;
  responses: ResponseRow[];
}

async function loadContext(tx: Tx, attempt: AttemptRow): Promise<Context> {
  const [params, seen, norms, responses] = await Promise.all([
    tx.itemParams(),
    tx.seenItemKeys(attempt.testTakerId),
    tx.currentNorms(),
    tx.listResponses(attempt.id),
  ]);
  return { params, seen, norm: normFor(norms, attempt.ageBand), responses };
}

/** Pick and build the item for the attempt's current slot, or null if none is available. */
function chooseItem(attempt: AttemptRow, ctx: Context): { item: Item; irt: IrtParams } | null {
  const { section, slot, position } = attempt.state;
  const plan = BLUEPRINTS[attempt.track][section] as SectionPlan;
  const theta = estimateAbility(asResponses(ctx.responses), ctx.norm).theta;
  const used = ctx.responses.filter((r) => r.section === section).map((r) => r.difficulty);
  const rng = createRng(hashString(`${attempt.formSeed}:${position}:order`));
  const source = plan.sources[slot % plan.sources.length] as SourceId;

  if (source === 'verbal-analogy' || source === 'verbal-odd') {
    const formats =
      source === 'verbal-analogy' ? ['analogy', 'odd-one-out'] : ['odd-one-out', 'analogy'];
    for (const format of formats) {
      const candidates: Candidate[] = rng
        .shuffle(VERBAL_BANK[attempt.track])
        .filter((e) => e.type === format && !ctx.seen.has(`bank:${e.id}`))
        .map((e) => ({
          id: e.id,
          difficulty: e.difficulty as Difficulty,
          irt: ctx.params.get(`bank:${e.id}`) ?? { a: 1, b: e.difficulty - 3 },
        }));
      const pick = selectCandidate(plan, slot, used, theta, candidates);
      const item = pick && verbalItem(pick.id);
      if (pick && item) return { item, irt: pick.irt };
    }
    return null;
  }

  const gen = GENERATORS[source];
  if (!gen) throw new Error(`Unknown source ${source}`);
  const candidates: Candidate[] = rng.shuffle(DIFFICULTIES).map((d) => {
    const id = templateKey(gen.id, gen.version, d);
    return { id, difficulty: d, irt: ctx.params.get(id) ?? gen.levels[d].irt };
  });
  const pick = selectCandidate(plan, slot, used, theta, candidates);
  if (!pick) return null;
  // Seeds come from the server-only form seed; a clash with a seen item just moves on.
  for (let retry = 0; ; retry++) {
    const seed = hashString(`${attempt.formSeed}:${position}:${retry}`);
    if (!ctx.seen.has(generatedKey(gen.id, gen.version, pick.difficulty, seed))) {
      return { item: gen.generate(seed, pick.difficulty), irt: pick.irt };
    }
  }
}

/** Move to the next item, skipping empty slots and finished sections. Marks it as seen. */
async function presentNext(
  tx: Tx,
  attempt: AttemptRow,
  ctx: Context,
  now: Date,
): Promise<Item | null> {
  const plan = BLUEPRINTS[attempt.track];
  const st = attempt.state;
  st.pending = null;
  for (;;) {
    if (st.section >= plan.length) {
      st.done = true;
      return null;
    }
    if (st.slot >= (plan[st.section] as SectionPlan).items) {
      st.section += 1;
      st.slot = 0;
      st.sectionStartedAt = now.toISOString();
      continue;
    }
    const chosen = chooseItem(attempt, ctx);
    if (!chosen) {
      st.slot += 1;
      continue;
    }
    st.pending = {
      position: st.position,
      section: st.section,
      slot: st.slot,
      itemKey: chosen.item.key,
      issuedAt: now.toISOString(),
    };
    await tx.addSeen(attempt.testTakerId, chosen.item.key, now);
    ctx.seen.add(chosen.item.key);
    return chosen.item;
  }
}

async function record(
  tx: Tx,
  attempt: AttemptRow,
  ctx: Context,
  item: Item,
  irt: IrtParams,
  fields: Pick<ResponseRow, 'answerIndex' | 'isCorrect' | 'responseMs' | 'timedOut' | 'presented'>,
) {
  const row: ResponseRow = {
    attemptId: attempt.id,
    position: attempt.state.position,
    section: attempt.state.section,
    itemKey: item.key,
    area: item.area,
    difficulty: item.difficulty,
    a: irt.a,
    b: irt.b,
    ...fields,
  };
  await tx.insertResponse(row);
  ctx.responses.push(row);
  attempt.state.position += 1;
  attempt.state.slot += 1;
}

/**
 * The section's time is up: the pending item counts as timed out, and every remaining slot is
 * filled with the item the test would have chosen and scored as not reached (incorrect).
 * Those unseen items are not marked as seen.
 */
async function timeOutSection(tx: Tx, attempt: AttemptRow, ctx: Context, now: Date) {
  const st = attempt.state;
  const plan = BLUEPRINTS[attempt.track][st.section] as SectionPlan;
  if (st.pending) {
    const item = itemFromKey(st.pending.itemKey);
    if (item) {
      await record(tx, attempt, ctx, item, ctx.params.get(paramKey(item.key)) ?? item.irt, {
        answerIndex: null,
        isCorrect: false,
        responseMs: now.getTime() - Date.parse(st.pending.issuedAt),
        timedOut: true,
        presented: true,
      });
    }
    st.pending = null;
  }
  while (st.slot < plan.items) {
    const chosen = chooseItem(attempt, ctx);
    if (!chosen) {
      st.slot += 1;
      continue;
    }
    await record(tx, attempt, ctx, chosen.item, chosen.irt, {
      answerIndex: null,
      isCorrect: false,
      responseMs: null,
      timedOut: true,
      presented: false,
    });
  }
}

function payload(attempt: AttemptRow, item: Item, keys: Keys, now: Date): ItemPayload {
  const plan = BLUEPRINTS[attempt.track];
  const st = attempt.state;
  const section = plan[st.section] as SectionPlan;
  const endsAt = sectionDeadline(attempt);
  return {
    token: sealItemToken(
      {
        attemptId: attempt.id,
        position: st.position,
        itemKey: item.key,
        expiresAt: endsAt + SECTION_GRACE_MS,
      },
      keys,
    ),
    number: st.position + 1,
    total: totalItems(attempt.track),
    section: {
      index: st.section,
      count: plan.length,
      area: section.area,
      itemNumber: st.slot + 1,
      items: section.items,
      seconds: section.seconds,
      endsAt: new Date(endsAt).toISOString(),
    },
    serverNow: now.toISOString(),
    item: toPublicItem(item),
  };
}

async function loadOwned(tx: Tx, attemptId: string, takerId: string | null): Promise<AttemptRow> {
  const attempt = await tx.getAttemptForUpdate(attemptId);
  // Same answer for "missing" and "not yours", so ids can't be probed.
  if (!attempt || !takerId || attempt.testTakerId !== takerId) {
    throw new ApiError(404, 'not_found', 'Attempt not found.');
  }
  return attempt;
}

/** In progress, not stale. Marks stale attempts abandoned. */
async function requireActive(tx: Tx, attempt: AttemptRow, now: Date) {
  if (
    attempt.status === 'in_progress' &&
    now.getTime() - attempt.startedAt.getTime() > ABANDON_AFTER_MS
  ) {
    attempt.status = 'abandoned';
    await tx.updateAttempt(attempt);
  }
  if (attempt.status !== 'in_progress') {
    throw new ApiError(409, 'not_in_progress', 'This test is no longer in progress.');
  }
}

/** Time out the current section if its deadline has passed, then present the next item. */
async function progress(
  tx: Tx,
  attempt: AttemptRow,
  ctx: Context,
  keys: Keys,
  now: Date,
): Promise<Progress> {
  while (
    !attempt.state.done &&
    attempt.state.pending &&
    now.getTime() > sectionDeadline(attempt) + SECTION_GRACE_MS
  ) {
    await timeOutSection(tx, attempt, ctx, now);
    await presentNext(tx, attempt, ctx, now);
  }
  if (!attempt.state.done && !attempt.state.pending) await presentNext(tx, attempt, ctx, now);
  await tx.updateAttempt(attempt);
  const pending = attempt.state.pending;
  if (attempt.state.done || !pending) return { done: true };
  const item = itemFromKey(pending.itemKey);
  if (!item) throw new Error(`Cannot rebuild item ${pending.itemKey}`);
  return { done: false, next: payload(attempt, item, keys, now) };
}

// ---------------------------------------------------------------------------------------------
// Operations

export async function getTaker(deps: Deps, takerId: string | null): Promise<TakerSummary> {
  if (!takerId) return { takerToken: null, completedBefore: 0, previous: null };
  return deps.store.transaction(async (tx) => {
    const taker = await tx.getTaker(takerId);
    if (!taker) return { takerToken: null, completedBefore: 0, previous: null };
    const attempts = await tx.listAttempts(takerId);
    return {
      takerToken: signTakerId(takerId, deps.keys),
      completedBefore: attempts.filter((a) => a.status === 'completed').length,
      previous: previousResult(attempts),
    };
  });
}

export async function createAttempt(
  deps: Deps,
  takerId: string | null,
  input: { age: number; consentResearch: boolean },
): Promise<AttemptStarted> {
  const band = bandForAge(input.age);
  if (!band) throw new ApiError(400, 'bad_age', 'The test is for ages 8 and over.');
  const now = deps.now();

  return deps.store.transaction(async (tx) => {
    let id = takerId && (await tx.getTaker(takerId)) ? takerId : null;
    if (!id) {
      id = randomUUID();
      await tx.createTaker(id, now);
    }

    const attempts = await tx.listAttempts(id);
    const recent = attempts.filter(
      (a) => now.getTime() - a.startedAt.getTime() < RATE_LIMIT.windowMs,
    );
    if (recent.length >= RATE_LIMIT.attempts) {
      throw new ApiError(
        429,
        'rate_limited',
        'Too many tests started recently. Please try again later.',
      );
    }
    for (const a of attempts.filter((x) => x.status === 'in_progress')) {
      a.status = 'abandoned';
      await tx.updateAttempt(a);
    }

    const attempt: AttemptRow = {
      id: randomUUID(),
      testTakerId: id,
      track: band.track,
      ageYears: input.age,
      ageBand: band.id,
      consentResearch: input.consentResearch,
      attemptNumber: attempts.length + 1,
      formSeed: randomInt(0, 2 ** 32),
      startedAt: now,
      completedAt: null,
      status: 'in_progress',
      state: {
        section: 0,
        slot: 0,
        position: 0,
        sectionStartedAt: now.toISOString(),
        pending: null,
        done: false,
      },
      theta: null,
      thetaSe: null,
      iq: null,
      normsVersion: null,
      eligibleForNorms: false,
      flags: {},
      result: null,
    };
    await tx.insertAttempt(attempt);

    const ctx = await loadContext(tx, attempt);
    const step = await progress(tx, attempt, ctx, deps.keys, now);
    if (step.done) throw new Error('No items available for a new attempt');

    return {
      takerToken: signTakerId(id, deps.keys),
      attemptId: attempt.id,
      track: band.track,
      sections: sectionsOf(band.track),
      retake: {
        attemptNumber: attempt.attemptNumber,
        completedBefore: attempts.filter((a) => a.status === 'completed').length,
        previous: previousResult(attempts),
      },
      next: step.next,
    };
  });
}

export async function currentItem(
  deps: Deps,
  takerId: string | null,
  attemptId: string,
): Promise<Progress & { sections: SectionInfo[]; track: Track }> {
  const now = deps.now();
  return deps.store.transaction(async (tx) => {
    const attempt = await loadOwned(tx, attemptId, takerId);
    if (attempt.status === 'completed')
      return { done: true, sections: sectionsOf(attempt.track), track: attempt.track };
    await requireActive(tx, attempt, now);
    const ctx = await loadContext(tx, attempt);
    const step = await progress(tx, attempt, ctx, deps.keys, now);
    return { ...step, sections: sectionsOf(attempt.track), track: attempt.track };
  });
}

export async function answer(
  deps: Deps,
  takerId: string | null,
  attemptId: string,
  input: {
    itemToken: string;
    answerIndex: number | null;
    responseMs: number;
    timedOut?: boolean | undefined;
  },
): Promise<Progress> {
  const now = deps.now();
  return deps.store.transaction(async (tx) => {
    const attempt = await loadOwned(tx, attemptId, takerId);
    await requireActive(tx, attempt, now);

    const token = openItemToken(input.itemToken, deps.keys);
    const pending = attempt.state.pending;
    if (!token || token.attemptId !== attempt.id) {
      throw new ApiError(400, 'bad_token', 'That question token is not valid.');
    }
    if (!pending || token.position !== pending.position || token.itemKey !== pending.itemKey) {
      throw new ApiError(409, 'stale_token', 'That question has already been answered.');
    }

    const ctx = await loadContext(tx, attempt);
    const late =
      now.getTime() > Math.min(token.expiresAt, sectionDeadline(attempt) + SECTION_GRACE_MS);
    if (input.timedOut || late) {
      await timeOutSection(tx, attempt, ctx, now);
      return progress(tx, attempt, ctx, deps.keys, now);
    }

    const item = itemFromKey(pending.itemKey);
    if (!item) throw new Error(`Cannot rebuild item ${pending.itemKey}`);
    if (input.answerIndex !== null && input.answerIndex >= item.optionCount) {
      throw new ApiError(400, 'bad_answer', 'That option does not exist.');
    }
    // The server's clock bounds the reported time, so it can't be inflated.
    const elapsed = now.getTime() - Date.parse(pending.issuedAt);
    await record(tx, attempt, ctx, item, ctx.params.get(paramKey(item.key)) ?? item.irt, {
      answerIndex: input.answerIndex,
      isCorrect: checkAnswer(item.key, input.answerIndex),
      responseMs: Math.max(0, Math.min(input.responseMs, elapsed + 2000)),
      timedOut: false,
      presented: true,
    });
    attempt.state.pending = null;
    return progress(tx, attempt, ctx, deps.keys, now);
  });
}

export async function finish(
  deps: Deps,
  takerId: string | null,
  attemptId: string,
): Promise<ResultView> {
  const now = deps.now();
  return deps.store.transaction(async (tx) => {
    const attempt = await loadOwned(tx, attemptId, takerId);
    if (attempt.status === 'completed' && attempt.result) return attempt.result;
    await requireActive(tx, attempt, now);
    if (!attempt.state.done)
      throw new ApiError(409, 'not_finished', 'There are questions left to answer.');

    const [responses, norms, taker, attempts] = await Promise.all([
      tx.listResponses(attempt.id),
      tx.currentNorms(),
      tx.getTaker(attempt.testTakerId),
      tx.listAttempts(attempt.testTakerId),
    ]);
    const norm = normFor(norms, attempt.ageBand);
    const estimate = estimateAbility(asResponses(responses), norm);
    const score = scoreIq(estimate, norm);
    const areas = scoreAreas(
      responses.map((r) => ({ area: r.area, a: r.a, b: r.b, correct: r.isCorrect })),
      norm,
    );
    const quality = assessQuality(
      responses.map((r) => ({
        a: r.a,
        b: r.b,
        correct: r.isCorrect,
        answerIndex: r.answerIndex,
        responseMs: r.responseMs,
        presented: r.presented,
      })),
      estimate.theta,
    );

    // Norms use only a first attempt: any earlier attempt, even abandoned, showed items.
    const first = attempt.attemptNumber === 1 && taker?.firstCompletedAttemptId == null;
    const eligible = attempt.consentResearch && first && quality.flags.length === 0;
    const others = attempts.filter((a) => a.id !== attempt.id);

    const result: ResultView = {
      attemptId: attempt.id,
      completedAt: now.toISOString(),
      track: attempt.track,
      ageBand: bandForAge(attempt.ageYears)?.label ?? attempt.ageBand,
      score,
      areas,
      answered: responses.filter((r) => r.presented && r.answerIndex !== null).length,
      correct: responses.filter((r) => r.isCorrect).length,
      total: responses.length,
      normsVersion: norms.version,
      retake: {
        attemptNumber: attempt.attemptNumber,
        completedBefore: others.filter((a) => a.status === 'completed').length,
        previous: previousResult(others),
      },
    };

    Object.assign(attempt, {
      status: 'completed',
      completedAt: now,
      theta: estimate.theta,
      thetaSe: estimate.se,
      iq: score.iq,
      normsVersion: norms.version,
      eligibleForNorms: eligible,
      flags: {
        quality: quality.flags,
        medianMs: quality.medianMs,
        lz: quality.lz,
        timedOut: responses.filter((r) => r.timedOut).length,
        notReached: responses.filter((r) => !r.presented).length,
        retake: attempt.attemptNumber > 1,
      },
      result,
    } satisfies Partial<AttemptRow>);
    await tx.updateAttempt(attempt);
    if (taker && taker.firstCompletedAttemptId == null)
      await tx.setFirstCompleted(taker.id, attempt.id);
    return result;
  });
}

export async function getResult(
  deps: Deps,
  takerId: string | null,
  attemptId: string,
): Promise<ResultView> {
  return deps.store.transaction(async (tx) => {
    const attempt = await loadOwned(tx, attemptId, takerId);
    if (attempt.status !== 'completed' || !attempt.result) {
      throw new ApiError(409, 'not_finished', 'This test has not been finished.');
    }
    return attempt.result;
  });
}
