import {
  commitReleaseZip,
  getSortedTags,
  packageDist,
  run,
  syncVersionFiles,
  tagVersion,
} from "./package-utils.mjs";

const tags = getSortedTags();
if (tags.length === 0) {
  console.error("No git tags found. Create a release first.");
  process.exit(1);
}

const lastTag = tags[tags.length - 1];
const version = tagVersion(lastTag);
run(`git tag -d ${lastTag}`);
syncVersionFiles(version);
const zipName = packageDist(version);
commitReleaseZip(zipName, version, { rebuild: true });
run(`git tag ${lastTag}`);
