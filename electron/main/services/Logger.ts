import { existsSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { LogEntry } from '../../src/types/index.js';

export class Logger {
  private logDir: string;
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
  private enableFileLogging: boolean = true;
  private enableConsoleLogging: boolean = true;
  private userDataPath: string;

  constructor(userDataPath: string) {
    this.userDataPath = userDataPath;
    this.logDir = join(this.userDataPath, 'logs');
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  private createLogEntry(level: 'debug' | 'info' | 'warn' | 'error', message: string, source?: string, metadata?: any): LogEntry {
    return {
      id: this.generateLogId(),
      level,
      message,
      timestamp: new Date(),
      source: source || 'PhotoEditorApp',
      metadata,
      taskId: metadata?.taskId,
      imageId: metadata?.imageId
    };
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const source = entry.source.padEnd(15);
    const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
    
    return `[${timestamp}] ${level} ${source} - ${entry.message}${metadata}`;
  }

  private writeToFile(entry: LogEntry): void {
    try {
      const dateStr = entry.timestamp.toISOString().split('T')[0];
      const logFile = join(this.logDir, `app-${dateStr}.log`);
      
      const logLine = this.formatLogEntry(entry) + '\n';
      appendFileSync(logFile, logLine, 'utf8');
    } catch (error) {
      // 静默处理文件写入错误，避免日志系统自身错误
    }
  }

  debug(message: string, source?: string, metadata?: any): void {
    if (!this.shouldLog('debug')) return;
    
    const entry = this.createLogEntry('debug', message, source, metadata);
    
    if (this.enableConsoleLogging) {
      console.debug(this.formatLogEntry(entry));
    }
    
    if (this.enableFileLogging) {
      this.writeToFile(entry);
    }
  }

  info(message: string, source?: string, metadata?: any): void {
    if (!this.shouldLog('info')) return;
    
    const entry = this.createLogEntry('info', message, source, metadata);
    
    if (this.enableConsoleLogging) {
      console.info(this.formatLogEntry(entry));
    }
    
    if (this.enableFileLogging) {
      this.writeToFile(entry);
    }
  }

  warn(message: string, source?: string, metadata?: any): void {
    if (!this.shouldLog('warn')) return;
    
    const entry = this.createLogEntry('warn', message, source, metadata);
    
    if (this.enableConsoleLogging) {
      console.warn(this.formatLogEntry(entry));
    }
    
    if (this.enableFileLogging) {
      this.writeToFile(entry);
    }
  }

  error(message: string, source?: string, error?: any): void {
    if (!this.shouldLog('error')) return;
    
    const metadata = error ? { 
      ...error, 
      stack: error.stack,
      name: error.name,
      message: error.message 
    } : undefined;
    
    const entry = this.createLogEntry('error', message, source, metadata);
    
    if (this.enableConsoleLogging) {
      console.error(this.formatLogEntry(entry));
    }
    
    if (this.enableFileLogging) {
      this.writeToFile(entry);
    }
  }

  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logLevel = level;
  }

  setFileLogging(enabled: boolean): void {
    this.enableFileLogging = enabled;
  }

  setConsoleLogging(enabled: boolean): void {
    this.enableConsoleLogging = enabled;
  }

  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 获取最近的日志条目
  getRecentLogs(limit: number = 100, level?: string): LogEntry[] {
    // 简化实现，实际应该从文件中读取
    return [];
  }

  // 导出日志
  exportLogs(startDate?: Date, endDate?: Date, format: 'json' | 'csv' = 'json'): string {
    // 简化实现，实际应该从文件中读取并过滤
    return '';
  }

  // 清理旧日志
  cleanOldLogs(daysToKeep: number = 30): void {
    // 简化实现，实际应该删除旧日志文件
  }
}