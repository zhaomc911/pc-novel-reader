import type { Book } from "../../types/book";
import { decodeTxtBytes, parseTxtContent } from "./txt";

const DESTINATIONS_TO_SKIP = new Set([
  "fonttbl",
  "colortbl",
  "datastore",
  "themedata",
  "stylesheet",
  "info",
  "pict",
  "object",
  "header",
  "footer",
  "annotation",
]);

function signedUnicode(value: number) {
  const codePoint = value < 0 ? value + 65536 : value;
  return String.fromCharCode(codePoint);
}

function hexToChar(hex: string) {
  return String.fromCharCode(Number.parseInt(hex, 16));
}

function rtfToText(rtf: string) {
  const output: string[] = [];
  const stack: boolean[] = [];
  let skipDepth = 0;

  for (let i = 0; i < rtf.length; i += 1) {
    const char = rtf[i];
    if (char === undefined) break;

    if (char === "{") {
      stack.push(skipDepth > 0);
      if (skipDepth > 0) skipDepth += 1;
      continue;
    }

    if (char === "}") {
      const parentSkipped = stack.pop() ?? false;
      if (skipDepth > 0) skipDepth -= 1;
      if (skipDepth === 0 && parentSkipped) skipDepth = 0;
      continue;
    }

    if (char !== "\\") {
      if (skipDepth === 0) output.push(char);
      continue;
    }

    const next = rtf[i + 1];
    if (next === "\\" || next === "{" || next === "}") {
      if (skipDepth === 0) output.push(next);
      i += 1;
      continue;
    }

    if (next === "'") {
      const hex = rtf.slice(i + 2, i + 4);
      if (skipDepth === 0 && /^[0-9a-f]{2}$/i.test(hex)) output.push(hexToChar(hex));
      i += 3;
      continue;
    }

    const match = rtf.slice(i + 1).match(/^([a-zA-Z]+)(-?\d+)? ?/);
    if (!match) continue;

    const control = match[1] ?? "";
    const parameter = match[2];
    i += match[0].length;

    if (DESTINATIONS_TO_SKIP.has(control)) {
      skipDepth = Math.max(1, skipDepth);
      continue;
    }

    if (skipDepth > 0) continue;

    if (control === "par" || control === "line") {
      output.push("\n");
    } else if (control === "tab") {
      output.push(" ");
    } else if (control === "u" && parameter) {
      output.push(signedUnicode(Number.parseInt(parameter, 10)));
      if (rtf[i + 1] && rtf[i + 1] !== "\\" && rtf[i + 1] !== "{" && rtf[i + 1] !== "}") i += 1;
    }
  }

  return output
    .join("")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseRtfBytes(name: string, bytes: Uint8Array): Book {
  const text = rtfToText(decodeTxtBytes(bytes));
  if (!text) throw new Error("这个 RTF 文件没有可提取的文字内容。");
  return parseTxtContent(name, text);
}

export async function parseRtf(file: File): Promise<Book> {
  return parseRtfBytes(file.name, new Uint8Array(await file.arrayBuffer()));
}
