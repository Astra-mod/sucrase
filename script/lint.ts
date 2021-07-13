#!./node_modules/.bin/sucrase-node
/* eslint-disable no-console */
import {exists} from "mz/fs";

import run from "./run";

const TSC = "./node_modules/.bin/tsc";
const ESLINT = "./node_modules/.bin/eslint";

async function main(): Promise<void> {
  // Linting sub-projects requires the latest Sucrase types, so require a build first.
  if (!(await exists("./dist"))) {
    console.log("Must run build before lint, running build...");
    await run("yarn build");
  }
  await Promise.all([checkSucrase()]);
}

async function checkSucrase(): Promise<void> {
  await Promise.all([
    run(`${TSC} --project . --noEmit`),
    run(
      `${ESLINT} ${["benchmark", "example-runner", "generator", "script", "src", "test", "test262"]
        .map((dir) => `'${dir}/**/*.ts'`)
        .join(" ")}`,
    ),
  ]);
}

main().catch((e) => {
  console.error("Unhandled error:");
  console.error(e);
  process.exitCode = 1;
});
