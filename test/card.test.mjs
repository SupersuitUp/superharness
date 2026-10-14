// The question card: which tools show a card, how a card is read, and what counts as an answer.
import { test } from "node:test";
import assert from "node:assert/strict";
import claudeCode from "../src/adapters/claude-code.mjs";
import codex from "../src/adapters/codex.mjs";
import { cardFrom, questionCardProblem } from "../src/card.mjs";
import { superToy } from "./fixtures.mjs";

const CLAUDE_INPUT = { questions: [
  { question: "Which draft should go to the landlord?", header: "Draft", multiSelect: false,
    options: [{ label: "Freeda sends the warm one", description: "Draft A" }, { label: "Sam edits it", description: "Draft B" }] },
  { question: "Send today?", header: "When", multiSelect: false, options: [{ label: "Yes" }, { label: "No" }] },
] };
const CODEX_INPUT = { questions: [
  { title: "Which draft should go to the landlord?", options: ["Freeda sends the warm one", "Sam edits it"] },
  { title: "Send today?", options: ["Yes", "No"] },
] };
const WANT = { questions: [
  { text: "Which draft should go to the landlord?", options: ["Freeda sends the warm one", "Sam edits it"] },
  { text: "Send today?", options: ["Yes", "No"] },
] };
const MALFORMED = [undefined, null, 7, "x", [], {}, { questions: "no" }, { questions: [null, 3, {}, { options: "x" }] }];

test("Claude Code: the card is AskUserQuestion, read from question and option labels, answered by the tool result", () => {
  const q = claudeCode({}).questionCard;
  assert.deepEqual(q.tools, ["AskUserQuestion"]);
  assert.equal(q.shape, "claude");
  assert.equal(q.answeredBy, "tool-result");
  assert.deepEqual(q.read(CLAUDE_INPUT), WANT);
});
test("Codex: the card is request_user_input_async first, read from title and string options, answered by the next message", () => {
  const q = codex({}).questionCard;
  assert.deepEqual(q.tools, ["request_user_input_async", "request_user_input"]);
  assert.equal(q.shape, "codex-async");
  assert.equal(q.answeredBy, "next-user-message");
  assert.deepEqual(q.read(CODEX_INPUT), WANT);
});
test("Codex's card carries an answer policy for consumers: an expired, vanished or preselected card is not an answer", () => {
  const q = codex({}).questionCard;
  assert.equal(q.answeredBy, "next-user-message");
  assert.match(q.answerPolicy, /expires/);
  assert.match(q.answerPolicy, /disappears/);
  assert.match(q.answerPolicy, /preselected/);
  assert.match(q.answerPolicy, /not an answer/);
  assert.ok(!q.answerPolicy.includes("\u2014"));
});
test("an answer policy is optional, and one that is present must be a sentence", () => {
  const good = superToy().questionCard;
  assert.equal(questionCardProblem({ ...good, answerPolicy: "A card that expires is not an answer." }), null);
  assert.equal(questionCardProblem(good), null);
  for (const bad of ["", " ", 7, null]) assert.equal(typeof questionCardProblem({ ...good, answerPolicy: bad }), "string", String(bad));
});
test("read returns no questions for a malformed input, and never throws", () => {
  for (const f of [claudeCode, codex])
    for (const bad of MALFORMED) assert.deepEqual(f({}).questionCard.read(bad), { questions: [] }, `${f({}).id} ${JSON.stringify(bad)}`);
});
test("read keeps a question whose options are missing, with an empty list", () => {
  assert.deepEqual(claudeCode({}).questionCard.read({ questions: [{ question: "Free text?" }] }), { questions: [{ text: "Free text?", options: [] }] });
  assert.deepEqual(codex({}).questionCard.read({ questions: [{ title: "Free text?" }] }), { questions: [{ text: "Free text?", options: [] }] });
});

test("cardFrom reads a card tool call, by exact name or after one functions. prefix", () => {
  assert.deepEqual(cardFrom({ tool_name: "AskUserQuestion", tool_input: CLAUDE_INPUT }, claudeCode({})), WANT);
  assert.deepEqual(cardFrom({ tool_name: "request_user_input_async", tool_input: CODEX_INPUT }, codex({})), WANT);
  assert.deepEqual(cardFrom({ tool_name: "functions.request_user_input_async", tool_input: CODEX_INPUT }, codex({})), WANT);
  assert.deepEqual(cardFrom({ tool_name: "request_user_input", tool_input: CODEX_INPUT }, codex({})), WANT);
});
test("cardFrom is null for any tool that is not one of the profile's card tools", () => {
  for (const name of ["Bash", "shell", "", undefined, "askuserquestion", "AskUserQuestionX", "mcp__freedom__AskUserQuestion",
    "functions.functions.AskUserQuestion", "request_user_input_async", "xfunctions.AskUserQuestion"])
    assert.equal(cardFrom({ tool_name: name, tool_input: CLAUDE_INPUT }, claudeCode({})), null, String(name));
  for (const name of ["AskUserQuestion", "mcp__x__request_user_input", "functions.functions.request_user_input", "request_user_input_asyncx"])
    assert.equal(cardFrom({ tool_name: name, tool_input: CODEX_INPUT }, codex({})), null, name);
});
test("cardFrom is null without a profile, a call or a question card clause, and never throws on a bad input", () => {
  assert.equal(cardFrom(null, codex({})), null);
  assert.equal(cardFrom({ tool_name: "ask", tool_input: {} }, null), null);
  assert.equal(cardFrom({ tool_name: "ask", tool_input: {} }, superToy({ questionCard: undefined })), null);
  assert.deepEqual(cardFrom({ tool_name: "ask", tool_input: null }, superToy()), { questions: [] });
  assert.deepEqual(cardFrom({ tool_name: "ask" }, superToy({ questionCard: { tools: ["ask"], shape: "t", answeredBy: "tool-result", read: () => { throw new Error("boom"); } } })), { questions: [] });
  assert.deepEqual(cardFrom({ tool_name: "ask" }, superToy({ questionCard: { tools: ["ask"], shape: "t", answeredBy: "tool-result", read: () => "nonsense" } })), { questions: [] });
});

test("a question card clause is well formed only with tools, a shape, a reader and a known answer route", () => {
  assert.equal(questionCardProblem(claudeCode({}).questionCard), null);
  assert.equal(questionCardProblem(codex({}).questionCard), null);
  const good = superToy().questionCard;
  for (const bad of [null, "x", { ...good, tools: [] }, { ...good, tools: ["ok", ""] }, { ...good, tools: "ask" }, { ...good, shape: "" },
    { ...good, read: null }, { ...good, answeredBy: "eventually" }, { ...good, read: () => { throw new Error("x"); } }, { ...good, read: () => ({}) }])
    assert.equal(typeof questionCardProblem(bad), "string", JSON.stringify(bad));
});
