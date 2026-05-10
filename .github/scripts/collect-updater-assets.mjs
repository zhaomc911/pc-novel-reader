import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

const bundleDir = "src-tauri/target/release/bundle";
const releaseDir = "release-assets";
const tag = process.env.GITHUB_REF_NAME ?? "dev";
const runnerOs = process.env.RUNNER_OS ?? "";

mkdirSync(releaseDir, { recursive: true });

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function copyWithSignature(source, targetName) {
  copyFileSync(source, join(releaseDir, targetName));
  const signature = `${source}.sig`;
  if (existsSync(signature)) {
    copyFileSync(signature, join(releaseDir, `${targetName}.sig`));
  }
}

const files = walk(bundleDir);

if (runnerOs === "macOS") {
  const updater = files.find((file) => file.endsWith(".app.tar.gz"));
  if (updater) copyWithSignature(updater, `pc-novel-reader-${tag}-darwin-aarch64.app.tar.gz`);
}

if (runnerOs === "Windows") {
  const updater =
    files.find((file) => file.endsWith(".exe") && file.toLowerCase().includes("setup")) ??
    files.find((file) => file.endsWith(".exe")) ??
    files.find((file) => file.endsWith(".msi"));

  if (updater) {
    const extension = updater.endsWith(".msi") ? "msi" : "exe";
    copyWithSignature(updater, `pc-novel-reader-${tag}-windows-x86_64-setup.${extension}`);
  }
}

for (const file of readdirSync(releaseDir)) {
  console.log(`release asset: ${basename(file)}`);
}
