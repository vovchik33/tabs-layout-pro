import { getSortedTags, run, runCapture, tagVersion } from "./package-utils.mjs";

const tags = getSortedTags();
if (tags.length === 0) {
  console.error("No git tags found.");
  process.exit(1);
}

const lastTag = tags[tags.length - 1];
const version = tagVersion(lastTag);
const releaseMessages = new Set([
  `Release v${version}`,
  `Add release v${version}`,
  `Rebuild release v${version}`,
]);
const subjects = runCapture("git log --format=%s").split("\n").filter(Boolean);
let commitsToDrop = 0;

for (const subject of subjects) {
  if (!releaseMessages.has(subject)) break;
  commitsToDrop += 1;
}

run(`git tag -d ${lastTag}`);
if (commitsToDrop > 0) {
  run(`git reset --hard HEAD~${commitsToDrop}`);
}
