import type { Book } from "../../types/book";
import { parseTxt, parseTxtBytes, parseTxtContent } from "./txt";

const PLAIN_TEXT_FILE_PATTERN = /\.(txt|text|md|markdown|log)$/i;
const PDF_FILE_PATTERN = /\.pdf$/i;
const DOCX_FILE_PATTERN = /\.docx$/i;
const EPUB_FILE_PATTERN = /\.epub$/i;
const RTF_FILE_PATTERN = /\.rtf$/i;
const HTML_FILE_PATTERN = /\.(html|htm|xhtml)$/i;
const FB2_FILE_PATTERN = /\.fb2$/i;
const ODT_FILE_PATTERN = /\.odt$/i;
const UNSUPPORTED_EBOOK_FILE_PATTERN = /\.(mobi|azw|azw3|chm|cbz|cbr)$/i;

export async function parseFileToBook(file: File): Promise<Book> {
  if (PLAIN_TEXT_FILE_PATTERN.test(file.name)) return await parseTxt(file);
  if (PDF_FILE_PATTERN.test(file.name)) {
    const { parsePdf } = await import("./pdf");
    return await parsePdf(file);
  }
  if (DOCX_FILE_PATTERN.test(file.name)) {
    const { parseDocx } = await import("./docx");
    return await parseDocx(file);
  }
  if (EPUB_FILE_PATTERN.test(file.name)) {
    const { parseEpub } = await import("./epub");
    return await parseEpub(file);
  }
  if (RTF_FILE_PATTERN.test(file.name)) {
    const { parseRtf } = await import("./rtf");
    return await parseRtf(file);
  }
  if (HTML_FILE_PATTERN.test(file.name)) {
    const { parseHtml } = await import("./markup");
    return await parseHtml(file);
  }
  if (FB2_FILE_PATTERN.test(file.name)) {
    const { parseFb2 } = await import("./markup");
    return await parseFb2(file);
  }
  if (ODT_FILE_PATTERN.test(file.name)) {
    const { parseOdt } = await import("./odt");
    return await parseOdt(file);
  }
  if (UNSUPPORTED_EBOOK_FILE_PATTERN.test(file.name)) {
    throw new Error("这个格式暂不支持解析。建议先转换为 EPUB、PDF、DOCX 或 TXT 后再导入。");
  }
  throw new Error(`Unsupported format: ${file.name}`);
}

export function parseTextToBook(name: string, content: string): Book {
  if (PLAIN_TEXT_FILE_PATTERN.test(name)) return parseTxtContent(name, content);
  throw new Error(`Unsupported format: ${name}`);
}

export async function parseBytesToBook(name: string, bytes: Uint8Array): Promise<Book> {
  if (PLAIN_TEXT_FILE_PATTERN.test(name)) return parseTxtBytes(name, bytes);
  if (PDF_FILE_PATTERN.test(name)) {
    const { parsePdfBytes } = await import("./pdf");
    return await parsePdfBytes(name, bytes);
  }
  if (DOCX_FILE_PATTERN.test(name)) {
    const { parseDocxBytes } = await import("./docx");
    return await parseDocxBytes(name, bytes);
  }
  if (EPUB_FILE_PATTERN.test(name)) {
    const { parseEpubBytes } = await import("./epub");
    return await parseEpubBytes(name, bytes);
  }
  if (RTF_FILE_PATTERN.test(name)) {
    const { parseRtfBytes } = await import("./rtf");
    return parseRtfBytes(name, bytes);
  }
  if (HTML_FILE_PATTERN.test(name)) {
    const { parseHtmlBytes } = await import("./markup");
    return parseHtmlBytes(name, bytes);
  }
  if (FB2_FILE_PATTERN.test(name)) {
    const { parseFb2Bytes } = await import("./markup");
    return parseFb2Bytes(name, bytes);
  }
  if (ODT_FILE_PATTERN.test(name)) {
    const { parseOdtBytes } = await import("./odt");
    return parseOdtBytes(name, bytes);
  }
  if (UNSUPPORTED_EBOOK_FILE_PATTERN.test(name)) {
    throw new Error("这个格式暂不支持解析。建议先转换为 EPUB、PDF、DOCX 或 TXT 后再导入。");
  }
  throw new Error(`Unsupported format: ${name}`);
}
