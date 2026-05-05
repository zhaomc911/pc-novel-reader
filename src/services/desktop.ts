import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { parseBytesToBook } from "./parsers";

const pathSeparator = /[/\\]/;

export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function fileNameFromPath(path: string) {
  return path.split(pathSeparator).pop() ?? "untitled.txt";
}

export async function importTextWithDesktopDialog() {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Text Files", extensions: ["txt", "text", "md", "markdown", "log"] }],
  });

  if (!selected || Array.isArray(selected)) return null;

  const content = await readFile(selected);
  return parseBytesToBook(fileNameFromPath(selected), content);
}

export const importTxtWithDesktopDialog = importTextWithDesktopDialog;
