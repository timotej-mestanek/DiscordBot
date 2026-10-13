import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type ProfanityCategoryScore = {
  occurrences: number;
  score: number;
};

export type ProfanityAnalysis = {
  occurrences: number;
  categories: Record<string, ProfanityCategoryScore>;
};

export type VulgarismRule = {
  category: string;
  weight: number;
  term: string;
};

const termsPath = fileURLToPath(new URL("./vulgarisms.txt", import.meta.url));

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("cs-CZ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function loadRules(): VulgarismRule[] {
  return readFileSync(termsPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line, index) => {
      const parts = line.includes("|")
        ? line.split("|").map((part) => part.trim())
        : ["general", "1", line];
      const [category, rawWeight, rawTerm] = parts;
      const weight = Number(rawWeight);
      if (
        parts.length !== 3 ||
        !/^[a-z][a-z0-9_-]{0,39}$/i.test(category) ||
        !/^[1-9]\d*$/.test(rawWeight) ||
        !Number.isSafeInteger(weight) ||
        weight > 100 ||
        !rawTerm
      ) {
        throw new Error(
          `Neplatné pravidlo vulgarismů na řádku ${index + 1} souboru vulgarisms.txt.`,
        );
      }

      const term = normalize(rawTerm).trim().replace(/\s+/g, " ");
      return {
        category: category.toLowerCase(),
        weight,
        term,
      };
    });
}

const rules = loadRules();

export function analyzeVulgarisms(
  text: string,
  configuredRules: readonly VulgarismRule[] = rules,
): ProfanityAnalysis {
  const normalizedText = normalize(text);
  const categories: Record<string, ProfanityCategoryScore> = {};
  let occurrences = 0;

  for (const rule of configuredRules) {
    const words = normalize(rule.term)
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .map(escapeRegExp)
      .join("\\s+");
    const expression = new RegExp(
      `(?<![\\p{L}\\p{N}])${words}(?![\\p{L}\\p{N}])`,
      "gu",
    );
    for (const _match of normalizedText.matchAll(expression)) {
      occurrences += 1;
      const score = categories[rule.category] ?? { occurrences: 0, score: 0 };
      score.occurrences += 1;
      score.score += rule.weight;
      categories[rule.category] = score;
    }
  }

  return { occurrences, categories };
}

export function countVulgarisms(text: string): number {
  return analyzeVulgarisms(text).occurrences;
}
