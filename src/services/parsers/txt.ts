import type { Book, Chapter } from "../../types/book";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function normalize(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

// 常见章节标题规则（后面你可以继续扩展）
const CHAPTER_PATTERNS: RegExp[] = [
  /^\s*第[零一二三四五六七八九十百千万0-9]{1,9}[章节卷回]\s*.*$/u,
  /^\s*(Chapter|CHAPTER)\s+\d+.*$/u,
];

const NOTE_PATTERN = /[（(【\[]([^）)\]】]{1,48})[）)\]】]/gu;
const AUTHOR_NOTE_KEYWORDS =
  /(新书|首秀|今天|明天|五更|三更|加更|爆更|万更|求票|月票|推荐票|收藏|订阅|首订|上架|感谢|打赏|通知|请假|活动|免费|限免|更新)/u;
const KEEP_NOTE_KEYWORDS = /(大结局|完结|第[零一二三四五六七八九十百千万0-9]{1,9}卷)/u;

function isAuthorNote(note: string) {
  return AUTHOR_NOTE_KEYWORDS.test(note) && !KEEP_NOTE_KEYWORDS.test(note);
}

export function cleanChapterTitle(title: string) {
  return title
    .replace(NOTE_PATTERN, (match, note: string) => (isAuthorNote(note) ? "" : match))
    .replace(/\s+/g, " ")
    .trim();
}

function contentStartAfterHeader(text: string, headerIndex: number) {
  const newlineIndex = text.indexOf("\n", headerIndex);
  return newlineIndex === -1 ? text.length : newlineIndex + 1;
}

function findChapterHeaders(text: string) {
  const lines = text.split("\n");
  const headers: { title: string; index: number; contentStart: number }[] = [];

  let cursor = 0;
  for (const line of lines) {
    const t = line.trim();
    if (t && CHAPTER_PATTERNS.some((r) => r.test(t))) {
      headers.push({
        title: cleanChapterTitle(t),
        index: cursor,
        contentStart: contentStartAfterHeader(text, cursor),
      });
    }
    cursor += line.length + 1; // + '\n'
  }
  return headers;
}

function buildChapters(text: string): Chapter[] {
  const headers = findChapterHeaders(text);

  if (headers.length === 0) {
    return [{ id: uid(), title: "正文", start: 0, end: text.length }];
  }

  return headers.map((h, i) => {
    const next = headers[i + 1];
    return {
      id: uid(),
      title: h.title,
      start: h.contentStart,
      end: next ? next.index : text.length,
    };
  });
}

export function parseTxtContent(name: string, text: string): Book {
  const raw = normalize(text);
  return {
    id: uid(),
    title: name.replace(/\.[^.]+$/, ""),
    format: "txt",
    createdAt: Date.now(),
    rawText: raw,
    chapters: buildChapters(raw),
    progress: { updatedAt: Date.now() },
  };
}

export async function parseTxt(file: File): Promise<Book> {
  return parseTxtContent(file.name, await file.text());
}
