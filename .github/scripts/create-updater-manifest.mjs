import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const releaseDir = process.env.RELEASE_DIR ?? "release-assets";
const tag = process.env.GITHUB_REF_NAME;
const repo = process.env.GITHUB_REPOSITORY;

if (!tag || !repo) {
  throw new Error("GITHUB_REF_NAME and GITHUB_REPOSITORY are required to create latest.json");
}

const version = tag.replace(/^v/, "");
const files = readdirSync(releaseDir);

function assetUrl(fileName) {
  return `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(fileName)}`;
}

function findAsset(pattern) {
  return files.find((file) => pattern.test(file) && !file.endsWith(".sig"));
}

function platformEntry(pattern) {
  const asset = findAsset(pattern);
  if (!asset) return null;

  const signaturePath = join(releaseDir, `${asset}.sig`);
  const signature = readFileSync(signaturePath, "utf8").trim();
  return {
    signature,
    url: assetUrl(asset),
  };
}

const platforms = {
  "darwin-aarch64": platformEntry(/darwin-aarch64\.app\.tar\.gz$/),
  "windows-x86_64": platformEntry(/windows-x86_64-setup\.(exe|msi)$/),
};

for (const [platform, entry] of Object.entries(platforms)) {
  if (!entry) throw new Error(`Missing updater asset for ${platform}`);
}

const manifest = {
  version,
  notes: `PC Novel Reader ${tag}`,
  pub_date: new Date().toISOString(),
  platforms,
};

writeFileSync(join(releaseDir, "latest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log("created release-assets/latest.json");
