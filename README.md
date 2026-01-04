# AI批量智能修图软件

## 项目简介

基于Electron桌面框架开发的AI批量图片处理软件，支持豆包Seedream和Google Gemini AI模型，提供批量修图、模板管理、热文件夹监听等功能。

## 核心特性

- 🚀 **极速处理**：本地文件读取，批量处理效率提升20倍
- 🔧 **多模型支持**：豆包Seedream 4.0 + Google Gemini 3 Pro
- 📁 **热文件夹**：自动监听文件夹，新图片自动处理
- 🎨 **丰富模板**：内置5种专业模板，支持自定义模板
- 💾 **断点续传**：任务状态持久化，支持网络中断恢复
- 💰 **成本控制**：预算管理，费用监控，智能缓存
- 🖥️ **系统集成**：右键菜单、托盘运行、开机自启

## 技术架构

### 前端技术栈
- **React 18** + TypeScript - UI框架
- **Ant Design** - UI组件库
- **Zustand** - 状态管理
- **Vite** - 构建工具

### 桌面端技术栈
- **Electron 28** - 桌面应用框架
- **better-sqlite3** - 本地数据库
- **Sharp** - 图片处理
- **Axios** - HTTP客户端
- **Chokidar** - 文件监听

### 核心模块

#### 主进程 (Main Process)
- `main/main.ts` - 应用主入口
- `services/TaskManager.ts` - 任务队列管理
- `services/ApiManager.ts` - AI API接口管理
- `services/CacheManager.ts` - 智能缓存系统
- `services/HotFolderManager.ts` - 热文件夹监听
- `services/SystemIntegration.ts` - 系统集成功能

#### 渲染进程 (Renderer Process)
- `App.tsx` - 主应用组件
- `stores/appStore.ts` - 全局状态管理
- `components/` - UI组件库

## 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm >= 8.0.0

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```

### 构建应用
```bash
npm run build
```

### 打包应用
```bash
# 打包当前平台
npm run build

# 打包Windows
npm run build:win

# 打包macOS
npm run build:mac
```

## 使用说明

### 1. 基础功能
1. **添加图片**：拖拽或选择文件/文件夹
2. **选择模板**：从预设模板中选择或创建自定义模板
3. **开始处理**：点击开始处理按钮
4. **查看进度**：实时监控任务进度和结果

### 2. 高级功能
- **热文件夹**：设置监听目录，新文件自动处理
- **成本监控**：设置预算阈值，避免超额支出
- **系统集成**：右键菜单快速处理，任务栏托盘运行

### 3. 模板说明

#### 内置模板
- **电商白底图**：产品图片背景替换为纯白
- **人像美化**：自然美颜，保持真实感
- **文档扫描**：照片转文档，去阴影增强对比度
- **风景增强**：色彩增强，细节优化
- **艺术风格**：转换为艺术作品风格

#### 自定义模板
支持创建自定义模板，配置提示词、参数等。

## API配置

### 豆包Seedream
1. 访问 [火山引擎](https://www.volcengine.com/)
2. 创建应用并获取API Key
3. 在设置中配置API密钥

### Google Gemini
1. 访问 [Google AI Studio](https://makersuite.google.com/)
2. 获取API Key
3. 在设置中配置API密钥

## 项目结构

```
ai-batch-photo-editor/
├── electron/                 # Electron主进程代码
│   ├── main/                # 主进程入口
│   ├── services/            # 服务模块
│   └── preload.ts           # 预加载脚本
├── src/                     # React前端代码
│   ├── components/          # UI组件
│   ├── stores/             # 状态管理
│   ├── types/              # 类型定义
│   └── utils/              # 工具函数
├── assets/                 # 静态资源
├── public/                 # 公共文件
├── package.json            # 项目配置
├── vite.config.ts          # Vite配置
└── tsconfig.json           # TypeScript配置
```

## 开发说明

### 任务流程
1. 用户上传图片
2. 选择处理模板
3. 创建处理任务
4. 任务进入队列
5. Worker线程处理
6. 调用AI API
7. 返回处理结果

### 数据存储
- **SQLite数据库**：任务状态、配置信息
- **本地文件系统**：图片文件、缓存
- **用户配置**：electron-store持久化

### 性能优化
- **并发控制**：最大3个并发任务
- **智能缓存**：MD5键值缓存，LRU清理
- **图片优化**：自动压缩，质量平衡

## 部署说明

### 生产环境构建
```bash
npm run build
npm run build:win  # Windows
npm run build:mac  # macOS
```

### 代码签名
- Windows：需要代码签名证书
- macOS：需要开发者证书

## 故障排除

### 常见问题
1. **API连接失败**：检查API密钥配置
2. **图片处理慢**：调整并发数和质量设置
3. **内存占用高**：清理缓存文件
4. **热文件夹不工作**：检查路径权限

### 日志位置
- Windows: `%APPDATA%/ai-batch-photo-editor/logs/`
- macOS: `~/Library/Application Support/ai-batch-photo-editor/logs/`

## 贡献指南

欢迎提交Issue和Pull Request！

### 开发规范
- 使用TypeScript开发
- 遵循ESLint规则
- 添加适当的注释
- 编写单元测试

## 许可证

MIT License

## 更新日志

### v1.0.0 (2024-01-04)
- ✨ 初始版本发布
- ✨ 支持豆包Seedream和Google Gemini API
- ✨ 内置5种处理模板
- ✨ 热文件夹监听功能
- ✨ 任务队列和进度管理
- ✨ 系统托盘和右键菜单集成
- ✨ 成本控制和预算管理