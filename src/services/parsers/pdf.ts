import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { Book } from "../../types/book";
import { parseTxtContent } from "./txt";

type PdfTextItem = {
  str: string;
  transform: number[];
  hasEOL?: boolean;
};

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function isTextItem(item: unknown): item is PdfTextItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    typeof (item as { str: unknown }).str === "string" &&
    "transform" in item &&
    Array.isArray((item as { transform: unknown }).transform)
  );
}

function getArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function pageTextFromItems(items: PdfTextItem[]) {
  const rows: { y: number; items: PdfTextItem[] }[] = [];
  const rowTolerance = 3;

  for (const item of items) {
    const text = item.str.trim();
    if (!text) continue;

    const y = item.transform[5] ?? 0;
    const existing = rows.find((row) => Math.abs(row.y - y) <= rowTolerance);
    if (existing) {
      existing.items.push(item);
    } else {
      rows.push({ y, items: [item] });
    }
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) =>
      row.items
        .sort((a, b) => (a.transform[4] ?? 0) - (b.transform[4] ?? 0))
        .map((item) => item.str.trim())
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean)
    .join("\n");
}

export async function parsePdfBytes(name: string, bytes: Uint8Array): Promise<Book> {
  const loadingTask = getDocument({ data: getArrayBuffer(bytes) });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = pageTextFromItems(textContent.items.filter(isTextItem) as PdfTextItem[]);
    if (pageText) pages.push(pageText);
  }

  const text = pages.join("\n\n").trim();
  if (!text) {
    throw new Error("这个 PDF 没有可提取的文字内容，可能是扫描版 PDF。");
  }

  return parseTxtContent(name, text);
}

export async function parsePdf(file: File): Promise<Book> {
  return await parsePdfBytes(file.name, new Uint8Array(await file.arrayBuffer()));
}
