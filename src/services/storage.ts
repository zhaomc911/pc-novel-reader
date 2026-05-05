import localforage from "localforage";
import type { Book } from "../types/book";

type BookUpdate = Partial<Pick<Book, "progress" | "bookmarks" | "notes">>;

const db = localforage.createInstance({
  name: "pc-novel-reader",
  storeName: "books",
});

export async function saveBook(book: Book) {
  const existing = (await db.getItem<Book>(book.id)) ?? null;
  const nextBook: Book = existing
    ? {
        ...existing,
        ...book,
        rawText: book.rawText ?? existing.rawText,
        chapters: book.chapters ?? existing.chapters,
        progress: book.progress ?? existing.progress,
        bookmarks: book.bookmarks ?? existing.bookmarks,
        notes: book.notes ?? existing.notes,
      }
    : book;

  await db.setItem(book.id, nextBook);
  return nextBook;
}

export async function updateBookState(id: string, update: BookUpdate) {
  const existing = (await db.getItem<Book>(id)) ?? null;
  if (!existing) return null;

  const nextBook: Book = {
    ...existing,
    progress: update.progress ?? existing.progress,
    bookmarks: update.bookmarks ?? existing.bookmarks,
    notes: update.notes ?? existing.notes,
  };

  await db.setItem(id, nextBook);
  return nextBook;
}

export async function getBook(id: string) {
  return (await db.getItem<Book>(id)) ?? null;
}

export async function listBooks() {
  const books: Book[] = [];
  await db.iterate<Book, void>((value) => {
    books.push(value);
  });
  books.sort((a, b) => b.createdAt - a.createdAt);
  return books;
}

export async function removeBook(id: string) {
  await db.removeItem(id);
}
