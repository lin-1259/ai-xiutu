import Database from 'better-sqlite3';
import { Worker } from 'worker_threads';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';
import { Task, ApiRequest, ApiResponse } from '../types/index.js';
import { ApiManager } from './ApiManager.js';
import { Logger } from './Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class TaskManager {
  private db: Database.Database;
  private workers: Map<string, Worker> = new Map();
  private taskQueue: Task[] = [];
  private isProcessing = false;
  private maxConcurrentTasks: number;
  private apiManager: ApiManager;
  private logger: Logger;
  private taskCallbacks: Map<string, (task: Task) => void> = new Map();

  constructor(logger: Logger, apiManager: ApiManager) {
    this.logger = logger;
    this.apiManager = apiManager;
    this.maxConcurrentTasks = 3; // 默认并发数
    
    this.initializeDatabase();
    this.loadTasksFromDatabase();
  }

  private initializeDatabase(): void {
    const dbPath = join(process.env.APPDATA || join(process.cwd(), 'data'), 'tasks.db');
    
    if (!existsSync(dirname(dbPath))) {
      mkdirSync(dirname(dbPath), { recursive: true });
    }

    this.db = new Database(dbPath);

    // 创建任务表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        imageId TEXT NOT NULL,
        templateId TEXT NOT NULL,
        status TEXT NOT NULL,
        priority INTEGER DEFAULT 5,
        createdAt TEXT NOT NULL,
        startedAt TEXT,
        completedAt TEXT,
        retryCount INTEGER DEFAULT 0,
        maxRetries INTEGER DEFAULT 3,
        progress INTEGER DEFAULT 0,
        result TEXT,
        error TEXT,
        cost REAL DEFAULT 0,
        FOREIGN KEY (imageId) REFERENCES images (id),
        FOREIGN KEY (templateId) REFERENCES templates (id)
      )
    `);

    // 创建图片表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        size INTEGER NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        format TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        status TEXT NOT NULL,
        progress INTEGER DEFAULT 0,
        result TEXT,
        error TEXT
      )
    `);

    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_images_status ON images(status);
    `);
  }

  private loadTasksFromDatabase(): void {
    try {
      const stmt = this.db.prepare('SELECT * FROM tasks WHERE status IN (?, ?)');
      const pendingTasks = stmt.all('pending', 'retrying') as Task[];
      
      this.taskQueue = pendingTasks;
      this.logger.info(`加载了 ${pendingTasks.length} 个待处理任务`);
    } catch (error) {
      this.logger.error('加载任务数据失败', error);
    }
  }

  async addTask(taskData: Partial<Task>): Promise<Task> {
    const task: Task = {
      id: this.generateTaskId(),
      imageId: taskData.imageId!,
      templateId: taskData.templateId!,
      status: 'pending',
      priority: taskData.priority || 5,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: taskData.maxRetries || 3,
      progress: 0,
      cost: 0,
      ...taskData
    };

    // 保存到数据库
    const stmt = this.db.prepare(`
      INSERT INTO tasks (id, imageId, templateId, status, priority, createdAt, retryCount, maxRetries, progress, cost)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      task.id,
      task.imageId,
      task.templateId,
      task.status,
      task.priority,
      task.createdAt.toISOString(),
      task.retryCount,
      task.maxRetries,
      task.progress,
      task.cost
    );

    this.taskQueue.push(task);
    
    // 按优先级排序
    this.taskQueue.sort((a, b) => b.priority - a.priority);
    
    this.logger.info(`添加新任务: ${task.id}`);
    
    // 如果没有正在处理，开始处理任务
    if (!this.isProcessing) {
      this.processQueue();
    }

    return task;
  }

  async pauseTask(taskId: string): Promise<boolean> {
    const worker = this.workers.get(taskId);
    
    if (worker) {
      worker.terminate();
      this.workers.delete(taskId);
      
      const task = this.taskQueue.find(t => t.id === taskId);
      if (task) {
        task.status = 'pending';
        task.progress = 0;
        this.updateTaskInDatabase(task);
      }
      
      this.logger.info(`暂停任务: ${taskId}`);
      return true;
    }
    
    return false;
  }

  async resumeTask(taskId: string): Promise<boolean> {
    const task = this.taskQueue.find(t => t.id === taskId);
    
    if (task && task.status !== 'processing') {
      task.status = 'pending';
      task.progress = 0;
      this.updateTaskInDatabase(task);
      
      this.logger.info(`恢复任务: ${taskId}`);
      this.processQueue();
      
      return true;
    }
    
    return false;
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const worker = this.workers.get(taskId);
    
    if (worker) {
      worker.terminate();
      this.workers.delete(taskId);
    }

    const taskIndex = this.taskQueue.findIndex(t => t.id === taskId);
    
    if (taskIndex !== -1) {
      const task = this.taskQueue[taskIndex];
      task.status = 'failed';
      task.error = '用户取消';
      task.completedAt = new Date();
      
      this.updateTaskInDatabase(task);
      this.taskQueue.splice(taskIndex, 1);
      
      this.logger.info(`取消任务: ${taskId}`);
      return true;
    }
    
    return false;
  }

  pauseAllTasks(): void {
    for (const [taskId, worker] of this.workers) {
      worker.terminate();
      this.workers.delete(taskId);
    }
    
    // 更新所有处理中任务的状态
    for (const task of this.taskQueue) {
      if (task.status === 'processing') {
        task.status = 'pending';
        task.progress = 0;
        this.updateTaskInDatabase(task);
      }
    }
    
    this.isProcessing = false;
    this.logger.info('暂停所有任务');
  }

  togglePause(): void {
    if (this.isProcessing) {
      this.pauseAllTasks();
    } else {
      this.processQueue();
    }
  }

  getStats() {
    const stats = {
      total: this.taskQueue.length,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      retrying: 0
    };

    for (const task of this.taskQueue) {
      switch (task.status) {
        case 'pending':
          stats.pending++;
          break;
        case 'processing':
          stats.processing++;
          break;
        case 'completed':
          stats.completed++;
          break;
        case 'failed':
          stats.failed++;
          break;
        case 'retrying':
          stats.retrying++;
          break;
      }
    }

    return stats;
  }

  async getTaskList(filters: any = {}): Promise<Task[]> {
    let query = 'SELECT * FROM tasks WHERE 1=1';
    const params: any[] = [];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.templateId) {
      query += ' AND templateId = ?';
      params.push(filters.templateId);
    }

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    query += ' ORDER BY priority DESC, createdAt ASC';

    try {
      const stmt = this.db.prepare(query);
      return stmt.all(...params) as Task[];
    } catch (error) {
      this.logger.error('获取任务列表失败', error);
      return [];
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.taskQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.taskQueue.length > 0 && this.workers.size < this.maxConcurrentTasks) {
      const task = this.taskQueue.find(t => t.status === 'pending');
      
      if (!task) break;

      await this.processTask(task);
    }

    this.isProcessing = false;
  }

  private async processTask(task: Task): Promise<void> {
    try {
      task.status = 'processing';
      task.startedAt = new Date();
      task.progress = 0;
      
      this.updateTaskInDatabase(task);
      
      this.logger.info(`开始处理任务: ${task.id}`);
      
      // 创建工作线程
      const workerPath = join(__dirname, '../services/TaskWorker.js');
      const worker = new Worker(workerPath, {
        workerData: {
          taskId: task.id,
          imageId: task.imageId,
          templateId: task.templateId
        }
      });

      this.workers.set(task.id, worker);

      // 监听工作线程事件
      worker.on('message', (message) => {
        switch (message.type) {
          case 'progress':
            task.progress = message.progress;
            this.updateTaskInDatabase(task);
            this.taskCallbacks.get('progress')?.(task);
            break;
            
          case 'completed':
            task.progress = 100;
            task.status = 'completed';
            task.completedAt = new Date();
            task.result = message.result;
            task.cost = message.cost || 0;
            
            this.updateTaskInDatabase(task);
            this.taskCallbacks.get('completed')?.(task);
            this.workers.delete(task.id);
            break;
            
          case 'error':
            task.progress = 0;
            task.status = 'failed';
            task.error = message.error;
            task.completedAt = new Date();
            
            this.updateTaskInDatabase(task);
            this.taskCallbacks.get('failed')?.(task);
            this.workers.delete(task.id);
            break;
        }
      });

      worker.on('error', (error) => {
        this.logger.error(`任务工作线程错误: ${task.id}`, error);
        
        task.status = 'failed';
        task.error = error.message;
        task.completedAt = new Date();
        
        this.updateTaskInDatabase(task);
        this.taskCallbacks.get('failed')?.(task);
        this.workers.delete(task.id);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          this.logger.warn(`工作线程异常退出: ${task.id}, code: ${code}`);
        }
        
        // 继续处理队列中的下一个任务
        this.processQueue();
      });

    } catch (error) {
      this.logger.error(`处理任务失败: ${task.id}`, error);
      
      task.status = 'failed';
      task.error = error.message;
      task.completedAt = new Date();
      
      this.updateTaskInDatabase(task);
      this.taskCallbacks.get('failed')?.(task);
    }
  }

  private updateTaskInDatabase(task: Task): void {
    const stmt = this.db.prepare(`
      UPDATE tasks 
      SET status = ?, startedAt = ?, completedAt = ?, progress = ?, result = ?, error = ?, cost = ?
      WHERE id = ?
    `);

    stmt.run(
      task.status,
      task.startedAt?.toISOString(),
      task.completedAt?.toISOString(),
      task.progress,
      task.result ? JSON.stringify(task.result) : null,
      task.error,
      task.cost,
      task.id
    );
  }

  onProgress(callback: (task: Task) => void): void {
    this.taskCallbacks.set('progress', callback);
  }

  onCompleted(callback: (task: Task) => void): void {
    this.taskCallbacks.set('completed', callback);
  }

  onFailed(callback: (task: Task) => void): void {
    this.taskCallbacks.set('failed', callback);
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setMaxConcurrentTasks(max: number): void {
    this.maxConcurrentTasks = Math.max(1, Math.min(max, 10));
  }
}