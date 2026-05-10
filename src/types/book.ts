export type Chapter = {
  id: string;
  title: string;
  // 用切片索引，避免每章复制大段字符串
  start: number;
  end: number;
};

export type Book = {
  id: string;
  title: string;
  author?: string;
  category?: string;
  coverText?: string;
  contentHash?: string;
  format: "txt" | "md" | "pdf" | "docx" | "epub" | "rtf" | "html" | "fb2" | "odt" | "unknown";
  createdAt: number;

  // txt/md 存原文；epub 第一版可不存
  rawText?: string;

  // txt/md 目录
  chapters?: Chapter[];

  // 阅读进度（先做最小字段）
  progress?: {
    chapterId?: string;
    scrollTop?: number;
    updatedAt?: number;
  };

  bookmarks?: {
    id: string;
    chapterId: string;
    chapterTitle: string;
    scrollTop: number;
    createdAt: number;
  }[];

  notes?: {
    id: string;
    chapterId: string;
    chapterTitle: string;
    selectedText: string;
    content: string;
    scrollTop: number;
    createdAt: number;
  }[];
};
