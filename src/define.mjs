import { ABILITIES, MOMENTS } from "./contract.mjs";

/** Undeclared ability reads false: a no, never a crash and never a truthy object. */
const canProxy = (abilities) =>
  new Proxy({}, { get: (_t, k) => abilities?.[k]?.answer === "yes", has: (_t, k) => k in (abilities || {}) });

/**
 * Turn an adapter's answers into a profile.
 *
 * Every ability the standard names gets an answer (unanswered is "unmeasured"), every moment gets
 * the harness's own event name or null, `events` is the list of names the harness really has, and
 * `can.<ability>` is true only for a "yes". Abilities an adapter declares beyond the standard's
 * list are kept, so `can` answers for them too. `remoteControl` mirrors `phone`.
 */
export function defineHarness(spec) {
  const declared = spec.abilities && typeof spec.abilities === "object" ? spec.abilities : {};
  const abilities = { ...declared,
    ...Object.fromEntries(ABILITIES.map((a) => [a, declared[a] || { answer: "unmeasured" }])) };
  // Remote control is the ability the key `phone` has always held. Both names answer, with the
  // same object, whichever one the adapter declared.
  if (!declared.phone && declared.remoteControl) abilities.phone = declared.remoteControl;
  abilities.remoteControl = abilities.phone;
  const moments = Object.fromEntries(MOMENTS.map((m) => [m, spec.moments?.[m] ?? null]));
  const events = spec.events || MOMENTS.map((m) => moments[m]).filter(Boolean);
  return { ...spec, abilities, moments, events, can: canProxy(abilities) };
}
