import { readFileSync, writeFileSync } from "node:fs";

const tag = process.env.GITHUB_REF_NAME;
if (!tag) throw new Error("GITHUB_REF_NAME is required");

const version = tag.replace(/^v/, "");
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid release version: ${tag}`);
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
packageJson.version = version;
writeFileSync("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);

const tauriConfig = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
tauriConfig.version = version;
writeFileSync("src-tauri/tauri.conf.json", `${JSON.stringify(tauriConfig, null, 2)}\n`);

const cargoToml = readFileSync("src-tauri/Cargo.toml", "utf8").replace(
  /^version = ".+"$/m,
  `version = "${version}"`,
);
writeFileSync("src-tauri/Cargo.toml", cargoToml);

console.log(`release version set to ${version}`);
