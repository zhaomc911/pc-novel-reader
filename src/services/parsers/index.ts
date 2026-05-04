import type { Book } from "../../types/book";
import { parseTxt, parseTxtContent } from "./txt";

export async function parseFileToBook(file: File): Promise<Book> {
  if (/\.txt$/i.test(file.name)) return await parseTxt(file);
  throw new Error(`Unsupported format: ${file.name}`);
}

export function parseTextToBook(name: string, content: string): Book {
  if (/\.txt$/i.test(name)) return parseTxtContent(name, content);
  throw new Error(`Unsupported format: ${name}`);
}
