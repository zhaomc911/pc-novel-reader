# PC Novel Reader

**PC Novel Reader** 是一款简洁、无广告的电脑端本地小说阅读器。  
它适合想把 TXT 小说放在自己电脑里安静阅读的人：没有信息流、没有推荐、没有弹窗，只保留书架、目录和正文。

**PC Novel Reader** is a simple, ad-free desktop novel reader for local TXT books.  
It is built for people who want a quiet personal reading space without feeds, recommendations, popups, or distractions.

## 下载 / Download

你可以在 Releases 页面下载测试版：

Download the pre-release version here:

[Download PC Novel Reader](https://github.com/zhaomc911/pc-novel-reader/releases)

当前支持：

Currently available for:

- macOS
- Windows

> 目前应用还没有做代码签名。首次打开时，macOS 或 Windows 可能会出现安全提示。  
> The app is not code-signed yet, so your system may show a security warning the first time you open it.

macOS 用户如果无法直接打开，可以右键应用，选择 `打开`。  
On macOS, right-click the app and choose `Open` if it cannot be opened normally.

## 主要功能 / Features

- 导入本地 TXT 小说  
  Import local TXT novels

- 自动识别章节目录  
  Automatically detect chapters

- 本地书架管理  
  Manage books in a local bookshelf

- 记录阅读进度  
  Remember reading progress

- 清理部分章节标题里的作者题外话或更新说明  
  Clean some noisy chapter-title notes, such as update messages or author side notes

- 书库页和阅读页分离，阅读时更专注  
  Separate library and reading views for a calmer reading experience

- 可收起章节目录  
  Collapsible chapter list

## 为什么做这个 / Why

很多小说阅读环境越来越复杂：广告、推荐、弹窗、会员提示、信息流都会打断阅读。  
PC Novel Reader 希望回到最朴素的阅读体验：打开一本本地小说，安静地读下去。

Many reading apps are filled with ads, recommendations, popups, and feeds.  
PC Novel Reader is an attempt to return to a simpler experience: open a local book and read quietly.

## 隐私 / Privacy

- 你的小说文件保存在你自己的电脑上。  
  Your books stay on your own computer.

- 阅读数据保存在本地。  
  Reading data is stored locally.

- 不需要账号。  
  No account is required.

- 没有广告和远程推荐流。  
  No ads or remote recommendation feeds.

## 给开发者 / For Developers

这个项目使用：

Built with:

- Vue 3
- TypeScript
- Vite
- Tauri 2

本地运行：

Run locally:

```bash
pnpm install
pnpm dev
```

运行桌面版：

Run the desktop app:

```bash
pnpm tauri:dev
```

构建当前平台应用：

Build for the current platform:

```bash
pnpm tauri:build
```

## License

No license has been selected yet.
