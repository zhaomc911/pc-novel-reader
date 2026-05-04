import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { parseTextToBook } from "./parsers";

const pathSeparator = /[/\\]/;

export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function fileNameFromPath(path: string) {
  return path.split(pathSeparator).pop() ?? "untitled.txt";
}

export async function importTxtWithDesktopDialog() {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Text Novel", extensions: ["txt"] }],
  });

  if (!selected || Array.isArray(selected)) return null;

  const content = await readTextFile(selected);
  return parseTextToBook(fileNameFromPath(selected), content);
}
