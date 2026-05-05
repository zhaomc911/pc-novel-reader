import type { Book } from "../../types/book";
import { parseTxt, parseTxtBytes, parseTxtContent } from "./txt";

const PLAIN_TEXT_FILE_PATTERN = /\.(txt|text|md|markdown|log)$/i;

export async function parseFileToBook(file: File): Promise<Book> {
  if (PLAIN_TEXT_FILE_PATTERN.test(file.name)) return await parseTxt(file);
  throw new Error(`Unsupported format: ${file.name}`);
}

export function parseTextToBook(name: string, content: string): Book {
  if (PLAIN_TEXT_FILE_PATTERN.test(name)) return parseTxtContent(name, content);
  throw new Error(`Unsupported format: ${name}`);
}

export function parseBytesToBook(name: string, bytes: Uint8Array): Book {
  if (PLAIN_TEXT_FILE_PATTERN.test(name)) return parseTxtBytes(name, bytes);
  throw new Error(`Unsupported format: ${name}`);
}
