import type { Book } from "../../types/book";
import { decodeTxtBytes, parseTxtContent } from "./txt";

const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "body",
  "br",
  "dd",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

const SKIP_TAGS = new Set(["script", "style", "noscript", "template"]);

function textFromNode(node: Node, parts: string[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.replace(/\s+/g, " ").trim();
    if (text) parts.push(text);
    return;
  }

  if (!(node instanceof Element)) {
    node.childNodes.forEach((child) => textFromNode(child, parts));
    return;
  }

  const tagName = node.tagName.toLowerCase();
  if (SKIP_TAGS.has(tagName)) return;
  if (tagName === "br") {
    parts.push("\n");
    return;
  }

  const isBlock = BLOCK_TAGS.has(tagName);
  if (isBlock) parts.push("\n");
  node.childNodes.forEach((child) => textFromNode(child, parts));
  if (isBlock) parts.push("\n");
}

export function htmlToText(html: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const parts: string[] = [];
  textFromNode(document.body, parts);
  return parts
    .join(" ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function xmlTextToLines(element: Element) {
  const parts: string[] = [];
  textFromXmlNode(element, parts);
  return parts
    .join(" ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function textFromXmlNode(node: Node, parts: string[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.replace(/\s+/g, " ").trim();
    if (text) parts.push(text);
    return;
  }

  if (!(node instanceof Element)) return;

  const tagName = node.localName.toLowerCase();
  if (tagName === "binary") return;
  if (["title", "subtitle", "p", "section", "empty-line"].includes(tagName)) parts.push("\n");
  node.childNodes.forEach((child) => textFromXmlNode(child, parts));
  if (["title", "subtitle", "p", "section"].includes(tagName)) parts.push("\n");
}

function getFirstElementText(document: Document, localName: string) {
  return Array.from(document.getElementsByTagName("*"))
    .find((element) => element.localName === localName)
    ?.textContent?.trim();
}

export function parseHtmlBytes(name: string, bytes: Uint8Array): Book {
  const text = htmlToText(decodeTxtBytes(bytes));
  if (!text) throw new Error("这个 HTML 文件没有可提取的文字内容。");
  return parseTxtContent(name, text);
}

export async function parseHtml(file: File): Promise<Book> {
  return parseHtmlBytes(file.name, new Uint8Array(await file.arrayBuffer()));
}

export function parseFb2Bytes(name: string, bytes: Uint8Array): Book {
  const xml = new DOMParser().parseFromString(decodeTxtBytes(bytes), "application/xml");
  const parserError = xml.getElementsByTagName("parsererror")[0];
  if (parserError) throw new Error("这个 FB2 文件解析失败，可能不是有效的 FictionBook 文件。");

  const bodies = Array.from(xml.getElementsByTagName("*")).filter(
    (element) => element.localName === "body",
  );
  const text = bodies.map(xmlTextToLines).filter(Boolean).join("\n\n").trim();
  if (!text) throw new Error("这个 FB2 文件没有可提取的文字内容。");

  const book = parseTxtContent(name, text);
  const title = getFirstElementText(xml, "book-title");
  return title ? { ...book, title } : book;
}

export async function parseFb2(file: File): Promise<Book> {
  return parseFb2Bytes(file.name, new Uint8Array(await file.arrayBuffer()));
}
