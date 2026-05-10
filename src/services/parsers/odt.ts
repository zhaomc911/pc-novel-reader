import { strFromU8, unzipSync } from "fflate";
import type { Book } from "../../types/book";
import { parseTxtContent } from "./txt";

function textFromOdtXml(xmlText: string) {
  const document = new DOMParser().parseFromString(xmlText, "application/xml");
  const parserError = document.getElementsByTagName("parsererror")[0];
  if (parserError) throw new Error("ODT 文件结构解析失败。");

  const parts: string[] = [];
  for (const element of Array.from(document.getElementsByTagName("*"))) {
    const localName = element.localName.toLowerCase();
    if (["h", "p"].includes(localName)) {
      const text = element.textContent?.replace(/\s+/g, " ").trim();
      if (text) parts.push(text);
    }
  }

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function parseOdtBytes(name: string, bytes: Uint8Array): Book {
  const files = unzipSync(bytes);
  const contentXml = files["content.xml"];
  if (!contentXml) throw new Error("这个 ODT 文件缺少正文内容。");

  const text = textFromOdtXml(strFromU8(contentXml));
  if (!text) throw new Error("这个 ODT 文件没有可提取的文字内容。");
  return parseTxtContent(name, text);
}

export async function parseOdt(file: File): Promise<Book> {
  return parseOdtBytes(file.name, new Uint8Array(await file.arrayBuffer()));
}
