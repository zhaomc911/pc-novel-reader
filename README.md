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
你只需要导入本地文件，然后在自己的书库里继续读下去。

PC Novel Reader is for people who want a calm personal reading space on their computer.

No ads, no feeds, no account system, and your books stay on your own device.

## 主要功能 / Features

- 导入本地小说和文档  
  Supports TXT, Markdown, PDF, DOCX, EPUB, RTF, HTML, FB2, ODT, `.text`, and `.log` files

- 自动识别章节目录  
  Automatically detects chapter lists

- 本地书架管理  
  Keeps your books in a local bookshelf

- 导入时自动去重  
  Detects repeated imports and opens the existing copy

- 书籍信息编辑  
  Edit the title, author, category, and cover text

- 自动保存阅读进度  
  Remembers the last book, chapter, and reading position

- 当前书内搜索  
  Search keywords in the current book and jump to the matched chapter

- 章节目录已读标记  
  Fades chapters you have already read

- 书签功能  
  Add bookmarks and jump back to saved chapters

- 笔记功能  
  Select text while reading, add notes, and review them on the library page

- 专注阅读界面  
  Separate library and reader views, with collapsible chapter navigation

- 阅读偏好设置  
  Adjust font size, line spacing, page width, more font families, and reading theme

- 友好的导入失败提示  
  Shows clearer guidance for scanned PDFs, protected files, and unsupported formats

- 章节清洗  
  Cleans some noisy author notes or update messages from chapter titles

- 本地隐私  
  Books, progress, bookmarks, and notes are stored locally

- 应用内更新提醒  
  Checks for new desktop releases and lets users update without visiting GitHub manually

## 支持的文件格式 / Supported Files

当前支持这些本地文件：

- `.txt`
- `.text`
- `.md`
- `.markdown`
- `.log`
- `.pdf`
- `.docx`
- `.epub`
- `.rtf`
- `.html`
- `.htm`
- `.xhtml`
- `.fb2`
- `.odt`

说明：

- PDF 目前支持可提取文字的文档；扫描版图片 PDF 暂不支持 OCR。
- Word 目前支持 `.docx`；旧版 `.doc` 暂不支持。
- MOBI/AZW3/CHM/CBZ/CBR 暂不支持，建议先转换为 EPUB、PDF、DOCX 或 TXT 后再导入。

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

应用会在启动后检查 GitHub Releases 上是否有新版本。  
如果发现更新，会在应用内提示下载安装。

The app checks GitHub Releases for updates on launch.  
When a newer release is available, users can update from inside the app.

## 发布与自动更新 / Release & Auto Update

自动更新依赖 Tauri updater 签名。发布新版本前，需要在 GitHub 仓库的 `Settings` → `Secrets and variables` → `Actions` 中配置：

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`，如果你的私钥设置了密码

当前 updater 公钥已经写入 `src-tauri/tauri.conf.json`。  
私钥不能提交到仓库，只能放在 GitHub Actions Secret 里。

发布新版本时：

```bash
git tag v0.1.1
git push origin v0.1.1
```

GitHub Actions 会把应用版本同步为 tag 版本，构建 macOS / Windows 安装包、生成更新签名，并发布 `latest.json`。应用启动后会通过这个文件判断是否有新版本。

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
