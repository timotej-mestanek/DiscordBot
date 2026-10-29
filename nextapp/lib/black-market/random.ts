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
