import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), "utf8"));
}

export function writeJson(relativePath, data) {
  writeFileSync(join(root, relativePath), `${JSON.stringify(data, null, 2)}\n`);
}

export function run(command, options = {}) {
  execSync(command, { cwd: root, stdio: "inherit", ...options });
}

export function runCapture(command) {
  return execSync(command, { cwd: root, encoding: "utf8" }).trim();
}

export function assertCleanWorkingTree() {
  if (runCapture("git status --porcelain")) {
    console.error("Working tree must be clean before packaging.");
    process.exit(1);
  }
}

export function syncVersionFiles(version) {
  const pkg = readJson("package.json");
  pkg.version = version;
  writeJson("package.json", pkg);

  const lock = readJson("package-lock.json");
  lock.version = version;
  if (lock.packages?.[""]) lock.packages[""].version = version;
  writeJson("package-lock.json", lock);

  const manifest = readJson("manifest.json");
  manifest.version = version;
  writeJson("manifest.json", manifest);
}

export function zipFileName(version, releaseMajor = false) {
  const outputVersion = releaseMajor ? `${version.split(".")[0]}.0.0` : version;
  return `tabs-layout-pro_v${outputVersion}.zip`;
}

export function packageDist(version, releaseMajor = false) {
  run("npm run build");
  const releasesDir = join(root, "releases");
  mkdirSync(releasesDir, { recursive: true });
  const zipName = zipFileName(version, releaseMajor);
  const zipPath = join(releasesDir, zipName);
  run(`rm -f "${zipPath}"`);
  run(`zip -rq "${zipPath}" .`, { cwd: join(root, "dist") });
  console.log(`Packaged releases/${zipName}`);
  return zipName;
}

export function commitReleaseZip(zipName, version, { rebuild = false } = {}) {
  run(`git add "releases/${zipName}"`);
  run(`git commit -m "${rebuild ? "Rebuild" : "Add"} release v${version}"`);
}

export function removeReleaseZip(version) {
  for (const zipName of [...new Set([zipFileName(version), zipFileName(version, true)])]) {
    const zipPath = join(root, "releases", zipName);
    if (!existsSync(zipPath)) continue;
    try {
      run(`git rm -f "releases/${zipName}"`);
    } catch {
      unlinkSync(zipPath);
    }
    return zipName;
  }
  return null;
}

export function getSortedTags() {
  const output = runCapture("git tag --sort=version:refname");
  return output ? output.split("\n").filter(Boolean) : [];
}

export function tagVersion(tag) {
  return tag.startsWith("v") ? tag.slice(1) : tag;
}
