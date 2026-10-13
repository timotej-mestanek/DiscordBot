import assert from "node:assert/strict";
import test from "node:test";
import {
  coinflipPayout,
  dicePayout,
  getRouletteColor,
  parseRouletteSelection,
  parseStake,
  roulettePayout,
} from "../modules/games/rules";

test("European roulette colors and payouts follow the wheel", () => {
  assert.equal(getRouletteColor(0), "green");
  assert.equal(getRouletteColor(1), "red");
  assert.equal(getRouletteColor(2), "black");
  assert.equal(getRouletteColor(19), "red");
  assert.equal(getRouletteColor(20), "black");

  assert.equal(roulettePayout("red", 1, 100), 200);
  assert.equal(roulettePayout("red", 0, 100), 0);
  assert.equal(roulettePayout(17, 17, 100), 3_600);
  assert.equal(roulettePayout(17, 18, 100), 0);
});

test("roulette selections accept numeric and Czech color choices only", () => {
  assert.equal(parseRouletteSelection("36"), 36);
  assert.equal(parseRouletteSelection("červená"), "red");
  assert.equal(parseRouletteSelection("zelená"), "green");
  assert.equal(parseRouletteSelection("37"), null);
  assert.equal(parseRouletteSelection("purple"), null);
});

test("dice and coinflip payouts include the returned stake", () => {
  assert.equal(dicePayout(6, 6, 50), 300);
  assert.equal(dicePayout(6, 5, 50), 0);
  assert.equal(coinflipPayout("hlava", "hlava", 50), 100);
  assert.equal(coinflipPayout("orel", "hlava", 50), 0);
});

test("stakes must be positive whole numbers within the database payout limit", () => {
  assert.equal(parseStake("1"), 1);
  assert.equal(parseStake("0"), null);
  assert.equal(parseStake("-5"), null);
  assert.equal(parseStake("1.5"), null);
  assert.equal(parseStake("9007199254740991"), null);
  assert.equal(parseStake(String(Math.floor(2_147_483_647 / 36) + 1)), null);
});
