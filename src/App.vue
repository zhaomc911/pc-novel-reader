<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import type { Book, Chapter } from "./types/book";
import { listBooks, removeBook, saveBook, updateBookState } from "./services/storage";
import { cleanChapterTitle } from "./services/parsers/txt";
import { importTextWithDesktopDialog, isTauriRuntime } from "./services/desktop";
import { selectReadingQuote } from "./services/quotes";
import {
  checkForAppUpdate,
  downloadAndInstallAppUpdate,
  type AppUpdateState,
} from "./services/updater";

type AppView = "library" | "reader";
type ReadingTheme = "paper" | "eye" | "sepia" | "dark";
type ReadingFont = "system" | "serif" | "songti" | "kaiti" | "fangsong" | "yuanti" | "hei" | "mono";
type ReadingSettings = {
  fontSize: number;
  lineHeight: number;
  pageWidth: number;
  theme: ReadingTheme;
  font: ReadingFont;
};
type BookDraft = {
  title: string;
  author: string;
  category: string;
  coverText: string;
};
type SearchResult = {
  id: string;
  chapterId: string;
  chapterTitle: string;
  index: number;
  snippet: string;
};
type ReaderSession = {
  view: AppView;
  bookId?: string;
  chapterId?: string;
  scrollTop?: number;
  preserveProgress?: boolean;
};

const READER_SESSION_KEY = "pc-novel-reader:last-session";
const READING_SETTINGS_KEY = "pc-novel-reader:reading-settings";
const DEFAULT_READING_SETTINGS: ReadingSettings = {
  fontSize: 19,
  lineHeight: 2,
  pageWidth: 980,
  theme: "paper",
  font: "system",
};
const FONT_FAMILIES: Record<ReadingFont, string> = {
  system: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", "Noto Serif SC", "Source Han Serif SC", serif',
  songti: '"Songti SC", "SimSun", "Noto Serif SC", serif',
  kaiti: '"Kaiti SC", "KaiTi", "STKaiti", "Noto Serif SC", serif',
  fangsong: '"STFangsong", "FangSong", "FangSong_GB2312", "Noto Serif SC", serif',
  yuanti: '"Yuanti SC", "YouYuan", "Microsoft YaHei", sans-serif',
  hei: 'Inter, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
};

const books = ref<Book[]>([]);
const activeBook = ref<Book | null>(null);
const activeChapterId = ref<string | null>(null);
const appView = ref<AppView>("library");
const chapterListCollapsed = ref(false);
const chapterContentRef = ref<HTMLElement | null>(null);
const busy = ref(false);
const error = ref("");
const notice = ref("");
const desktopRuntime = isTauriRuntime();
const selectedText = ref("");
const noteDraftOpen = ref(false);
const noteDraftText = ref("");
const selectionToolbar = ref({ visible: false, top: 0, left: 0 });
const browsingSavedMark = ref(false);
const readingSettingsOpen = ref(false);
const searchPanelOpen = ref(false);
const searchQuery = ref("");
const editingBookId = ref<string | null>(null);
const bookDraft = ref<BookDraft>({ title: "", author: "", category: "", coverText: "" });
let progressSaveTimer: number | null = null;
let noticeTimer: number | null = null;

const readingQuote = ref(selectReadingQuote());
const appUpdateState = shallowRef<AppUpdateState>({ status: "idle" });
const readingSettings = ref(loadReadingSettings());

const greetingText = computed(() => {
  const hour = new Date().getHours();
  if (hour < 5) return "深夜好";
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  if (hour < 23) return "晚上好";
  return "夜深了";
});

const latestProgressBook = computed(() => {
  return books.value
    .filter((book) => book.progress?.chapterId)
    .sort((a, b) => (b.progress?.updatedAt ?? 0) - (a.progress?.updatedAt ?? 0))[0];
});

const latestProgressText = computed(() => {
  const book = latestProgressBook.value;
  if (!book) return "从书架选择一本书，开始今天的阅读";
  return `最近读到：《${book.title}》 · ${getBookProgressShortLabel(book)} · ${getBookProgressPercent(book)}%`;
});

const recentBookmarks = computed(() =>
  books.value
    .flatMap((book) =>
      (book.bookmarks ?? []).map((bookmark) => ({
        ...bookmark,
        bookId: book.id,
        bookTitle: book.title,
      })),
    )
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 6),
);

const recentNotes = computed(() =>
  books.value
    .flatMap((book) =>
      (book.notes ?? []).map((note) => ({
        ...note,
        bookId: book.id,
        bookTitle: book.title,
      })),
    )
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 6),
);

const activeChapter = computed(() => {
  const chapters = activeBook.value?.chapters ?? [];
  return chapters.find((chapter) => chapter.id === activeChapterId.value) ?? chapters[0] ?? null;
});

const activeChapterIndex = computed(() => {
  const chapters = activeBook.value?.chapters ?? [];
  return chapters.findIndex((chapter) => chapter.id === activeChapter.value?.id);
});

const previousChapter = computed(() => {
  const chapters = activeBook.value?.chapters ?? [];
  const index = activeChapterIndex.value;
  return index > 0 ? chapters[index - 1] : null;
});

const nextChapter = computed(() => {
  const chapters = activeBook.value?.chapters ?? [];
  const index = activeChapterIndex.value;
  return index >= 0 && index + 1 < chapters.length ? chapters[index + 1] : null;
});

const chapterText = computed(() => {
  const book = activeBook.value;
  const chapter = activeChapter.value;
  if (!book?.rawText || !chapter) return "";
  return stripLeadingChapterHeading(book.rawText.slice(chapter.start, chapter.end), chapter).trim();
});

const chapterParagraphs = computed(() =>
  chapterText.value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean),
);

const searchResults = computed<SearchResult[]>(() => {
  const book = activeBook.value;
  const query = searchQuery.value.trim();
  if (!book?.rawText || !query) return [];

  const raw = book.rawText;
  const lowerRaw = raw.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const chapter of book.chapters ?? []) {
    let cursor = chapter.start;
    while (cursor < chapter.end && results.length < 80) {
      const index = lowerRaw.indexOf(lowerQuery, cursor);
      if (index === -1 || index >= chapter.end) break;
      results.push({
        id: `${chapter.id}-${index}`,
        chapterId: chapter.id,
        chapterTitle: displayChapterTitle(chapter),
        index,
        snippet: makeSearchSnippet(raw, index, query.length),
      });
      cursor = index + Math.max(1, query.length);
    }
    if (results.length >= 80) break;
  }

  return results;
});

const activeChapterTitle = computed(() =>
  activeChapter.value ? displayChapterTitle(activeChapter.value) : "",
);

const activeBookmark = computed(() => {
  const chapterId = activeChapter.value?.id;
  if (!chapterId) return null;
  return activeBook.value?.bookmarks?.find((bookmark) => bookmark.chapterId === chapterId) ?? null;
});

const appUpdateProgressText = computed(() => {
  if (appUpdateState.value.status !== "downloading") return "";
  const { downloaded, total } = appUpdateState.value;
  if (!total) return "正在下载更新...";
  return `正在下载更新 ${Math.min(100, Math.round((downloaded / total) * 100))}%`;
});

const readerPageClass = computed(() => `reader-theme-${readingSettings.value.theme}`);

const chapterContentStyle = computed(() => ({
  maxWidth: `${readingSettings.value.pageWidth}px`,
  "--reader-font-size": `${readingSettings.value.fontSize}px`,
  "--reader-line-height": String(readingSettings.value.lineHeight),
  "--reader-font-family": FONT_FAMILIES[readingSettings.value.font],
}));

const readUntilChapterIndex = computed(() => {
  const book = activeBook.value;
  if (!book?.progress?.chapterId) return -1;
  return (book.chapters ?? []).findIndex((chapter) => chapter.id === book.progress?.chapterId);
});

function getBookProgressIndex(book: Book) {
  const chapters = book.chapters ?? [];
  const chapterId = book.progress?.chapterId;
  if (!chapterId || chapters.length === 0) return -1;
  return chapters.findIndex((chapter) => chapter.id === chapterId);
}

function getBookProgressPercent(book: Book) {
  const chapters = book.chapters ?? [];
  const index = getBookProgressIndex(book);
  if (index < 0 || chapters.length === 0) return 0;
  return Math.min(100, Math.round(((index + 1) / chapters.length) * 100));
}

function getBookProgressLabel(book: Book) {
  const chapters = book.chapters ?? [];
  const index = getBookProgressIndex(book);
  const chapter = index >= 0 ? chapters[index] : null;
  return chapter ? `读到：${getChapterNumberLabel(chapter, index)}` : "尚未开始阅读";
}

function getBookProgressShortLabel(book: Book) {
  const chapters = book.chapters ?? [];
  const index = getBookProgressIndex(book);
  const chapter = index >= 0 ? chapters[index] : null;
  return chapter ? getChapterNumberLabel(chapter, index) : "尚未开始";
}

function getChapterNumberLabel(chapter: Chapter, index: number) {
  const title = displayChapterTitle(chapter);
  const match = title.match(/^第[零一二三四五六七八九十百千万0-9]{1,9}[章节卷回]/u);
  return match?.[0] ?? `第 ${index + 1} 章`;
}

function isChapterRead(chapterIndex: number) {
  return readUntilChapterIndex.value >= 0 && chapterIndex <= readUntilChapterIndex.value;
}

function displayChapterTitle(chapter: Chapter) {
  return cleanChapterTitle(chapter.title);
}

function normalizeTitle(value: string) {
  return cleanChapterTitle(value).replace(/\s+/g, "");
}

function stripLeadingChapterHeading(text: string, chapter: Chapter) {
  const lines = text.replace(/^\s+/, "").split("\n");
  const firstLine = lines[0]?.trim();
  if (!firstLine) return text;

  const firstLineTitle = normalizeTitle(firstLine);
  const chapterTitle = normalizeTitle(chapter.title);
  if (firstLineTitle === chapterTitle || normalizeTitle(cleanChapterTitle(firstLine)) === chapterTitle) {
    return lines.slice(1).join("\n");
  }

  return text;
}

function cloneBook(book: Book): Book {
  return {
    ...book,
    progress: book.progress ? { ...book.progress } : undefined,
    bookmarks: book.bookmarks ? book.bookmarks.map((bookmark) => ({ ...bookmark })) : undefined,
    notes: book.notes ? book.notes.map((note) => ({ ...note })) : undefined,
  };
}

function upsertBookInMemory(book: Book) {
  const nextBook = cloneBook(book);
  const index = books.value.findIndex((item) => item.id === nextBook.id);
  if (index >= 0) {
    books.value.splice(index, 1, nextBook);
  } else {
    books.value.unshift(nextBook);
  }
  if (activeBook.value?.id === nextBook.id) activeBook.value = nextBook;
  return nextBook;
}

function saveReaderSession(
  view: AppView = appView.value,
  book: Book | null = activeBook.value,
  chapterId: string | null = activeChapterId.value ?? activeChapter.value?.id ?? null,
  scrollTop = chapterContentRef.value?.scrollTop ?? book?.progress?.scrollTop ?? 0,
) {
  const session: ReaderSession = { view };
  if (view === "reader" && book) {
    session.bookId = book.id;
    session.chapterId = chapterId ?? undefined;
    session.scrollTop = scrollTop;
    session.preserveProgress = browsingSavedMark.value;
  }
  localStorage.setItem(READER_SESSION_KEY, JSON.stringify(session));
}

function loadReaderSession() {
  try {
    const value = localStorage.getItem(READER_SESSION_KEY);
    return value ? (JSON.parse(value) as ReaderSession) : null;
  } catch {
    return null;
  }
}

function loadReadingSettings(): ReadingSettings {
  try {
    const saved = localStorage.getItem(READING_SETTINGS_KEY);
    if (!saved) return { ...DEFAULT_READING_SETTINGS };
    return normalizeReadingSettings(JSON.parse(saved));
  } catch {
    return { ...DEFAULT_READING_SETTINGS };
  }
}

function normalizeReadingSettings(value: Partial<ReadingSettings>): ReadingSettings {
  const fontSize = Number(value.fontSize);
  const lineHeight = Number(value.lineHeight);
  const pageWidth = Number(value.pageWidth);
  return {
    fontSize: Number.isFinite(fontSize) ? Math.min(28, Math.max(15, fontSize)) : DEFAULT_READING_SETTINGS.fontSize,
    lineHeight: Number.isFinite(lineHeight)
      ? Math.min(2.8, Math.max(1.5, lineHeight))
      : DEFAULT_READING_SETTINGS.lineHeight,
    pageWidth: Number.isFinite(pageWidth) ? Math.min(1280, Math.max(680, pageWidth)) : DEFAULT_READING_SETTINGS.pageWidth,
    theme: ["paper", "eye", "sepia", "dark"].includes(value.theme ?? "")
      ? (value.theme as ReadingTheme)
      : DEFAULT_READING_SETTINGS.theme,
    font: ["system", "serif", "songti", "kaiti", "fangsong", "yuanti", "hei", "mono"].includes(value.font ?? "")
      ? (value.font as ReadingFont)
      : DEFAULT_READING_SETTINGS.font,
  };
}

function saveReadingSettings() {
  localStorage.setItem(READING_SETTINGS_KEY, JSON.stringify(readingSettings.value));
}

function resetReadingSettings() {
  readingSettings.value = { ...DEFAULT_READING_SETTINGS };
}

function showNotice(message: string) {
  notice.value = message;
  if (noticeTimer !== null) window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    notice.value = "";
    noticeTimer = null;
  }, 3600);
}

function formatImportError(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason);

  if (/扫描版 PDF|这个 PDF 没有可提取/u.test(message)) {
    return "导入失败：没有识别到可阅读的文字。\n如果这是扫描版 PDF 或图片型文件，目前暂不支持 OCR。可以先用带 OCR 的工具转换成可复制文字的 PDF、DOCX 或 TXT。";
  }

  if (/没有可提取的文字内容/u.test(message)) {
    return `导入失败：这个文件里没有识别到可阅读文字。\n${message}\n可以尝试重新导出文件，或转换为 TXT、DOCX、EPUB 后再导入。`;
  }

  if (/password|encrypted|密码|加密|protected/i.test(message)) {
    return "导入失败：这个文件可能受到密码或权限保护。\n请先解除密码保护，或导出为普通 PDF、DOCX、TXT 后再导入。";
  }

  if (/EPUB|OPF|spine|FictionBook|FB2|ODT|RTF|Word|DOCX|HTML/u.test(message)) {
    return `导入失败：文件结构无法完整解析。\n${message}\n可以尝试重新导出文件，或转换为 EPUB、PDF、DOCX、TXT 后再导入。`;
  }

  if (/Unsupported format|暂不支持/u.test(message)) {
    return "导入失败：暂不支持这个文件格式。\n目前建议使用 TXT、Markdown、PDF、DOCX、EPUB、RTF、HTML、FB2 或 ODT。";
  }

  return `导入失败：暂时无法读取这个文件。\n${message}`;
}

function formatGeneralError(reason: unknown) {
  return reason instanceof Error ? reason.message : String(reason);
}

function resetNoteUi() {
  selectedText.value = "";
  noteDraftOpen.value = false;
  noteDraftText.value = "";
  selectionToolbar.value = { visible: false, top: 0, left: 0 };
}

function normalizeBookTitle(value: string) {
  return value.replace(/\.[^.]+$/, "").replace(/\s+/g, "").trim().toLowerCase();
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function createBookFingerprint(book: Book) {
  const raw = book.rawText ?? "";
  const sample =
    raw.length > 8000
      ? `${raw.slice(0, 4000)}${raw.slice(Math.floor(raw.length / 2), Math.floor(raw.length / 2) + 2000)}${raw.slice(-2000)}`
      : raw;
  return stableHash(`${book.format}|${raw.length}|${sample}`);
}

function isLegacyDuplicate(existing: Book, imported: Book) {
  const existingRaw = existing.rawText ?? "";
  const importedRaw = imported.rawText ?? "";
  if (!existingRaw || !importedRaw) return false;
  return (
    normalizeBookTitle(existing.title) === normalizeBookTitle(imported.title) &&
    existing.format === imported.format &&
    existingRaw.length === importedRaw.length
  );
}

function findDuplicateBook(imported: Book) {
  const contentHash = imported.contentHash ?? createBookFingerprint(imported);
  return books.value.find(
    (book) =>
      book.contentHash === contentHash ||
      createBookFingerprint(book) === contentHash ||
      isLegacyDuplicate(book, imported),
  );
}

function coverTextForBook(book: Book) {
  return (book.coverText || book.title.slice(0, 1) || "书").slice(0, 2);
}

function makeSearchSnippet(text: string, index: number, length: number) {
  const start = Math.max(0, index - 34);
  const end = Math.min(text.length, index + length + 46);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`;
}

async function refreshBooks() {
  books.value = await listBooks();
  if (activeBook.value) {
    activeBook.value = books.value.find((book) => book.id === activeBook.value?.id) ?? activeBook.value;
  }
}

function openBook(book: Book) {
  resetNoteUi();
  browsingSavedMark.value = false;
  activeBook.value = book;
  activeChapterId.value = book.progress?.chapterId ?? book.chapters?.[0]?.id ?? null;
  appView.value = "reader";
  saveReaderSession("reader", book, activeChapterId.value, book.progress?.scrollTop ?? 0);
  void restoreReadingPosition(book.progress?.scrollTop ?? 0);
}

async function openBookmark(bookId: string, chapterId: string, scrollTop: number) {
  const book = books.value.find((item) => item.id === bookId);
  if (!book) return;

  resetNoteUi();
  activeBook.value = book;
  activeChapterId.value = chapterId;
  appView.value = "reader";
  browsingSavedMark.value = true;
  saveReaderSession("reader", book, chapterId, scrollTop);
  await restoreReadingPosition(scrollTop);
}

async function openNote(bookId: string, chapterId: string, scrollTop: number) {
  const book = books.value.find((item) => item.id === bookId);
  if (!book) return;

  resetNoteUi();
  activeBook.value = book;
  activeChapterId.value = chapterId;
  appView.value = "reader";
  browsingSavedMark.value = true;
  saveReaderSession("reader", book, chapterId, scrollTop);
  await restoreReadingPosition(scrollTop);
}

function openLibrary() {
  resetNoteUi();
  if (!browsingSavedMark.value) void saveReadingProgress();
  appView.value = "library";
  saveReaderSession("library", null, null, 0);
}

async function persistAndOpen(book: Book) {
  if (activeBook.value && !browsingSavedMark.value) await saveReadingProgress();
  const preparedBook = {
    ...book,
    contentHash: book.contentHash ?? createBookFingerprint(book),
  };
  const duplicate = findDuplicateBook(preparedBook);
  if (duplicate) {
    showNotice(`已识别到《${duplicate.title}》在书架中，已为你打开原有书籍。`);
    openBook(duplicate);
    return;
  }

  await saveBook(preparedBook);
  const saved = upsertBookInMemory(preparedBook);
  showNotice(`已导入《${saved.title}》。`);
  openBook(saved);
}

async function importDesktopFile() {
  await withBusy(
    async () => {
      const book = await importTextWithDesktopDialog();
      if (book) await persistAndOpen(book);
    },
    formatImportError,
  );
}

async function openSearchResult(result: SearchResult) {
  const book = activeBook.value;
  const chapter = book?.chapters?.find((item) => item.id === result.chapterId);
  if (!book || !chapter) return;

  browsingSavedMark.value = false;
  resetNoteUi();
  activeChapterId.value = chapter.id;
  appView.value = "reader";
  await nextTick();

  const contentElement = chapterContentRef.value;
  const ratio = chapter.end > chapter.start ? (result.index - chapter.start) / (chapter.end - chapter.start) : 0;
  const scrollTop = contentElement
    ? Math.max(0, Math.round((contentElement.scrollHeight - contentElement.clientHeight) * ratio))
    : 0;

  await restoreReadingPosition(scrollTop);
  searchPanelOpen.value = false;
  const updatedBook = upsertBookInMemory({
    ...book,
    progress: {
      ...book.progress,
      chapterId: chapter.id,
      scrollTop,
      updatedAt: Date.now(),
    },
  });
  saveReaderSession("reader", updatedBook, chapter.id, scrollTop);
  void updateBookState(updatedBook.id, { progress: updatedBook.progress });
}

function openBookEditor(book: Book) {
  editingBookId.value = book.id;
  bookDraft.value = {
    title: book.title,
    author: book.author ?? "",
    category: book.category ?? "",
    coverText: coverTextForBook(book),
  };
}

function closeBookEditor() {
  editingBookId.value = null;
  bookDraft.value = { title: "", author: "", category: "", coverText: "" };
}

async function saveBookDetails() {
  const book = books.value.find((item) => item.id === editingBookId.value);
  if (!book) return;

  const draft = bookDraft.value;
  const updatedBook = upsertBookInMemory({
    ...book,
    title: draft.title.trim() || book.title,
    author: draft.author.trim() || undefined,
    category: draft.category.trim() || undefined,
    coverText: draft.coverText.trim().slice(0, 2) || undefined,
  });
  await saveBook(updatedBook);
  showNotice("书籍信息已更新。");
  closeBookEditor();
}

async function selectChapter(chapter: Chapter) {
  const book = activeBook.value;
  if (!book) return;
  if (activeChapterId.value === chapter.id) return;

  browsingSavedMark.value = false;
  resetNoteUi();
  activeChapterId.value = chapter.id;
  const updatedBook = upsertBookInMemory({
    ...book,
    progress: {
      ...book.progress,
      chapterId: chapter.id,
      scrollTop: 0,
      updatedAt: Date.now(),
    },
  });
  appView.value = "reader";
  saveReaderSession("reader", updatedBook, chapter.id, 0);
  await restoreReadingPosition(0);
  void updateBookState(updatedBook.id, { progress: updatedBook.progress });
}

async function goToPreviousChapter() {
  if (previousChapter.value) await selectChapter(previousChapter.value);
}

async function goToNextChapter() {
  if (nextChapter.value) await selectChapter(nextChapter.value);
}

async function toggleBookmark() {
  const book = activeBook.value;
  const chapter = activeChapter.value;
  if (!book || !chapter) return;

  const bookmarks = book.bookmarks ?? [];
  const existing = bookmarks.find((bookmark) => bookmark.chapterId === chapter.id);
  const nextBookmarks = existing
    ? bookmarks.filter((bookmark) => bookmark.id !== existing.id)
    : [
        {
          id: `${chapter.id}-${Date.now()}`,
          chapterId: chapter.id,
          chapterTitle: displayChapterTitle(chapter),
          scrollTop: chapterContentRef.value?.scrollTop ?? 0,
          createdAt: Date.now(),
        },
        ...bookmarks,
      ];

  const updatedBook = upsertBookInMemory({
    ...book,
    bookmarks: nextBookmarks,
  });
  saveReaderSession("reader", updatedBook, activeChapterId.value, chapterContentRef.value?.scrollTop ?? 0);
  await updateBookState(updatedBook.id, { bookmarks: nextBookmarks });
}

function updateSelectedText() {
  const selection = window.getSelection();
  const contentElement = chapterContentRef.value;
  if (!selection || selection.isCollapsed || !contentElement || selection.rangeCount === 0) {
    selectedText.value = "";
    selectionToolbar.value = { visible: false, top: 0, left: 0 };
    return;
  }

  const range = selection.getRangeAt(0);
  const container =
    range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentElement
      : range.commonAncestorContainer;

  if (!(container instanceof Node) || !contentElement.contains(container)) {
    selectedText.value = "";
    selectionToolbar.value = { visible: false, top: 0, left: 0 };
    return;
  }

  selectedText.value = selection.toString().replace(/\s+/g, " ").trim().slice(0, 500);
  const rect = range.getBoundingClientRect();
  selectionToolbar.value = {
    visible: Boolean(selectedText.value),
    top: Math.max(12, rect.top - 48),
    left: Math.min(window.innerWidth - 132, Math.max(12, rect.left + rect.width / 2 - 58)),
  };
}

function openNoteDraft() {
  if (!selectedText.value) updateSelectedText();
  if (!selectedText.value) return;
  noteDraftText.value = "";
  noteDraftOpen.value = true;
  selectionToolbar.value = { visible: false, top: 0, left: 0 };
}

function closeNoteDraft() {
  noteDraftOpen.value = false;
  noteDraftText.value = "";
  selectedText.value = "";
  window.getSelection()?.removeAllRanges();
}

async function saveNoteDraft() {
  const highlightedText = selectedText.value;
  const book = activeBook.value;
  const chapter = activeChapter.value;
  if (!book || !chapter || !highlightedText) return;

  const notes = book.notes ?? [];
  const updatedBook = upsertBookInMemory({
    ...book,
    notes: [
      {
        id: `${chapter.id}-note-${Date.now()}`,
        chapterId: chapter.id,
        chapterTitle: displayChapterTitle(chapter),
        selectedText: highlightedText,
        content: noteDraftText.value.trim(),
        scrollTop: chapterContentRef.value?.scrollTop ?? 0,
        createdAt: Date.now(),
      },
      ...notes,
    ],
  });

  saveReaderSession("reader", updatedBook, activeChapterId.value, chapterContentRef.value?.scrollTop ?? 0);
  closeNoteDraft();
  void updateBookState(updatedBook.id, { notes: updatedBook.notes });
}

async function deleteNote(bookId: string, noteId: string) {
  const book = books.value.find((item) => item.id === bookId);
  if (!book) return;

  const nextNotes = (book.notes ?? []).filter((note) => note.id !== noteId);
  const updatedBook = upsertBookInMemory({
    ...book,
    notes: nextNotes,
  });
  await updateBookState(updatedBook.id, { notes: nextNotes });
}

async function restoreReadingPosition(scrollTop: number) {
  await nextTick();
  if (!chapterContentRef.value) return;
  chapterContentRef.value.scrollTop = scrollTop;
}

async function saveReadingProgress() {
  if (browsingSavedMark.value) return;
  const book = activeBook.value;
  const chapterId = activeChapterId.value ?? activeChapter.value?.id;
  if (!book || !chapterId) return;

  const scrollTop = chapterContentRef.value?.scrollTop ?? book.progress?.scrollTop ?? 0;
  const progress = {
    ...book.progress,
    chapterId,
    scrollTop,
    updatedAt: Date.now(),
  };
  saveReaderSession("reader", book, chapterId, scrollTop);
  await updateBookState(book.id, { progress });
}

function queueReadingProgressSave() {
  if (browsingSavedMark.value) return;
  selectionToolbar.value = { visible: false, top: 0, left: 0 };
  if (progressSaveTimer !== null) window.clearTimeout(progressSaveTimer);
  saveReaderSession();
  progressSaveTimer = window.setTimeout(() => {
    progressSaveTimer = null;
    void saveReadingProgress();
  }, 600);
}

async function deleteBook(book: Book) {
  await withBusy(async () => {
    await removeBook(book.id);
    books.value = books.value.filter((item) => item.id !== book.id);
    if (activeBook.value?.id === book.id) {
      activeBook.value = null;
      activeChapterId.value = null;
      appView.value = "library";
      saveReaderSession("library", null, null, 0);
    }
  });
}

async function restoreLastSession() {
  await refreshBooks();
  const session = loadReaderSession();
  if (session?.view !== "reader" || !session.bookId) return;

  const book = books.value.find((item) => item.id === session.bookId);
  if (!book) return;

  activeBook.value = book;
  activeChapterId.value = session.chapterId ?? book.progress?.chapterId ?? book.chapters?.[0]?.id ?? null;
  appView.value = "reader";
  browsingSavedMark.value = session.preserveProgress ?? false;
  await restoreReadingPosition(session.scrollTop ?? book.progress?.scrollTop ?? 0);
}

async function withBusy(task: () => Promise<void>, formatError = formatGeneralError) {
  busy.value = true;
  error.value = "";
  try {
    await task();
  } catch (reason) {
    error.value = formatError(reason);
  } finally {
    busy.value = false;
  }
}

async function checkUpdatesQuietly() {
  if (!desktopRuntime) return;
  try {
    const state = await checkForAppUpdate();
    if (state.status === "available") appUpdateState.value = state;
  } catch (reason) {
    console.warn("Failed to check for updates", reason);
  }
}

async function installAvailableUpdate() {
  const state = appUpdateState.value;
  if (state.status !== "available") return;

  try {
    await downloadAndInstallAppUpdate(state.update, (nextState) => {
      appUpdateState.value = nextState;
    });
  } catch (reason) {
    appUpdateState.value = {
      status: "error",
      message: reason instanceof Error ? reason.message : "更新失败，请稍后重试。",
    };
  }
}

function dismissUpdateNotice() {
  appUpdateState.value = { status: "idle" };
}

onMounted(() => {
  void restoreLastSession();
  void checkUpdatesQuietly();
});

onMounted(() => {
  window.addEventListener("beforeunload", saveReadingProgress);
});

watch(readingSettings, saveReadingSettings, { deep: true });

onBeforeUnmount(() => {
  if (progressSaveTimer !== null) window.clearTimeout(progressSaveTimer);
  if (noticeTimer !== null) window.clearTimeout(noticeTimer);
  window.removeEventListener("beforeunload", saveReadingProgress);
  saveReaderSession();
  void saveReadingProgress();
});
</script>

<template>
  <aside
    v-if="
      appUpdateState.status === 'available' ||
      appUpdateState.status === 'downloading' ||
      appUpdateState.status === 'ready' ||
      appUpdateState.status === 'error'
    "
    class="update-banner"
  >
    <div>
      <strong v-if="appUpdateState.status === 'available'">
        发现新版本 v{{ appUpdateState.version }}
      </strong>
      <strong v-else-if="appUpdateState.status === 'downloading'">
        {{ appUpdateProgressText }}
      </strong>
      <strong v-else-if="appUpdateState.status === 'ready'">更新已安装</strong>
      <strong v-else>更新检查失败</strong>
      <span v-if="appUpdateState.status === 'available'">安装后会自动重启应用</span>
      <span v-else-if="appUpdateState.status === 'error'">{{ appUpdateState.message }}</span>
      <span v-else-if="appUpdateState.status === 'ready'">应用即将重启</span>
    </div>
    <button
      v-if="appUpdateState.status === 'available'"
      type="button"
      @click="installAvailableUpdate"
    >
      立即更新
    </button>
    <button
      v-if="appUpdateState.status === 'available' || appUpdateState.status === 'error'"
      type="button"
      class="update-dismiss"
      @click="dismissUpdateNotice"
    >
      稍后
    </button>
  </aside>

  <p v-if="notice" class="app-notice">{{ notice }}</p>

  <main v-if="appView === 'library'" class="library-page">
    <header class="library-topbar">
      <div class="app-mark">
        <span class="mark-symbol">阅</span>
        <div>
          <p class="eyebrow">PC Novel Reader</p>
          <h1>本地小说库</h1>
        </div>
      </div>

      <div class="topbar-actions">
        <button v-if="desktopRuntime" type="button" :disabled="busy" @click="importDesktopFile">
          选择文件
        </button>
      </div>
    </header>

    <section class="library-hero">
      <div class="hero-copy">
        <p class="eyebrow">LIBRARY</p>
        <h2>{{ greetingText }}</h2>
        <p class="hero-progress">{{ latestProgressText }}</p>
      </div>

      <div class="daily-quote">
        <p>{{ readingQuote.text }}</p>
        <span>{{ readingQuote.source }}</span>
      </div>
    </section>

    <p v-if="error" class="error">{{ error }}</p>

    <section class="library-section">
      <div class="section-heading">
        <p class="eyebrow">BOOKSHELF</p>
        <h2>书架</h2>
      </div>

      <div v-if="books.length > 0" class="book-grid">
        <article
          v-for="book in books"
          :key="book.id"
          class="book-card"
          :class="{ active: activeBook?.id === book.id }"
        >
          <button type="button" class="book-cover" @click="openBook(book)">
            <span>{{ coverTextForBook(book) }}</span>
          </button>
          <div class="book-card-body">
            <button type="button" class="book-title-button" @click="openBook(book)">
              {{ book.title }}
            </button>
            <p class="book-meta-line">
              <span v-if="book.author">{{ book.author }} · </span>{{ book.chapters?.length ?? 0 }} 章 ·
              {{ book.format.toUpperCase() }}
            </p>
            <p v-if="book.category" class="book-category">{{ book.category }}</p>
            <div class="book-progress">
              <div class="book-progress-copy">
                <span>{{ getBookProgressLabel(book) }}</span>
                <strong>{{ getBookProgressPercent(book) }}%</strong>
              </div>
              <div class="book-progress-track">
                <span :style="{ width: `${getBookProgressPercent(book)}%` }"></span>
              </div>
            </div>
            <div class="book-card-actions">
              <button type="button" class="primary-link" @click="openBook(book)">阅读</button>
              <button type="button" class="secondary-link" @click.stop="openBookEditor(book)">编辑</button>
              <button
                type="button"
                class="danger-link"
                :disabled="busy"
                @click.stop="deleteBook(book)"
              >
                删除
              </button>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="empty-library">
        <span class="empty-icon">FILE</span>
        <h3>书架为空</h3>
      </div>
    </section>

    <section v-if="recentBookmarks.length > 0" class="bookmark-section">
      <div class="section-heading">
        <p class="eyebrow">BOOKMARKS</p>
        <h2>书签</h2>
      </div>

      <div class="bookmark-list">
        <button
          v-for="bookmark in recentBookmarks"
          :key="bookmark.id"
          type="button"
          class="bookmark-card"
          @click="openBookmark(bookmark.bookId, bookmark.chapterId, bookmark.scrollTop)"
        >
          <span>{{ bookmark.bookTitle }}</span>
          <strong>{{ bookmark.chapterTitle }}</strong>
        </button>
      </div>
    </section>

    <section v-if="recentNotes.length > 0" class="bookmark-section">
      <div class="section-heading">
        <p class="eyebrow">NOTES</p>
        <h2>笔记</h2>
      </div>

      <div class="bookmark-list">
        <article
          v-for="note in recentNotes"
          :key="note.id"
          class="note-card"
        >
          <button
            type="button"
            class="note-card-main"
            @click="openNote(note.bookId, note.chapterId, note.scrollTop)"
          >
            <span>{{ note.bookTitle }} · {{ note.chapterTitle }}</span>
            <strong>{{ note.selectedText }}</strong>
            <em v-if="note.content">{{ note.content }}</em>
          </button>
          <button type="button" class="note-delete" @click="deleteNote(note.bookId, note.id)">删除</button>
        </article>
      </div>
    </section>

    <aside v-if="editingBookId" class="book-editor-panel">
      <div class="book-editor-header">
        <div>
          <p class="eyebrow">BOOK INFO</p>
          <h2>编辑书籍信息</h2>
        </div>
        <button type="button" aria-label="关闭编辑" @click="closeBookEditor">×</button>
      </div>

      <label class="book-editor-field">
        <span>书名</span>
        <input v-model="bookDraft.title" type="text" placeholder="请输入书名" />
      </label>
      <label class="book-editor-field">
        <span>作者</span>
        <input v-model="bookDraft.author" type="text" placeholder="可选" />
      </label>
      <label class="book-editor-field">
        <span>分类</span>
        <input v-model="bookDraft.category" type="text" placeholder="例如：玄幻、悬疑、笔记" />
      </label>
      <label class="book-editor-field">
        <span>封面字</span>
        <input v-model="bookDraft.coverText" type="text" maxlength="2" placeholder="1-2 个字" />
      </label>

      <div class="book-editor-actions">
        <button type="button" class="ghost-button" @click="closeBookEditor">取消</button>
        <button type="button" class="primary-link" @click="saveBookDetails">保存</button>
      </div>
    </aside>
  </main>

  <main v-else class="reader-page" :class="readerPageClass">
    <header class="reader-topbar">
      <button type="button" class="ghost-button" @click="openLibrary">‹ 书库</button>
      <div class="reader-book-title">
        <p class="eyebrow">{{ activeBook?.format.toUpperCase() }} · {{ activeBook?.chapters?.length ?? 0 }} 章</p>
        <h1>{{ activeBook?.title }}</h1>
      </div>
      <div class="reader-topbar-actions">
        <button type="button" class="ghost-button" @click="searchPanelOpen = !searchPanelOpen; readingSettingsOpen = false">
          搜索
        </button>
        <button type="button" class="ghost-button" @click="readingSettingsOpen = !readingSettingsOpen; searchPanelOpen = false">
          阅读设置
        </button>
      </div>
    </header>

    <aside v-if="readingSettingsOpen" class="reading-settings-panel">
      <div class="reading-settings-header">
        <div>
          <p class="eyebrow">READING</p>
          <h2>阅读设置</h2>
        </div>
        <button type="button" aria-label="关闭阅读设置" @click="readingSettingsOpen = false">×</button>
      </div>

      <label class="setting-row">
        <span>字号</span>
        <input v-model.number="readingSettings.fontSize" type="range" min="15" max="28" step="1" />
        <strong>{{ readingSettings.fontSize }}px</strong>
      </label>

      <label class="setting-row">
        <span>行距</span>
        <input v-model.number="readingSettings.lineHeight" type="range" min="1.5" max="2.8" step="0.1" />
        <strong>{{ readingSettings.lineHeight.toFixed(1) }}</strong>
      </label>

      <label class="setting-row">
        <span>页宽</span>
        <input v-model.number="readingSettings.pageWidth" type="range" min="680" max="1280" step="20" />
        <strong>{{ readingSettings.pageWidth }}px</strong>
      </label>

      <label class="setting-field">
        <span>字体</span>
        <select v-model="readingSettings.font">
          <option value="system">系统默认</option>
          <option value="serif">西文衬线</option>
          <option value="songti">宋体</option>
          <option value="kaiti">楷体</option>
          <option value="fangsong">仿宋</option>
          <option value="yuanti">圆体</option>
          <option value="hei">黑体</option>
          <option value="mono">等宽</option>
        </select>
      </label>

      <div class="setting-field">
        <span>背景</span>
        <div class="theme-options">
          <button
            type="button"
            class="theme-swatch paper"
            :class="{ active: readingSettings.theme === 'paper' }"
            aria-label="纸张"
            @click="readingSettings.theme = 'paper'"
          />
          <button
            type="button"
            class="theme-swatch eye"
            :class="{ active: readingSettings.theme === 'eye' }"
            aria-label="护眼"
            @click="readingSettings.theme = 'eye'"
          />
          <button
            type="button"
            class="theme-swatch sepia"
            :class="{ active: readingSettings.theme === 'sepia' }"
            aria-label="暖色"
            @click="readingSettings.theme = 'sepia'"
          />
          <button
            type="button"
            class="theme-swatch dark"
            :class="{ active: readingSettings.theme === 'dark' }"
            aria-label="夜间"
            @click="readingSettings.theme = 'dark'"
          />
        </div>
      </div>

      <button type="button" class="settings-reset" @click="resetReadingSettings">恢复默认</button>
    </aside>

    <aside v-if="searchPanelOpen" class="search-panel">
      <div class="search-panel-header">
        <div>
          <p class="eyebrow">SEARCH</p>
          <h2>书内搜索</h2>
        </div>
        <button type="button" aria-label="关闭搜索" @click="searchPanelOpen = false">×</button>
      </div>

      <input v-model="searchQuery" type="search" placeholder="输入关键词，跳到对应段落" />

      <p v-if="searchQuery" class="search-summary">
        找到 {{ searchResults.length }} 处{{ searchResults.length >= 80 ? "，已显示前 80 处" : "" }}
      </p>

      <div v-if="searchResults.length > 0" class="search-result-list">
        <button
          v-for="result in searchResults"
          :key="result.id"
          type="button"
          @click="openSearchResult(result)"
        >
          <span>{{ result.chapterTitle }}</span>
          <strong>{{ result.snippet }}</strong>
        </button>
      </div>

      <p v-else-if="searchQuery" class="search-empty">没有找到相关内容</p>
    </aside>

    <section v-if="activeBook" class="reader-layout" :class="{ 'chapter-collapsed': chapterListCollapsed }">
      <aside class="chapter-panel" :class="{ collapsed: chapterListCollapsed }">
        <button
          type="button"
          class="collapse-button"
          :aria-label="chapterListCollapsed ? '展开目录' : '收起目录'"
          @click="chapterListCollapsed = !chapterListCollapsed"
        >
          {{ chapterListCollapsed ? "›" : "‹" }}
        </button>
        <nav v-if="!chapterListCollapsed" class="chapter-list" aria-label="章节列表">
          <button
            v-for="(chapter, chapterIndex) in activeBook.chapters"
            :key="chapter.id"
            type="button"
            :class="{ active: activeChapter?.id === chapter.id, read: isChapterRead(chapterIndex) }"
            @click="selectChapter(chapter)"
          >
            {{ displayChapterTitle(chapter) }}
          </button>
        </nav>
      </aside>

      <article
        ref="chapterContentRef"
        class="chapter-content"
        :style="chapterContentStyle"
        @scroll="queueReadingProgressSave"
        @mouseup="updateSelectedText"
        @keyup="updateSelectedText"
      >
        <div class="chapter-meta-row">
          <p class="eyebrow">CHAPTER</p>
          <div class="chapter-tools">
            <button
              type="button"
              class="bookmark-toggle"
              :class="{ active: activeBookmark }"
              @click="toggleBookmark"
            >
              {{ activeBookmark ? "已加书签" : "加入书签" }}
            </button>
          </div>
        </div>
        <div class="chapter-title-row">
          <button
            type="button"
            class="chapter-nav-button"
            :disabled="!previousChapter"
            aria-label="上一章"
            @click="goToPreviousChapter"
          >
            ‹
          </button>
          <h2>{{ activeChapterTitle }}</h2>
          <button
            type="button"
            class="chapter-nav-button"
            :disabled="!nextChapter"
            aria-label="下一章"
            @click="goToNextChapter"
          >
            ›
          </button>
        </div>
        <p v-for="(paragraph, index) in chapterParagraphs" :key="index">{{ paragraph }}</p>
        <div class="chapter-bottom-nav">
          <button
            type="button"
            class="chapter-nav-text-button"
            :disabled="!previousChapter"
            @click="goToPreviousChapter"
          >
            上一章
          </button>
          <button
            type="button"
            class="chapter-nav-text-button"
            :disabled="!nextChapter"
            @click="goToNextChapter"
          >
            下一章
          </button>
        </div>
      </article>

      <div
        v-if="selectionToolbar.visible"
        class="selection-toolbar"
        :style="{ top: `${selectionToolbar.top}px`, left: `${selectionToolbar.left}px` }"
      >
        <button type="button" @mousedown.prevent @click="openNoteDraft">添加笔记</button>
      </div>

      <aside v-if="noteDraftOpen" class="note-drawer">
        <div class="note-drawer-header">
          <div>
            <p class="eyebrow">NOTE</p>
            <h3>记录这一段</h3>
          </div>
          <button type="button" aria-label="关闭笔记" @click="closeNoteDraft">×</button>
        </div>
        <blockquote>{{ selectedText }}</blockquote>
        <textarea v-model="noteDraftText" autofocus placeholder="写下你的想法、感受或提醒..." />
        <div class="note-drawer-actions">
          <button type="button" class="ghost-button" @click="closeNoteDraft">取消</button>
          <button type="button" class="primary-link" @click="saveNoteDraft">保存笔记</button>
        </div>
      </aside>
    </section>
  </main>
</template>
