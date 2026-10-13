import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeVulgarisms,
  countVulgarisms,
} from "../modules/profanity/detector";

test("counts each Czech, Slovak, and English vulgarism occurrence", () => {
  assert.equal(
    countVulgarisms("KURVA, ty kokot! What the fuck?"),
    3,
  );
});

test("normalizes diacritics and counts repeated words", () => {
  assert.equal(countVulgarisms("pičovina, picovina a pičovina"), 3);
  assert.equal(countVulgarisms("sračka i sracka"), 2);
});

test("does not count a vulgarism embedded in an unrelated word", () => {
  assert.equal(countVulgarisms("assassin class"), 0);
});

test("does not count mild insults or anatomical words", () => {
  assert.equal(
    countVulgarisms("blbě, trtko, teplouš, úchylák, riť, penis, vagina"),
    0,
  );
});

test("keeps independent category scores and applies configured weights", () => {
  const analysis = analyzeVulgarisms(
    "example example, phrase test",
    [
      { category: "homophobic", weight: 4, term: "example" },
      { category: "racist", weight: 7, term: "phrase test" },
    ],
  );

  assert.deepEqual(analysis, {
    occurrences: 3,
    categories: {
      homophobic: { occurrences: 2, score: 8 },
      racist: { occurrences: 1, score: 7 },
    },
  });
});
