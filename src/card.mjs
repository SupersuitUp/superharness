// The question card: the one place a harness's own card tool is read into a common shape.
//
// A card is `{ questions: [{ text, options: string[] }] }`. Each adapter says which tools show
// one (`tools`, in preference order), what its input looks like (`shape`, `read`), and what
// counts as the person's answer (`answeredBy`, and `answerPolicy` when the harness needs a
// sentence more). Nothing here runs a tool.

const ANSWERED_BY = ["tool-result", "next-user-message"];
const filled = (s) => typeof s === "string" && s.trim().length > 0;
const NONE = () => ({ questions: [] });

/**
 * Build a `read` that cannot throw. `pick(question)` returns `{ text, options }` for one of the
 * harness's own question objects; anything it cannot read is left out.
 */
export const cardReader = (pick) => (toolInput) => {
  const raw = Array.isArray(toolInput?.questions) ? toolInput.questions : [];
  const questions = [];
  for (const q of raw) {
    let got;
    try { got = pick(q); } catch { continue; }
    if (!filled(got?.text)) continue;
    questions.push({ text: got.text, options: (Array.isArray(got.options) ? got.options : []).filter(filled) });
  }
  return { questions };
};

/** Whatever a reader returned, as a card. A reader that throws or returns nonsense gives no questions. */
function safeRead(read, toolInput) {
  let out;
  try { out = read(toolInput); } catch { return NONE(); }
  return out && Array.isArray(out.questions) ? { questions: out.questions } : NONE();
}

/** What is wrong with a `questionCard` clause, in a sentence, or null when it is well formed. */
export function questionCardProblem(v) {
  if (!v || typeof v !== "object") return "must be an object: { tools, shape, read, answeredBy }";
  if (!Array.isArray(v.tools) || !v.tools.length || !v.tools.every(filled)) return "tools must be a non-empty list of tool names";
  if (!filled(v.shape)) return "shape must be a non-empty string";
  if (typeof v.read !== "function") return "read must be a function (toolInput) => { questions }";
  if (!ANSWERED_BY.includes(v.answeredBy)) return `answeredBy must be one of ${ANSWERED_BY.join(", ")}`;
  if ("answerPolicy" in v && !filled(v.answerPolicy)) return "answerPolicy, when given, must be a sentence";
  let out;
  try { out = v.read(null); } catch (e) { return `read threw on an empty input: ${e.message}`; }
  if (!out || !Array.isArray(out.questions)) return "read must return { questions: [] } for an input it cannot read";
  return null;
}

/** The tool's name as the profile lists it: exact, or after one leading `functions.`. */
const bareName = (name) => (typeof name === "string" && name.startsWith("functions.") ? name.slice("functions.".length) : name);

/**
 * The card a tool call shows, or null when the tool is not one of the profile's card tools.
 * Takes a hook payload's `{ tool_name, tool_input }`. A card tool with an unreadable input gives
 * `{ questions: [] }`, never a throw.
 */
export function cardFrom(call, profile) {
  const q = profile?.questionCard;
  if (!call || !q || !Array.isArray(q.tools) || typeof q.read !== "function") return null;
  if (!q.tools.includes(bareName(call.tool_name))) return null;
  return safeRead(q.read, call.tool_input);
}
