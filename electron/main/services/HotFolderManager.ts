import chokidar from 'chokidar';
import { existsSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { Logger } from './Logger.js';
import { ConfigManager } from './ConfigManager.js';
import { TaskManager } from './TaskManager.js';
import { ipcMain } from 'electron';

export interface HotFolderConfig {
  enabled: boolean;
  inputPath: string;
  outputPath: string;
  templateId: string;
  filePatterns: string[];
  autoStart: boolean;
}

export class HotFolderManager {
  private logger: Logger;
  private configManager: ConfigManager;
  private taskManager: TaskManager;
  private watcher: chokidar.FSWatcher | null = null;
  private isRunning = false;
  private processedFiles: Set<string> = new Set();
  private config: HotFolderConfig;

  constructor(logger: Logger) {
    this.logger = logger;
    this.configManager = new ConfigManager(logger);
    this.taskManager = new TaskManager(logger);
    this.config = this.configManager.getHotFolderConfig();
    
    // 加载配置
    this.loadConfig();
  }

  private loadConfig(): void {
    this.config = this.configManager.getHotFolderConfig();
  }

  async initialize(): Promise<void> {
    try {
      if (this.config.autoStart && this.config.enabled) {
        await this.start(this.config);
      }
      
      this.logger.info('热文件夹管理器初始化完成');
    } catch (error) {
      this.logger.error('热文件夹管理器初始化失败', error);
    }
  }

  async start(config?: Partial<HotFolderConfig>): Promise<boolean> {
    try {
      if (config) {
        // 更新配置
        Object.assign(this.config, config);
        this.configManager.set('hotFolder', this.config);
      }

      if (this.isRunning) {
        this.logger.warn('热文件夹已在运行');
        return true;
      }

      // 验证配置
      if (!this.config.inputPath || !this.config.outputPath) {
        throw new Error('输入路径和输出路径不能为空');
      }

      if (!existsSync(this.config.inputPath)) {
        mkdirSync(this.config.inputPath, { recursive: true });
        this.logger.info(`创建输入目录: ${this.config.inputPath}`);
      }

      if (!existsSync(this.config.outputPath)) {
        mkdirSync(this.config.outputPath, { recursive: true });
        this.logger.info(`创建输出目录: ${this.config.outputPath}`);
      }

      // 创建文件监听器
      this.watcher = chokidar.watch(this.config.inputPath, {
        ignored: /^\./, // 忽略隐藏文件
        persistent: true,
        ignoreInitial: true, // 忽略初始状态
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100
        }
      });

      // 监听文件事件
      this.watcher
        .on('add', (filePath) => this.handleFileAdded(filePath))
        .on('change', (filePath) => this.handleFileChanged(filePath))
        .on('unlink', (filePath) => this.handleFileRemoved(filePath))
        .on('error', (error) => this.handleWatcherError(error))
        .on('ready', () => {
          this.isRunning = true;
          this.logger.info(`热文件夹监控已启动: ${this.config.inputPath}`);
        });

      return true;

    } catch (error) {
      this.logger.error('启动热文件夹失败', error);
      return false;
    }
  }

  async stop(): Promise<boolean> {
    try {
      if (this.watcher) {
        await this.watcher.close();
        this.watcher = null;
      }

      this.isRunning = false;
      this.processedFiles.clear();
      
      this.logger.info('热文件夹监控已停止');
      return true;

    } catch (error) {
      this.logger.error('停止热文件夹失败', error);
      return false;
    }
  }

  private async handleFileAdded(filePath: string): Promise<void> {
    try {
      // 检查文件是否已被处理过
      if (this.processedFiles.has(filePath)) {
        return;
      }

      // 检查文件格式
      const fileName = basename(filePath);
      const isValidFormat = this.config.filePatterns.some(pattern => {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
        return regex.test(fileName);
      });

      if (!isValidFormat) {
        this.logger.debug(`跳过不支持的文件格式: ${fileName}`);
        return;
      }

      // 检查文件大小
      const fs = await import('fs');
      const stats = fs.statSync(filePath);
      
      if (stats.size < 1024) { // 小于1KB的文件可能是空文件或损坏
        this.logger.warn(`跳过过小的文件: ${fileName}`);
        return;
      }

      this.logger.info(`检测到新文件: ${filePath}`);

      // 发送通知到渲染进程
      ipcMain.emit('hotfolder:new-file', null, filePath);

      // 自动创建任务
      if (this.config.autoStart) {
        await this.createTaskForFile(filePath);
      }

    } catch (error) {
      this.logger.error(`处理新文件失败: ${filePath}`, error);
    }
  }

  private async handleFileChanged(filePath: string): Promise<void> {
    try {
      this.logger.debug(`文件已修改: ${filePath}`);
      
      // 对于修改的文件，可以选择重新处理或忽略
      // 这里选择重新处理
      await this.handleFileAdded(filePath);
      
    } catch (error) {
      this.logger.error(`处理文件修改失败: ${filePath}`, error);
    }
  }

  private async handleFileRemoved(filePath: string): Promise<void> {
    try {
      this.logger.debug(`文件已删除: ${filePath}`);
      this.processedFiles.delete(filePath);
      
    } catch (error) {
      this.logger.error(`处理文件删除失败: ${filePath}`, error);
    }
  }

  private handleWatcherError(error: Error): void {
    this.logger.error('文件监听器错误', error);
    
    // 尝试重启监听器
    if (this.isRunning) {
      setTimeout(async () => {
        this.logger.info('尝试重启文件监听器');
        await this.stop();
        await this.start();
      }, 5000);
    }
  }

  private async createTaskForFile(filePath: string): Promise<void> {
    try {
      // 生成唯一图片ID
      const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 准备任务数据
      const taskData = {
        imageId,
        templateId: this.config.templateId,
        priority: 5, // 中等优先级
        maxRetries: 3
      };

      // 复制文件到工作目录
      await this.copyFileToWorkingDir(filePath, imageId);

      // 创建任务
      const task = await this.taskManager.addTask(taskData);
      
      // 标记文件为已处理
      this.processedFiles.add(filePath);
      
      this.logger.info(`为文件创建任务: ${basename(filePath)} -> ${task.id}`);

    } catch (error) {
      this.logger.error(`为文件创建任务失败: ${filePath}`, error);
    }
  }

  private async copyFileToWorkingDir(sourcePath: string, imageId: string): Promise<void> {
    try {
      const fs = await import('fs');
      const workingDir = join(process.env.APPDATA || join(process.cwd(), 'data'), 'temp');
      
      if (!existsSync(workingDir)) {
        mkdirSync(workingDir, { recursive: true });
      }

      const destPath = join(workingDir, `${imageId}.jpg`);
      
      // 简单的文件复制，实际应该保持原始格式
      fs.copyFileSync(sourcePath, destPath);
      
    } catch (error) {
      this.logger.error(`复制文件失败: ${sourcePath}`, error);
      throw error;
    }
  }

  getStatus(): any {
    return {
      running: this.isRunning,
      inputPath: this.config.inputPath,
      outputPath: this.config.outputPath,
      templateId: this.config.templateId,
      filePatterns: this.config.filePatterns,
      processedFilesCount: this.processedFiles.size
    };
  }

  updateConfig(newConfig: Partial<HotFolderConfig>): void {
    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      this.stop();
    }

    Object.assign(this.config, newConfig);
    this.configManager.set('hotFolder', this.config);
    
    if (wasRunning) {
      this.start();
    }
  }

  getConfig(): HotFolderConfig {
    return { ...this.config };
  }

  // 手动触发处理指定文件
  async processFileManually(filePath: string): Promise<string | null> {
    try {
      if (!existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      await this.createTaskForFile(filePath);
      return filePath;
      
    } catch (error) {
      this.logger.error(`手动处理文件失败: ${filePath}`, error);
      return null;
    }
  }

  // 批量处理目录中的所有文件
  async processDirectoryBatch(inputDir?: string): Promise<number> {
    try {
      const targetDir = inputDir || this.config.inputPath;
      
      if (!existsSync(targetDir)) {
        throw new Error(`目录不存在: ${targetDir}`);
      }

      const fs = await import('fs');
      const files = fs.readdirSync(targetDir);
      
      let processedCount = 0;
      
      for (const file of files) {
        const filePath = join(targetDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
          const result = await this.processFileManually(filePath);
          if (result) {
            processedCount++;
          }
        }
      }
      
      this.logger.info(`批量处理完成: ${processedCount} 个文件`);
      return processedCount;
      
    } catch (error) {
      this.logger.error('批量处理目录失败', error);
      return 0;
    }
  }

  // 清除已处理文件记录
  clearProcessedFiles(): void {
    this.processedFiles.clear();
    this.logger.info('已处理文件记录已清除');
  }

  // 获取处理统计
  getProcessingStats(): any {
    return {
      running: this.isRunning,
      processedFilesCount: this.processedFiles.size,
      inputPath: this.config.inputPath,
      lastProcessed: null // 简化实现
    };
  }

  destroy(): void {
    this.stop();
    this.logger.info('热文件夹管理器已关闭');
  }
}