import localforage from "localforage";
import type { Book } from "../types/book";

const db = localforage.createInstance({
  name: "pc-novel-reader",
  storeName: "books",
});

export async function saveBook(book: Book) {
  await db.setItem(book.id, book);
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
