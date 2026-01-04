import Store from 'electron-store';
import { AppConfig } from '../../src/types/index.js';
import { Logger } from './Logger.js';

export class ConfigManager {
  private store: Store<AppConfig>;
  private logger: Logger;
  private defaultConfig: AppConfig;

  constructor(logger: Logger) {
    this.logger = logger;
    this.defaultConfig = this.getDefaultConfig();
    this.store = new Store<AppConfig>({
      name: 'config',
      defaults: this.defaultConfig,
      schema: {
        general: {
          type: 'object',
          properties: {
            theme: { type: 'string', enum: ['light', 'dark', 'system'] },
            language: { type: 'string', enum: ['zh-CN', 'en-US'] },
            autoSave: { type: 'boolean' },
            autoSaveInterval: { type: 'number', minimum: 30, maximum: 3600 }
          }
        },
        processing: {
          type: 'object',
          properties: {
            maxConcurrentTasks: { type: 'number', minimum: 1, maximum: 10 },
            defaultApiProvider: { type: 'string', enum: ['doubao', 'gemini'] },
            outputFormat: { type: 'string', enum: ['jpg', 'png'] },
            quality: { type: 'number', minimum: 1, maximum: 100 },
            compressionLevel: { type: 'number', minimum: 1, maximum: 9 },
            enableOptimization: { type: 'boolean' }
          }
        },
        hotFolder: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            inputPath: { type: 'string' },
            outputPath: { type: 'string' },
            templateId: { type: 'string' },
            filePatterns: { 
              type: 'array', 
              items: { type: 'string' },
              default: ['*.jpg', '*.jpeg', '*.png', '*.bmp', '*.tiff']
            },
            autoStart: { type: 'boolean' }
          }
        },
        system: {
          type: 'object',
          properties: {
            minimizeToTray: { type: 'boolean' },
            showNotifications: { type: 'boolean' },
            closeToTray: { type: 'boolean' },
            startOnBoot: { type: 'boolean' }
          }
        },
        cost: {
          type: 'object',
          properties: {
            dailyBudget: { type: 'number', minimum: 0 },
            monthlyBudget: { type: 'number', minimum: 0 },
            costAlertEnabled: { type: 'boolean' },
            costAlertThreshold: { type: 'number', minimum: 50, maximum: 100 }
          }
        }
      }
    });

    this.validateConfig();
  }

  private getDefaultConfig(): AppConfig {
    return {
      general: {
        theme: 'system',
        language: 'zh-CN',
        autoSave: true,
        autoSaveInterval: 300 // 5分钟
      },
      processing: {
        maxConcurrentTasks: 3,
        defaultApiProvider: 'doubao',
        outputFormat: 'jpg',
        quality: 85,
        compressionLevel: 6,
        enableOptimization: true
      },
      hotFolder: {
        enabled: false,
        inputPath: '',
        outputPath: '',
        templateId: 'ecommerce-white-bg',
        filePatterns: ['*.jpg', '*.jpeg', '*.png', '*.bmp', '*.tiff'],
        autoStart: false
      },
      system: {
        minimizeToTray: true,
        showNotifications: true,
        closeToTray: true,
        startOnBoot: false
      },
      cost: {
        dailyBudget: 100,
        monthlyBudget: 1000,
        costAlertEnabled: true,
        costAlertThreshold: 80
      }
    };
  }

  private validateConfig(): void {
    try {
      // 验证配置文件完整性
      const config = this.store.store;
      
      // 确保必要的配置项存在
      if (!config.general || !config.processing || !config.hotFolder || !config.system || !config.cost) {
        this.logger.warn('配置文件不完整，使用默认配置');
        this.reset();
        return;
      }

      // 验证数值范围
      if (config.processing.maxConcurrentTasks < 1 || config.processing.maxConcurrentTasks > 10) {
        this.logger.warn('无效的并发任务数，重置为默认值');
        this.set('processing.maxConcurrentTasks', 3);
      }

      if (config.processing.quality < 1 || config.processing.quality > 100) {
        this.logger.warn('无效的质量值，重置为默认值');
        this.set('processing.quality', 85);
      }

      this.logger.info('配置验证完成');

    } catch (error) {
      this.logger.error('配置验证失败，使用默认配置', error);
      this.reset();
    }
  }

  get<T = any>(key: string): T {
    try {
      return this.store.get(key);
    } catch (error) {
      this.logger.error(`获取配置失败: ${key}`, error);
      return this.getDefaultValue(key);
    }
  }

  set<T = any>(key: string, value: T): void {
    try {
      this.store.set(key, value);
      this.logger.debug(`配置已更新: ${key} = ${value}`);
    } catch (error) {
      this.logger.error(`设置配置失败: ${key}`, error);
    }
  }

  getAll(): AppConfig {
    return this.store.store;
  }

  setAll(config: Partial<AppConfig>): void {
    try {
      for (const [section, values] of Object.entries(config)) {
        for (const [key, value] of Object.entries(values)) {
          this.store.set(`${section}.${key}`, value);
        }
      }
      this.logger.info('批量更新配置');
    } catch (error) {
      this.logger.error('批量更新配置失败', error);
    }
  }

  reset(): void {
    try {
      this.store.clear();
      this.store.store = this.defaultConfig;
      this.logger.info('配置已重置为默认值');
    } catch (error) {
      this.logger.error('重置配置失败', error);
    }
  }

  exportConfig(): string {
    try {
      return JSON.stringify(this.store.store, null, 2);
    } catch (error) {
      this.logger.error('导出配置失败', error);
      return '';
    }
  }

  importConfig(configJson: string): boolean {
    try {
      const config = JSON.parse(configJson);
      this.setAll(config);
      this.validateConfig();
      this.logger.info('配置导入成功');
      return true;
    } catch (error) {
      this.logger.error('导入配置失败', error);
      return false;
    }
  }

  // 获取API配置
  getApiConfig(provider: string): any {
    const configKey = `api.${provider}`;
    return this.get(configKey) || {};
  }

  // 设置API配置
  setApiConfig(provider: string, config: any): void {
    const configKey = `api.${provider}`;
    this.set(configKey, config);
  }

  // 获取所有API配置
  getAllApiConfigs(): any {
    return this.get('api') || {};
  }

  // 设置所有API配置
  setAllApiConfigs(configs: any): void {
    this.set('api', configs);
  }

  // 添加自定义API配置
  addCustomApiConfig(id: string, config: any): void {
    const customApis = this.get('api.custom') || {};
    customApis[id] = config;
    this.set('api.custom', customApis);
  }

  // 移除自定义API配置
  removeCustomApiConfig(id: string): void {
    const customApis = this.get('api.custom') || {};
    delete customApis[id];
    this.set('api.custom', customApis);
  }

  // 获取自定义API配置
  getCustomApiConfigs(): any {
    return this.get('api.custom') || {};
  }

  // 获取主题配置
  getTheme(): string {
    return this.get('general.theme');
  }

  setTheme(theme: 'light' | 'dark' | 'system'): void {
    this.set('general.theme', theme);
  }

  // 获取语言配置
  getLanguage(): string {
    return this.get('general.language');
  }

  setLanguage(language: 'zh-CN' | 'en-US'): void {
    this.set('general.language', language);
  }

  // 获取处理配置
  getProcessingConfig(): any {
    return this.get('processing');
  }

  // 获取热文件夹配置
  getHotFolderConfig(): any {
    return this.get('hotFolder');
  }

  // 获取系统配置
  getSystemConfig(): any {
    return this.get('system');
  }

  // 获取成本控制配置
  getCostConfig(): any {
    return this.get('cost');
  }

  // 检查预算
  checkBudget(currentCost: number): { 
    withinDaily: boolean; 
    withinMonthly: boolean; 
    alertTriggered: boolean; 
  } {
    const costConfig = this.getCostConfig();
    const dailyBudget = costConfig.dailyBudget || 100;
    const monthlyBudget = costConfig.monthlyBudget || 1000;
    const alertThreshold = costConfig.costAlertThreshold || 80;

    // 简化的预算检查，实际应该跟踪每日/每月消费
    const dailySpent = currentCost; // 这里简化处理
    const monthlySpent = currentCost;

    const dailyPercent = (dailySpent / dailyBudget) * 100;
    const monthlyPercent = (monthlySpent / monthlyBudget) * 100;

    return {
      withinDaily: dailyPercent <= 100,
      withinMonthly: monthlyPercent <= 100,
      alertTriggered: dailyPercent >= alertThreshold || monthlyPercent >= alertThreshold
    };
  }

  // 获取默认配置值
  private getDefaultValue(key: string): any {
    const parts = key.split('.');
    let value = this.defaultConfig;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }

    return value;
  }

  // 监听配置变化
  onConfigChange(callback: (key: string, value: any) => void): void {
    this.store.onDidChange((newValue, oldValue) => {
      // 找出变化的配置项
      const changedKeys = this.findChangedKeys(oldValue, newValue);
      
      for (const key of changedKeys) {
        const newVal = this.get(key);
        callback(key, newVal);
      }
    });
  }

  private findChangedKeys(oldObj: any, newObj: any, prefix: string = ''): string[] {
    const changedKeys: string[] = [];

    if (!oldObj || !newObj || typeof oldObj !== 'object' || typeof newObj !== 'object') {
      return changedKeys;
    }

    for (const key in newObj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof newObj[key] === 'object' && newObj[key] !== null && !Array.isArray(newObj[key])) {
        // 递归检查嵌套对象
        changedKeys.push(...this.findChangedKeys(oldObj[key], newObj[key], fullKey));
      } else if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
        // 值发生变化
        changedKeys.push(fullKey);
      }
    }

    return changedKeys;
  }

  // 备份配置
  backupConfig(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `config-backup-${timestamp}.json`;
    
    try {
      const configData = this.exportConfig();
      // 这里应该将备份文件保存到用户目录
      return backupFile;
    } catch (error) {
      this.logger.error('备份配置失败', error);
      return '';
    }
  }

  // 恢复配置
  restoreConfig(backupFile: string): boolean {
    try {
      // 这里应该从备份文件读取配置
      // const backupData = readFileSync(backupFile, 'utf8');
      // return this.importConfig(backupData);
      return true;
    } catch (error) {
      this.logger.error('恢复配置失败', error);
      return false;
    }
  }

  destroy(): void {
    // 清理资源
    this.logger.info('配置管理器已关闭');
  }
}