import { ABILITIES, MOMENTS } from "./contract.mjs";

/** Undeclared ability reads false: a no, never a crash and never a truthy object. */
const canProxy = (abilities) =>
  new Proxy({}, { get: (_t, k) => abilities?.[k]?.answer === "yes", has: (_t, k) => k in (abilities || {}) });

/**
 * Turn an adapter's answers into a profile.
 *
 * Every ability the contract names gets an answer (unanswered is "unmeasured"), every moment gets
 * the harness's own event name or null, `events` is the list of names the harness really has, and
 * `can.<ability>` is true only for a "yes". Abilities an adapter declares beyond the contract's
 * list are kept, so `can` answers for them too.
 */
export function defineHarness(spec) {
  const abilities = { ...(spec.abilities || {}),
    ...Object.fromEntries(ABILITIES.map((a) => [a, spec.abilities?.[a] || { answer: "unmeasured" }])) };
  const moments = Object.fromEntries(MOMENTS.map((m) => [m, spec.moments?.[m] ?? null]));
  const events = spec.events || MOMENTS.map((m) => moments[m]).filter(Boolean);
  return { ...spec, abilities, moments, events, can: canProxy(abilities) };
}
