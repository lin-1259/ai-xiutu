import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import sharp from 'sharp';
import { CacheEntry, CacheStats } from '../../src/types/index.js';
import { Logger } from './Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class CacheManager {
  private logger: Logger;
  private cacheDir: string;
  private cacheMap: Map<string, CacheEntry> = new Map();
  private maxCacheSize: number; // 最大缓存大小 (bytes)
  private maxEntries: number; // 最大条目数
  private cleanupInterval: NodeJS.Timeout;
  private userDataPath: string;

  constructor(logger: Logger, userDataPath: string) {
    this.logger = logger;
    this.userDataPath = userDataPath;
    this.cacheDir = join(this.userDataPath, 'cache');
    this.maxCacheSize = 1024 * 1024 * 1024; // 1GB
    this.maxEntries = 1000;
    
    this.initializeCache();
    this.startCleanupTimer();
  }

  private initializeCache(): void {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }

    // 加载现有的缓存索引
    this.loadCacheIndex();
    
    this.logger.info(`缓存目录初始化完成: ${this.cacheDir}`);
  }

  private loadCacheIndex(): void {
    const indexPath = join(this.cacheDir, 'cache-index.json');
    
    try {
      if (existsSync(indexPath)) {
        const indexData = JSON.parse(readFileSync(indexPath, 'utf8'));
        
        for (const entry of indexData.entries) {
          const cachePath = join(this.cacheDir, `${entry.key}.cache`);
          
          if (existsSync(cachePath)) {
            const stat = require('fs').statSync(cachePath);
            entry.size = stat.size;
            entry.lastAccessed = new Date(entry.lastAccessed);
            entry.createdAt = new Date(entry.createdAt);
            
            this.cacheMap.set(entry.key, entry);
          }
        }
        
        this.logger.info(`加载了 ${this.cacheMap.size} 个缓存条目`);
      }
    } catch (error) {
      this.logger.error('加载缓存索引失败', error);
      this.clearOldCache();
    }
  }

  private saveCacheIndex(): void {
    const indexPath = join(this.cacheDir, 'cache-index.json');
    const entries = Array.from(this.cacheMap.values());
    
    try {
      const indexData = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        entries: entries.map(entry => ({
          key: entry.key,
          originalHash: entry.originalHash,
          processedHash: entry.processedHash,
          templateId: entry.templateId,
          params: entry.params,
          createdAt: entry.createdAt.toISOString(),
          lastAccessed: entry.lastAccessed.toISOString(),
          accessCount: entry.accessCount,
          size: entry.size
        }))
      };
      
      writeFileSync(indexPath, JSON.stringify(indexData, null, 2));
    } catch (error) {
      this.logger.error('保存缓存索引失败', error);
    }
  }

  generateCacheKey(imageBuffer: Buffer, templateId: string, params?: any): string {
    // 生成图片的MD5哈希
    const imageHash = crypto.createHash('md5').update(imageBuffer).digest('hex');
    
    // 创建参数字符串
    const paramString = params ? JSON.stringify(params) : '';
    
    // 组合缓存键
    const cacheString = `${imageHash}_${templateId}_${paramString}`;
    
    return crypto.createHash('md5').update(cacheString).digest('hex');
  }

  async get(cacheKey: string): Promise<any | null> {
    const entry = this.cacheMap.get(cacheKey);
    
    if (!entry) {
      return null;
    }

    try {
      const cachePath = join(this.cacheDir, `${cacheKey}.cache`);
      
      if (!existsSync(cachePath)) {
        // 缓存文件不存在，删除索引记录
        this.cacheMap.delete(cacheKey);
        return null;
      }

      // 更新访问统计
      entry.lastAccessed = new Date();
      entry.accessCount++;
      
      // 读取缓存文件
      const cacheData = readFileSync(cachePath);
      const result = JSON.parse(cacheData.toString());
      
      this.logger.debug(`缓存命中: ${cacheKey}`);
      return result;
      
    } catch (error) {
      this.logger.error(`读取缓存失败: ${cacheKey}`, error);
      this.delete(cacheKey);
      return null;
    }
  }

  async set(cacheKey: string, data: any, imageBuffer?: Buffer): Promise<void> {
    try {
      const cachePath = join(this.cacheDir, `${cacheKey}.cache`);
      
      // 写入缓存文件
      const cacheData = JSON.stringify(data);
      writeFileSync(cachePath, cacheData);
      
      // 获取文件大小
      const stat = require('fs').statSync(cachePath);
      
      // 生成图像哈希（如果提供了图片数据）
      const originalHash = imageBuffer ? 
        crypto.createHash('md5').update(imageBuffer).digest('hex') : '';
      
      const processedHash = crypto.createHash('md5').update(cacheData).digest('hex');
      
      // 创建缓存条目
      const entry: CacheEntry = {
        key: cacheKey,
        originalHash,
        processedHash,
        templateId: data.templateId,
        params: data.params || {},
        imagePath: cachePath,
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 1,
        size: stat.size
      };
      
      // 添加到缓存映射
      this.cacheMap.set(cacheKey, entry);
      
      // 检查是否需要清理缓存
      await this.checkCacheLimits();
      
      // 保存索引
      this.saveCacheIndex();
      
      this.logger.debug(`缓存已保存: ${cacheKey}`);
      
    } catch (error) {
      this.logger.error(`保存缓存失败: ${cacheKey}`, error);
    }
  }

  async delete(cacheKey: string): Promise<boolean> {
    try {
      const entry = this.cacheMap.get(cacheKey);
      
      if (entry) {
        // 删除缓存文件
        if (existsSync(entry.imagePath)) {
          unlinkSync(entry.imagePath);
        }
        
        // 从缓存映射中删除
        this.cacheMap.delete(cacheKey);
        
        this.logger.debug(`缓存已删除: ${cacheKey}`);
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error(`删除缓存失败: ${cacheKey}`, error);
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      // 删除所有缓存文件
      for (const entry of this.cacheMap.values()) {
        if (existsSync(entry.imagePath)) {
          unlinkSync(entry.imagePath);
        }
      }
      
      // 清空缓存映射
      this.cacheMap.clear();
      
      // 删除索引文件
      const indexPath = join(this.cacheDir, 'cache-index.json');
      if (existsSync(indexPath)) {
        unlinkSync(indexPath);
      }
      
      this.logger.info('缓存已清空');
      
    } catch (error) {
      this.logger.error('清空缓存失败', error);
    }
  }

  private async checkCacheLimits(): Promise<void> {
    let shouldCleanup = false;
    
    // 检查条目数限制
    if (this.cacheMap.size > this.maxEntries) {
      shouldCleanup = true;
    }
    
    // 检查总大小限制
    const totalSize = this.getTotalCacheSize();
    if (totalSize > this.maxCacheSize) {
      shouldCleanup = true;
    }
    
    if (shouldCleanup) {
      await this.cleanupCache();
    }
  }

  private async cleanupCache(): Promise<void> {
    try {
      // 获取所有条目并按访问时间排序
      const entries = Array.from(this.cacheMap.entries())
        .sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());
      
      const toDelete = Math.floor(entries.length * 0.2); // 删除20%的最旧条目
      const entriesToDelete = entries.slice(0, toDelete);
      
      for (const [cacheKey] of entriesToDelete) {
        await this.delete(cacheKey);
      }
      
      this.logger.info(`清理了 ${entriesToDelete.length} 个缓存条目`);
      
    } catch (error) {
      this.logger.error('清理缓存失败', error);
    }
  }

  private getTotalCacheSize(): number {
    let totalSize = 0;
    for (const entry of this.cacheMap.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  private startCleanupTimer(): void {
    // 每小时清理一次缓存
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldEntries();
    }, 60 * 60 * 1000);
  }

  private cleanupOldEntries(): void {
    const now = new Date();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7天
    
    const oldEntries: string[] = [];
    
    for (const [cacheKey, entry] of this.cacheMap.entries()) {
      if (now.getTime() - entry.lastAccessed.getTime() > maxAge) {
        oldEntries.push(cacheKey);
      }
    }
    
    if (oldEntries.length > 0) {
      this.logger.info(`清理 ${oldEntries.length} 个过期缓存条目`);
      
      for (const cacheKey of oldEntries) {
        this.delete(cacheKey);
      }
      
      this.saveCacheIndex();
    }
  }

  getStats(): CacheStats {
    const totalSize = this.getTotalCacheSize();
    let hitCount = 0;
    let missCount = 0;
    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;
    
    // 这里简化处理，实际应用中需要跟踪命中/未命中统计
    for (const entry of this.cacheMap.values()) {
      if (!oldestEntry || entry.createdAt < oldestEntry) {
        oldestEntry = entry.createdAt;
      }
      if (!newestEntry || entry.createdAt > newestEntry) {
        newestEntry = entry.createdAt;
      }
    }
    
    return {
      totalEntries: this.cacheMap.size,
      totalSize,
      hitRate: hitCount / (hitCount + missCount) || 0,
      hitCount,
      missCount,
      oldestEntry,
      newestEntry
    };
  }

  private clearOldCache(): void {
    try {
      const indexPath = join(this.cacheDir, 'cache-index.json');
      if (existsSync(indexPath)) {
        unlinkSync(indexPath);
      }
      
      // 删除所有缓存文件
      const fs = require('fs');
      const files = fs.readdirSync(this.cacheDir);
      
      for (const file of files) {
        if (file.endsWith('.cache')) {
          const filePath = join(this.cacheDir, file);
          unlinkSync(filePath);
        }
      }
      
      this.cacheMap.clear();
      this.logger.info('旧缓存已清理');
      
    } catch (error) {
      this.logger.error('清理旧缓存失败', error);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // 保存缓存索引
    this.saveCacheIndex();
    
    this.logger.info('缓存管理器已关闭');
  }
}