import mammoth from "mammoth";
import type { Book } from "../../types/book";
import { parseTxtContent } from "./txt";

function getArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function parseDocxBytes(name: string, bytes: Uint8Array): Promise<Book> {
  const result = await mammoth.extractRawText({ arrayBuffer: getArrayBuffer(bytes) });
  const text = result.value.trim();

  if (!text) {
    throw new Error("这个 Word 文档没有可提取的文字内容。");
  }

  return parseTxtContent(name, text);
}

export async function parseDocx(file: File): Promise<Book> {
  return await parseDocxBytes(file.name, new Uint8Array(await file.arrayBuffer()));
}
