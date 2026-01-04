# AI批量智能修图软件（桌面端）

基于 **Electron + React + TypeScript** 的本地桌面应用，用于批量图片处理/修图。
内置模板系统、任务队列与断点续传、热文件夹自动处理，并支持多种 AI 图像接口（内置豆包 Seedream / Google Gemini，同时支持自定义 New-API/OpenAI 兼容端点）。

## 核心特性

- 🚀 **批量处理**：任务队列 + 并发控制
- 🔧 **多模型/多端点**：内置豆包 Seedream、Google Gemini；支持自定义 API 端点与模型
- 📁 **热文件夹**：监听目录，新图片自动入队处理
- 🎨 **模板系统**：内置 5 种模板，支持自定义模板与参数调节
- 💾 **断点续传**：任务状态持久化，异常退出后可恢复
- 💰 **成本控制**：预算与费用统计（含缓存避免重复调用）
- 🖥️ **系统集成**：托盘、右键菜单、开机自启等

相关说明文档：
- 自定义 API 配置：[`API_CONFIG_GUIDE.md`](./API_CONFIG_GUIDE.md)

## 技术架构

### 前端（Renderer）
- React 18 + TypeScript
- Ant Design
- Zustand
- Vite

### 主进程（Main）
- Electron 28
- better-sqlite3 / sqlite3（任务与数据持久化）
- sharp（图片处理）
- axios / node-fetch（HTTP 请求）
- chokidar（文件监听）

### 核心代码位置

#### 主进程 (Main Process)
- `electron/main/main.ts`：应用主入口（窗口、托盘、IPC）
- `electron/main/services/TaskManager.ts`：任务队列/并发/断点续传
- `electron/main/services/TaskWorker.ts`：Worker 线程执行单任务
- `electron/main/services/ApiManager.ts`：AI API 提供商管理（内置 + 自定义）
- `electron/main/services/CacheManager.ts`：缓存管理
- `electron/main/services/ConfigManager.ts`：配置管理
- `electron/main/services/HotFolderManager.ts`：热文件夹监听
- `electron/main/services/SystemIntegration.ts`：右键菜单/托盘/自启

#### 渲染进程 (Renderer Process)
- `src/App.tsx`：主界面
- `src/stores/appStore.ts`：全局状态
- `src/components/*`：主要 UI 组件

## 快速开始

### 环境要求
- Node.js >= 18
- npm >= 8

### 安装依赖

```bash
npm install
```

### 开发模式（前端页面）

```bash
npm run dev
```

> 说明：当前仓库的 `dev` 脚本启动的是 Vite 开发服务器（用于调试渲染进程 UI）。
> 生产形态的桌面应用请使用构建/打包命令。

### 构建/打包应用

```bash
# 打包当前平台
npm run build

# 打包 Windows
npm run build:win

# 打包 macOS
npm run build:mac
```

打包产物默认输出到 `release/` 目录。

## 使用说明

### 1) 批量处理流程
1. 添加图片：拖拽或选择文件/文件夹
2. 选择模板：使用内置模板或创建自定义模板
3. 开始处理：任务进入队列并按并发数执行
4. 查看结果：在任务列表中查看进度/成功/失败信息

### 2) 热文件夹
在设置中启用热文件夹并配置监听目录后，目录内新文件会自动入队处理。

### 3) 模板
内置模板：
- 电商白底图
- 人像美化
- 文档扫描
- 风景增强
- 艺术风格

自定义模板支持配置提示词与参数（强度、引导比例、步数、分辨率、质量等）。

## API 配置

### 内置提供商
- 豆包 Seedream（默认启用）
- Google Gemini（默认禁用）

可在应用设置中填写/管理 API Key。

### 自定义 API（New-API / OpenAI 兼容）
应用支持添加自定义 API 提供商（自定义 endpoint、认证方式、模型名称、速率限制等）。
详细步骤与示例见：[`API_CONFIG_GUIDE.md`](./API_CONFIG_GUIDE.md)

## 项目结构

```text
ai-batch-photo-editor/
├── electron/
│   ├── main/
│   │   ├── main.ts
│   │   └── services/
│   ├── preload.ts
│   └── tsconfig.json
├── src/
│   ├── components/
│   ├── stores/
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
├── API_CONFIG_GUIDE.md
├── README.md
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 数据与日志

当前实现中，任务数据库与日志默认写入运行目录下的 `data/`：
- `data/tasks.db`
- `data/logs/app-YYYY-MM-DD.log`

（在 Windows 上，如果存在 `%APPDATA%` 环境变量，会优先写入该目录下。）

## 故障排除

- **API 调用失败**：检查 API Key、端点、模型名称与网络；自定义端点请参考 `API_CONFIG_GUIDE.md`
- **热文件夹不工作**：确认目录权限与监听路径是否存在
- **处理速度慢/失败率高**：降低并发数、检查速率限制与重试设置

## 贡献指南

欢迎提交 Issue 和 PR。

## 许可证

MIT License

## 更新日志

### v1.0.0 (2024-01-04)
- ✨ 初始版本发布
- ✨ 任务队列与进度管理（含断点续传）
- ✨ 内置 5 种处理模板与自定义模板
- ✨ 热文件夹监听
- ✨ 系统托盘与右键菜单集成
- ✨ API 提供商：豆包 Seedream / Google Gemini / 自定义端点
