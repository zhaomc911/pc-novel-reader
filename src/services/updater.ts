import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { isTauriRuntime } from "./desktop";

export type AppUpdateState =
  | { status: "idle" | "checking" | "latest" }
  | { status: "available"; update: Update; version: string }
  | { status: "downloading"; version: string; downloaded: number; total?: number }
  | { status: "ready"; version: string }
  | { status: "error"; message: string };

export async function checkForAppUpdate(): Promise<AppUpdateState> {
  if (!isTauriRuntime()) return { status: "idle" };

  const update = await check({ timeout: 10_000 });
  if (!update) return { status: "latest" };

  return {
    status: "available",
    update,
    version: update.version,
  };
}

export async function downloadAndInstallAppUpdate(
  update: Update,
  onState: (state: AppUpdateState) => void,
) {
  let downloaded = 0;
  let total: number | undefined;

  await update.downloadAndInstall((event: DownloadEvent) => {
    if (event.event === "Started") {
      downloaded = 0;
      total = event.data.contentLength;
    }

    if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
    }

    if (event.event === "Finished") {
      onState({ status: "ready", version: update.version });
      return;
    }

    onState({
      status: "downloading",
      version: update.version,
      downloaded,
      total,
    });
  });

  await relaunch();
}
