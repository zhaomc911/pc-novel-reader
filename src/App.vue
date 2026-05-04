<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { Book, Chapter } from "./types/book";
import { listBooks, removeBook, saveBook } from "./services/storage";
import { parseFileToBook } from "./services/parsers";
import { cleanChapterTitle } from "./services/parsers/txt";
import { importTxtWithDesktopDialog, isTauriRuntime } from "./services/desktop";

type AppView = "library" | "reader";

const books = ref<Book[]>([]);
const activeBook = ref<Book | null>(null);
const activeChapterId = ref<string | null>(null);
const appView = ref<AppView>("library");
const chapterListCollapsed = ref(false);
const busy = ref(false);
const error = ref("");
const desktopRuntime = isTauriRuntime();

const totalChapters = computed(() =>
  books.value.reduce((sum, book) => sum + (book.chapters?.length ?? 0), 0),
);

const latestBook = computed(() => books.value[0] ?? null);

const activeChapter = computed(() => {
  const chapters = activeBook.value?.chapters ?? [];
  return chapters.find((chapter) => chapter.id === activeChapterId.value) ?? chapters[0] ?? null;
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

async function refreshBooks() {
  books.value = await listBooks();
  if (activeBook.value) {
    activeBook.value = books.value.find((book) => book.id === activeBook.value?.id) ?? activeBook.value;
  }
}

function openBook(book: Book) {
  activeBook.value = book;
  activeChapterId.value = book.progress?.chapterId ?? book.chapters?.[0]?.id ?? null;
  appView.value = "reader";
}

function openLibrary() {
  appView.value = "library";
}

async function persistAndOpen(book: Book) {
  await saveBook(book);
  await refreshBooks();
  const saved = books.value.find((item) => item.id === book.id) ?? book;
  openBook(saved);
}

async function importBrowserFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  await withBusy(async () => {
    const book = await parseFileToBook(file);
    await persistAndOpen(book);
  });
}

async function importDesktopFile() {
  await withBusy(async () => {
    const book = await importTxtWithDesktopDialog();
    if (book) await persistAndOpen(book);
  });
}

async function selectChapter(chapter: Chapter) {
  if (!activeBook.value) return;
  activeChapterId.value = chapter.id;
  activeBook.value.progress = {
    ...activeBook.value.progress,
    chapterId: chapter.id,
    updatedAt: Date.now(),
  };
  await saveBook(activeBook.value);
  await refreshBooks();
}

async function deleteBook(book: Book) {
  await withBusy(async () => {
    await removeBook(book.id);
    if (activeBook.value?.id === book.id) {
      activeBook.value = null;
      activeChapterId.value = null;
      appView.value = "library";
    }
    await refreshBooks();
  });
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

onMounted(refreshBooks);
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
          选择 TXT
        </button>
        <label class="file-button" :class="{ disabled: busy }">
          浏览器导入
          <input type="file" accept=".txt,text/plain" :disabled="busy" @change="importBrowserFile" />
        </label>
      </div>
    </header>

    <section class="library-hero">
      <div class="hero-copy">
        <p class="eyebrow">LIBRARY</p>
        <h2>今晚读哪一本？</h2>
        <p class="hero-title">{{ latestBook?.title ?? "书库还没有小说" }}</p>
      </div>

      <div class="library-stats">
        <div>
          <strong>{{ books.length }}</strong>
          <span>本书</span>
        </div>
        <div>
          <strong>{{ totalChapters }}</strong>
          <span>章节</span>
        </div>
        <div>
          <strong>{{ latestBook?.format.toUpperCase() ?? "TXT" }}</strong>
          <span>格式</span>
        </div>
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
            v-for="chapter in activeBook.chapters"
            :key="chapter.id"
            type="button"
            :class="{ active: activeChapter?.id === chapter.id }"
            @click="selectChapter(chapter)"
          >
            {{ displayChapterTitle(chapter) }}
          </button>
        </nav>
      </aside>

      <article class="chapter-content">
        <p class="eyebrow">CHAPTER</p>
        <h2>{{ activeChapterTitle }}</h2>
        <p v-for="(paragraph, index) in chapterParagraphs" :key="index">{{ paragraph }}</p>
      </article>
    </section>
  </main>
</template>
