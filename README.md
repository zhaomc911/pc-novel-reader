# PC Novel Reader

一个使用 Vue 3 + TypeScript + Vite + Tauri 2 构建的电脑端本地小说阅读器。

## 功能

- 导入本地 TXT 小说
- 自动识别章节目录
- 清洗章节标题里的部分作者题外话
- 本地保存书架和阅读进度
- 书库首页与阅读页分离
- 支持打包为 macOS / Windows 桌面应用

## 本地开发

```bash
pnpm install
pnpm dev
```

浏览器预览地址：

```bash
http://127.0.0.1:1420/
```

## 桌面应用开发

Tauri 需要 Rust 工具链。首次开发前先安装 Rust：

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

然后启动桌面应用：

```bash
pnpm tauri:dev
```

## 本地打包

在当前系统打包当前平台的安装包：

```bash
pnpm tauri:build
```

如果只需要生成 macOS `.app` 包，可以运行：

```bash
pnpm tauri:build:mac-app
```

产物会出现在：

```bash
src-tauri/target/release/bundle
```

说明：

- 在 macOS 上构建 macOS 应用包和 DMG。
- 在 Windows 上构建 Windows 安装包。
- Windows 包通常不要直接在 macOS 本机交叉编译，推荐用 Windows 机器或 GitHub Actions。

## 发布测试版

仓库包含 GitHub Actions 工作流：

```bash
.github/workflows/desktop-build.yml
```

手动测试构建：

1. 打开 GitHub 仓库的 Actions 页面。
2. 选择 `Build desktop apps`。
3. 点击 `Run workflow`。
4. 构建完成后，在 workflow run 的 Artifacts 中下载 macOS / Windows 测试包。

发布测试版 Release：

```bash
git tag v0.1.0
git push origin v0.1.0
```

推送 tag 后，工作流会：

- 在 macOS runner 构建 `.app` 并压缩成 zip。
- 在 Windows runner 构建 Windows 安装包。
- 自动创建 GitHub Release。
- 把 macOS / Windows 产物上传到 Release。

当前没有做代码签名和公证，因此测试用户首次打开时可能会看到系统安全提示。macOS 用户可以右键应用选择“打开”，Windows 用户可能会看到 SmartScreen 提示。
