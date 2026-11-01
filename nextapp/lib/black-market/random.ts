export function pickWeighted<T>(items: { value: T; weight: number }[]): T {
  if (items.length === 0) {
    throw new Error("Cannot pick a weighted value from an empty list.");
  }

  const totalWeight = items.reduce((total, item) => {
    if (!Number.isSafeInteger(item.weight) || item.weight <= 0) {
      throw new Error("Weighted choices must have positive integer weights.");
    }
    return total + item.weight;
  }, 0);

  if (!Number.isSafeInteger(totalWeight) || totalWeight <= 0) {
    throw new Error("The total weighted-choice weight is invalid.");
  }

  let choice = Math.random() * totalWeight;
  for (const item of items) {
    choice -= item.weight;
    if (choice < 0) return item.value;
  }

  return items[items.length - 1].value;
}

export function pickByChance<T>(
  items: { value: T; chance: number }[],
): T | null {
  const totalChance = items.reduce((total, item) => {
    if (!Number.isFinite(item.chance) || item.chance < 0 || item.chance > 100) {
      throw new Error("Drop chances must be between 0 and 100.");
    }
    return total + item.chance;
  }, 0);
  if (totalChance > 100.000001) {
    throw new Error("The total drop chance must not exceed 100%.");
  }

  let roll = Math.random() * 100;
  for (const item of items) {
    roll -= item.chance;
    if (roll < 0) return item.value;
  }
  return null;
}
