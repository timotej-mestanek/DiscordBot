export type RouletteSelection = number | "red" | "black" | "green";

const redNumbers = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export function getRouletteColor(number: number): "red" | "black" | "green" {
  if (number === 0) return "green";
  return redNumbers.has(number) ? "red" : "black";
}

export function parseRouletteSelection(value: string): RouletteSelection | null {
  const selection = value.trim().toLowerCase();
  if (/^(?:[0-9]|[12][0-9]|3[0-6])$/.test(selection)) {
    return Number(selection);
  }

  if (["red", "r", "cervena", "červená"].includes(selection)) {
    return "red";
  }
  if (["black", "b", "cerna", "černá"].includes(selection)) {
    return "black";
  }
  if (["green", "g", "zelena", "zelená"].includes(selection)) {
    return "green";
  }
  return null;
}

export function roulettePayout(
  selection: RouletteSelection,
  result: number,
  stake: number,
): number {
  const won =
    typeof selection === "number"
      ? selection === result
      : getRouletteColor(result) === selection;
  if (!won) return 0;
  return stake * (typeof selection === "number" ? 36 : 2);
}

export function dicePayout(guess: number, result: number, stake: number): number {
  return guess === result ? stake * 6 : 0;
}

export function coinflipPayout(
  guess: "hlava" | "orel",
  result: "hlava" | "orel",
  stake: number,
): number {
  return guess === result ? stake * 2 : 0;
}

export function parseStake(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const stake = Number(value);
  return Number.isSafeInteger(stake) && stake <= Math.floor(2_147_483_647 / 36)
    ? stake
    : null;
}
