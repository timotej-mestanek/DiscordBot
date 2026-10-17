import { spawn } from "node:child_process";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const inheritedEnvironment = new Map(Object.entries(process.env));
const baseEnvPath = resolve(".env");
const devEnvPath = resolve(".env.dev");

if (existsSync(baseEnvPath)) {
  const baseResult = config({ path: baseEnvPath, quiet: true });
  if (baseResult.error) throw baseResult.error;
}

if (!existsSync(devEnvPath)) {
  throw new Error("Chýba bot/.env.dev. Vytvor ho z lokálnych vývojových nastavení.");
}
const devResult = config({ path: devEnvPath, override: true, quiet: true });
if (devResult.error) throw devResult.error;

for (const [key, value] of inheritedEnvironment) {
  process.env[key] = value;
}

const prisma = spawn(
  process.execPath,
  [resolve("node_modules/prisma/build/index.js"), "generate"],
  { stdio: "inherit", env: process.env },
);
prisma.once("error", (error) => {
  console.error("Nepodarilo sa vygenerovať Prisma klienta:", error);
  process.exitCode = 1;
});
prisma.once("exit", (code) => {
  if (code !== 0) {
    process.exitCode = code ?? 1;
    return;
  }

  const child = spawn(
    process.execPath,
    [resolve("node_modules/tsx/dist/cli.mjs"), "watch", "bot.ts"],
    { stdio: "inherit", env: process.env },
  );
  child.once("error", (error) => {
    console.error("Nepodarilo sa spustiť Discord bot v dev režime:", error);
    process.exitCode = 1;
  });
  child.once("exit", (childCode) => {
    process.exitCode = childCode ?? 1;
  });
});
