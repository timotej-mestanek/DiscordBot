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
  throw new Error("Chýba nextapp/.env.dev. Vytvor ho z lokálnych vývojových nastavení.");
}
const devResult = config({ path: devEnvPath, override: true, quiet: true });
if (devResult.error) throw devResult.error;

for (const [key, value] of inheritedEnvironment) {
  process.env[key] = value;
}

process.env.HOSTNAME = "localhost";
process.env.PORT = "3000";

function run(script, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [resolve(script), ...args], {
      stdio: "inherit",
      env: process.env,
    });
    child.once("error", rejectRun);
    child.once("exit", (code) => resolveRun(code ?? 1));
  });
}

const prismaExitCode = await run("node_modules/prisma/build/index.js", ["generate"]);
if (prismaExitCode !== 0) process.exit(prismaExitCode);

const nextExitCode = await run("server.mjs", []);
process.exitCode = nextExitCode;
