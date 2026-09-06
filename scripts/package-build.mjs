import {
  assertCleanWorkingTree,
  commitReleaseZip,
  packageDist,
  readJson,
  run,
  syncVersionFiles,
} from "./package-utils.mjs";

const bumpType = process.argv[2];
if (!["patch", "minor", "major"].includes(bumpType)) {
  console.error("Usage: node scripts/package-build.mjs <patch|minor|major>");
  process.exit(1);
}

assertCleanWorkingTree();
run(`npm version ${bumpType} --no-git-tag-version`);

const version = readJson("package.json").version;
syncVersionFiles(version);
run("git add package.json package-lock.json manifest.json");
run(`git commit -m "Release v${version}"`);
run(`git tag v${version}`);

const zipName = packageDist(version, bumpType === "major");
commitReleaseZip(zipName, version);
