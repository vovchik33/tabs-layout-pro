import { getSortedTags, tagVersion } from "./package-utils.mjs";

const tags = getSortedTags();
if (tags.length === 0) {
  console.log("No release tags found.");
  process.exit(0);
}

console.log("Release versions:");
for (const tag of tags) {
  console.log(`  ${tagVersion(tag)} (${tag})`);
}
