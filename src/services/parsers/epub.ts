import { strFromU8, unzipSync } from "fflate";
import type { Book } from "../../types/book";
import { htmlToText } from "./markup";
import { parseTxtContent } from "./txt";

function parseXml(text: string) {
  const document = new DOMParser().parseFromString(text, "application/xml");
  const parserError = document.getElementsByTagName("parsererror")[0];
  if (parserError) throw new Error("EPUB 文件结构解析失败。");
  return document;
}

function byLocalName(root: ParentNode, localName: string) {
  return Array.from(root.querySelectorAll("*")).filter((element) => element.localName === localName);
}

function joinPath(base: string, path: string) {
  if (!base) return path;
  const segments = `${base}/${path}`.split("/");
  const resolved: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") resolved.pop();
    else resolved.push(segment);
  }
  return resolved.join("/");
}

function dirname(path: string) {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

function readZipText(files: Record<string, Uint8Array>, path: string) {
  const file = files[path];
  if (!file) throw new Error(`EPUB 缺少必要文件：${path}`);
  return strFromU8(file);
}

function rootfilePath(files: Record<string, Uint8Array>) {
  const container = parseXml(readZipText(files, "META-INF/container.xml"));
  const rootfile = byLocalName(container, "rootfile")[0];
  const path = rootfile?.getAttribute("full-path");
  if (!path) throw new Error("EPUB 缺少 OPF 入口文件。");
  return path;
}

function textFromEpub(files: Record<string, Uint8Array>, opfPath: string) {
  const opf = parseXml(readZipText(files, opfPath));
  const opfDir = dirname(opfPath);
  const manifest = new Map<string, string>();

  for (const item of byLocalName(opf, "item")) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) manifest.set(id, joinPath(opfDir, href));
  }

  const spinePaths = byLocalName(opf, "itemref")
    .map((itemref) => itemref.getAttribute("idref"))
    .filter((idref): idref is string => Boolean(idref))
    .map((idref) => manifest.get(idref))
    .filter((path): path is string => Boolean(path));

  if (spinePaths.length === 0) throw new Error("EPUB 没有可读取的正文目录。");

  const pages = spinePaths
    .map((path) => files[path])
    .filter((file): file is Uint8Array => Boolean(file))
    .map((file) => htmlToText(strFromU8(file)))
    .filter(Boolean);

  const title = byLocalName(opf, "title")[0]?.textContent?.trim();
  return { title, text: pages.join("\n\n").trim() };
}

export async function parseEpubBytes(name: string, bytes: Uint8Array): Promise<Book> {
  const files = unzipSync(bytes);
  const { title, text } = textFromEpub(files, rootfilePath(files));

  if (!text) throw new Error("这个 EPUB 没有可提取的文字内容。");

  const book = parseTxtContent(name, text);
  return title ? { ...book, title } : book;
}

export async function parseEpub(file: File): Promise<Book> {
  return await parseEpubBytes(file.name, new Uint8Array(await file.arrayBuffer()));
}
