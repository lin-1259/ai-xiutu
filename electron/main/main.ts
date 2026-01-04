import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, dialog, shell } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';
import Store from 'electron-store';
import { TaskManager } from './services/TaskManager.js';
import { HotFolderManager } from './services/HotFolderManager.js';
import { SystemIntegration } from './services/SystemIntegration.js';
import { ConfigManager } from './services/ConfigManager.js';
import { Logger } from './services/Logger.js';
import { ApiManager } from './services/ApiManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class PhotoEditorApp {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private taskManager: TaskManager;
  private hotFolderManager: HotFolderManager;
  private systemIntegration: SystemIntegration;
  private configManager: ConfigManager;
  private logger: Logger;
  private apiManager: ApiManager;

  constructor() {
    this.logger = new Logger();
    this.configManager = new ConfigManager(this.logger);
    this.apiManager = new ApiManager(this.logger);
    this.taskManager = new TaskManager(this.logger, this.apiManager);
    this.hotFolderManager = new HotFolderManager(this.logger);
    this.systemIntegration = new SystemIntegration(this.logger);
    
    this.setupApp();
    this.setupIPC();
  }

  private setupApp(): void {
    // 确保数据目录存在
    const dataDir = app.getPath('userData');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    // 禁用安全警告（开发环境）
    if (process.env.NODE_ENV === 'development') {
      process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
    }

    // 单实例锁
    const gotTheLock = app.requestSingleInstanceLock();
    
    if (!gotTheLock) {
      app.quit();
      return;
    }

    // 当第二个实例启动时，激活主窗口
    app.on('second-instance', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.focus();
      }
    });

    // 应用准备就绪
    app.whenReady().then(() => {
      this.createWindow();
      this.createTray();
      this.setupAutoStart();
      this.hotFolderManager.initialize();
    });

    // 所有窗口关闭
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        if (this.configManager.get('system.closeToTray')) {
          this.hideToTray();
        } else {
          app.quit();
        }
      }
    });

    // 应用激活
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    // 应用关闭前
    app.on('before-quit', () => {
      this.taskManager.pauseAllTasks();
      this.hotFolderManager.stop();
      this.systemIntegration.uninstallContextMenu();
    });

    // 安全策略
    app.on('web-contents-created', (_, contents) => {
      contents.on('new-window', (navigationEvent, navigationUrl) => {
        navigationEvent.preventDefault();
        shell.openExternal(navigationUrl);
      });
    });
  }

  private createWindow(): void {
    const config = this.configManager.get('general');
    
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: 'AI批量修图助手',
      icon: join(__dirname, '../assets/icons/icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: join(__dirname, 'preload.js'),
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false
      },
      show: false,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
    });

    // 窗口准备显示时
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      
      if (process.env.NODE_ENV === 'development') {
        this.mainWindow?.webContents.openDevTools();
      }
    });

    // 加载页面
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:5173');
    } else {
      this.mainWindow.loadFile(join(__dirname, '../dist/index.html'));
    }

    // 窗口事件
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    this.mainWindow.on('minimize', (event) => {
      if (this.configManager.get('system.minimizeToTray')) {
        event.preventDefault();
        this.hideToTray();
      }
    });

    this.mainWindow.on('close', (event) => {
      if (this.configManager.get('system.closeToTray')) {
        event.preventDefault();
        this.hideToTray();
      }
    });
  }

  private createTray(): void {
    const iconPath = join(__dirname, '../assets/icons/tray.png');
    this.tray = new Tray(nativeImage.createFromPath(iconPath));
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => {
          this.showMainWindow();
        }
      },
      {
        label: '暂停/继续处理',
        click: () => {
          this.taskManager.togglePause();
        }
      },
      {
        label: '处理设置',
        click: () => {
          this.showSettings();
        }
      },
      {
        type: 'separator'
      },
      {
        label: '退出',
        click: () => {
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
    this.tray.setToolTip('AI批量修图助手');
    
    // 双击托盘图标显示窗口
    this.tray.on('double-click', () => {
      this.showMainWindow();
    });

    // 更新托盘图标状态
    this.updateTrayIcon();
    
    // 定期更新托盘状态
    setInterval(() => {
      this.updateTrayIcon();
    }, 5000);
  }

  private updateTrayIcon(): void {
    if (!this.tray) return;

    const stats = this.taskManager.getStats();
    let iconName = 'tray.png'; // 默认图标
    
    if (stats.processing > 0) {
      iconName = 'tray-processing.png'; // 处理中图标
    } else if (stats.failed > 0) {
      iconName = 'tray-error.png'; // 错误图标
    } else if (stats.pending > 0) {
      iconName = 'tray-pending.png'; // 等待中图标
    }

    const iconPath = join(__dirname, `../assets/icons/${iconName}`);
    this.tray.setImage(nativeImage.createFromPath(iconPath));
    
    // 更新托盘提示文本
    let tooltip = 'AI批量修图助手';
    if (stats.processing > 0) {
      tooltip = `正在处理 ${stats.processing} 个任务`;
    } else if (stats.pending > 0) {
      tooltip = `等待处理 ${stats.pending} 个任务`;
    }
    
    this.tray.setToolTip(tooltip);
  }

  private hideToTray(): void {
    if (this.mainWindow) {
      this.mainWindow.hide();
    }
  }

  private showMainWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  private showSettings(): void {
    if (this.mainWindow) {
      this.mainWindow.show();
      this.mainWindow.webContents.send('show-settings');
    }
  }

  private setupAutoStart(): void {
    const autoStart = this.configManager.get('system.startOnBoot');
    app.setLoginItemSettings({
      openAtLogin: autoStart,
      openAsHidden: this.configManager.get('system.minimizeToTray')
    });
  }

  private setupIPC(): void {
    // 任务管理相关
    ipcMain.handle('task:add', async (_, taskData) => {
      return await this.taskManager.addTask(taskData);
    });

    ipcMain.handle('task:pause', async (_, taskId) => {
      return await this.taskManager.pauseTask(taskId);
    });

    ipcMain.handle('task:resume', async (_, taskId) => {
      return await this.taskManager.resumeTask(taskId);
    });

    ipcMain.handle('task:cancel', async (_, taskId) => {
      return await this.taskManager.cancelTask(taskId);
    });

    ipcMain.handle('task:get-stats', async () => {
      return this.taskManager.getStats();
    });

    ipcMain.handle('task:get-list', async (_, filters) => {
      return await this.taskManager.getTaskList(filters);
    });

    // 文件操作相关
    ipcMain.handle('file:select', async (_, options) => {
      return await dialog.showOpenDialog(this.mainWindow!, options);
    });

    ipcMain.handle('file:save', async (_, options) => {
      return await dialog.showSaveDialog(this.mainWindow!, options);
    });

    ipcMain.handle('file:read-image-info', async (_, filePath) => {
      // 这里需要实现图片信息读取
      return { width: 1920, height: 1080, format: 'jpg', size: 1024000 };
    });

    // 配置管理相关
    ipcMain.handle('config:get', async (_, key) => {
      return this.configManager.get(key);
    });

    ipcMain.handle('config:set', async (_, key, value) => {
      return this.configManager.set(key, value);
    });

    ipcMain.handle('config:reset', async () => {
      return this.configManager.reset();
    });

    // API管理相关
    ipcMain.handle('api:get-all-providers', async () => {
      return this.apiManager.getAllProviders();
    });

    ipcMain.handle('api:get-enabled-providers', async () => {
      return this.apiManager.getEnabledProviders();
    });

    ipcMain.handle('api:add-custom-provider', async (_, config) => {
      return this.apiManager.addCustomProvider(config);
    });

    ipcMain.handle('api:remove-custom-provider', async (_, id) => {
      return this.apiManager.removeCustomProvider(id);
    });

    ipcMain.handle('api:update-provider', async (_, id, config) => {
      return this.apiManager.updateProviderConfig(id, config);
    });

    ipcMain.handle('api:set-current-provider', async (_, id) => {
      return this.apiManager.setCurrentProvider(id);
    });

    ipcMain.handle('api:get-current-provider', async () => {
      return this.apiManager.getCurrentProviderConfig();
    });

    ipcMain.handle('api:test-provider', async (_, id) => {
      return await this.apiManager.testProvider(id);
    });

    // 热文件夹相关
    ipcMain.handle('hotfolder:start', async (_, config) => {
      return await this.hotFolderManager.start(config);
    });

    ipcMain.handle('hotfolder:stop', async () => {
      return await this.hotFolderManager.stop();
    });

    ipcMain.handle('hotfolder:get-status', async () => {
      return this.hotFolderManager.getStatus();
    });

    // 系统集成相关
    ipcMain.handle('system:install-context-menu', async () => {
      return await this.systemIntegration.installContextMenu();
    });

    ipcMain.handle('system:uninstall-context-menu', async () => {
      return await this.systemIntegration.uninstallContextMenu();
    });

    // 通知相关
    ipcMain.handle('notification:show', async (_, notification) => {
      new Notification(notification.title, {
        body: notification.message,
        icon: join(__dirname, '../assets/icons/icon.png')
      }).show();
    });

    // 应用状态相关
    ipcMain.handle('app:get-version', async () => {
      return app.getVersion();
    });

    ipcMain.handle('app:get-path', async (_, name) => {
      return app.getPath(name);
    });

    ipcMain.handle('app:restart', async () => {
      app.relaunch();
      app.exit(0);
    });

    // 进程间通信事件
    ipcMain.on('task:progress', (_, taskId, progress) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('task:progress', taskId, progress);
      }
    });

    ipcMain.on('task:completed', (_, taskId, result) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('task:completed', taskId, result);
      }
      this.updateTrayIcon();
    });

    ipcMain.on('task:failed', (_, taskId, error) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('task:failed', taskId, error);
      }
      this.updateTrayIcon();
    });

    ipcMain.on('hotfolder:new-file', (_, filePath) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('hotfolder:new-file', filePath);
      }
    });
  }
}

// 启动应用
new PhotoEditorApp();