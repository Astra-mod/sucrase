#!./node_modules/.bin/sucrase-node
/* eslint-disable no-console */
import run from "./run";

async function main(): Promise<void> {
  // Linting sub-projects requires the latest Sucrase types, so require a build first.
  await run(`rm -rf ./build`);
  await run("mkdir ./build");
  await run("cp -r ./bin ./build/bin");
  await run("cp -r ./register ./build/register ");
  await run("cp ./CHANGELOG.md ./build/CHANGELOG.md");
  await run("cp ./LICENSE ./build/LICENSE");
  await run("cp ./package.json ./build/package.json");
  await run("cp ./README.md ./build/README.md");
}

main().catch((e) => {
  console.error("Unhandled error:");
  console.error(e);
  process.exitCode = 1;
});
