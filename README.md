# PC Novel Reader

一个简洁、安静、无广告的电脑端本地小说阅读器。

PC Novel Reader is a quiet, ad-free desktop reader for local novel files.

## 下载 / Download

你可以在 Releases 页面下载最新测试版：

Download the latest beta release here:

[GitHub Releases](https://github.com/zhaomc911/pc-novel-reader/releases)

目前支持：

- macOS
- Windows

> 当前版本是未签名测试版。首次打开时，macOS 或 Windows 可能会出现安全提示。  
> This is an unsigned beta build. macOS or Windows may show a security warning on first launch.

macOS 用户如果无法直接打开，可以右键应用并选择 `打开`。  
On macOS, right-click the app and choose `Open` if it cannot be opened normally.

Windows 用户如果看到 SmartScreen 提示，可以点击 `更多信息`，再选择 `仍要运行`。  
On Windows, if SmartScreen appears, click `More info`, then choose `Run anyway`.

## 适合谁 / Who It Is For

PC Novel Reader 适合想在电脑上安静阅读本地小说的人。

它没有广告、没有推荐流、没有账号系统，也不会把你的书上传到服务器。  
你只需要导入本地文本文件，然后在自己的书库里继续读下去。

PC Novel Reader is for people who want a calm personal reading space on their computer.

No ads, no feeds, no account system, and your books stay on your own device.

## 主要功能 / Features

- 导入本地文本小说  
  Supports TXT, Markdown, `.text`, and `.log` files

- 自动识别章节目录  
  Automatically detects chapter lists

- 本地书架管理  
  Keeps your books in a local bookshelf

- 自动保存阅读进度  
  Remembers the last book, chapter, and reading position

- 章节目录已读标记  
  Fades chapters you have already read

- 书签功能  
  Add bookmarks and jump back to saved chapters

- 笔记功能  
  Select text while reading, add notes, and review them on the library page

- 专注阅读界面  
  Separate library and reader views, with collapsible chapter navigation

- 章节清洗  
  Cleans some noisy author notes or update messages from chapter titles

- 本地隐私  
  Books, progress, bookmarks, and notes are stored locally

## 支持的文件格式 / Supported Files

当前主要支持纯文本类文件：

- `.txt`
- `.text`
- `.md`
- `.markdown`
- `.log`

暂不支持 EPUB、PDF、MOBI。  
EPUB/PDF/MOBI need separate parsing and rendering support and may be added later.

## 隐私 / Privacy

- 小说文件保存在你的电脑上。  
  Your books stay on your computer.

- 阅读进度、书签和笔记保存在本地。  
  Reading progress, bookmarks, and notes are stored locally.

- 不需要账号。  
  No account is required.

- 没有广告和远程推荐流。  
  No ads or remote recommendation feeds.

## 测试版说明 / Beta Notes

这是一个持续开发中的测试版。  
当前版本还没有代码签名证书，所以系统安全提示是正常现象。

This is an actively developed beta version.  
The app is not code-signed yet, so system security warnings are expected.

## 本地开发 / Development

```bash
pnpm install
pnpm tauri:dev
```

构建当前平台桌面应用：

Build the desktop app for the current platform:

```bash
pnpm tauri:build
```

## 技术栈 / Tech Stack

- Vue 3
- TypeScript
- Vite
- Tauri 2

## License

No license has been selected yet.
