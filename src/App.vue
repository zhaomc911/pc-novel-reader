<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import type { Book, Chapter } from "./types/book";
import { listBooks, removeBook, saveBook, updateBookState } from "./services/storage";
import { cleanChapterTitle } from "./services/parsers/txt";
import { importTextWithDesktopDialog, isTauriRuntime } from "./services/desktop";
import { selectReadingQuote } from "./services/quotes";

type AppView = "library" | "reader";
type ReaderSession = {
  view: AppView;
  bookId?: string;
  chapterId?: string;
  scrollTop?: number;
  preserveProgress?: boolean;
};

const READER_SESSION_KEY = "pc-novel-reader:last-session";

const books = ref<Book[]>([]);
const activeBook = ref<Book | null>(null);
const activeChapterId = ref<string | null>(null);
const appView = ref<AppView>("library");
const chapterListCollapsed = ref(false);
const chapterContentRef = ref<HTMLElement | null>(null);
const busy = ref(false);
const error = ref("");
const desktopRuntime = isTauriRuntime();
const selectedText = ref("");
const noteDraftOpen = ref(false);
const noteDraftText = ref("");
const selectionToolbar = ref({ visible: false, top: 0, left: 0 });
const browsingSavedMark = ref(false);
let progressSaveTimer: number | null = null;

const readingQuote = ref(selectReadingQuote());

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

const activeChapterTitle = computed(() =>
  activeChapter.value ? displayChapterTitle(activeChapter.value) : "",
);

const activeBookmark = computed(() => {
  const chapterId = activeChapter.value?.id;
  if (!chapterId) return null;
  return activeBook.value?.bookmarks?.find((bookmark) => bookmark.chapterId === chapterId) ?? null;
});

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

function resetNoteUi() {
  selectedText.value = "";
  noteDraftOpen.value = false;
  noteDraftText.value = "";
  selectionToolbar.value = { visible: false, top: 0, left: 0 };
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
  await saveBook(book);
  const saved = upsertBookInMemory(book);
  openBook(saved);
}

async function importDesktopFile() {
  await withBusy(async () => {
    const book = await importTextWithDesktopDialog();
    if (book) await persistAndOpen(book);
  });
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

async function withBusy(task: () => Promise<void>) {
  busy.value = true;
  error.value = "";
  try {
    await task();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void restoreLastSession();
});

onMounted(() => {
  window.addEventListener("beforeunload", saveReadingProgress);
});

onBeforeUnmount(() => {
  if (progressSaveTimer !== null) window.clearTimeout(progressSaveTimer);
  window.removeEventListener("beforeunload", saveReadingProgress);
  saveReaderSession();
  void saveReadingProgress();
});
</script>

<template>
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
          选择文本
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
            <span>{{ book.title.slice(0, 1) }}</span>
          </button>
          <div class="book-card-body">
            <button type="button" class="book-title-button" @click="openBook(book)">
              {{ book.title }}
            </button>
            <p>{{ book.chapters?.length ?? 0 }} 章 · {{ book.format.toUpperCase() }}</p>
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
        <span class="empty-icon">TXT</span>
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
  </main>

  <main v-else class="reader-page">
    <header class="reader-topbar">
      <button type="button" class="ghost-button" @click="openLibrary">‹ 书库</button>
      <div class="reader-book-title">
        <p class="eyebrow">{{ activeBook?.format.toUpperCase() }} · {{ activeBook?.chapters?.length ?? 0 }} 章</p>
        <h1>{{ activeBook?.title }}</h1>
      </div>
      <div class="reader-spacer"></div>
    </header>

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
