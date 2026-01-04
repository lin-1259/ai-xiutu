import { ApiManager } from './ApiManager.js';
import { ConfigManager } from './ConfigManager.js';
import { Logger } from './Logger.js';

/**
 * API管理器初始化器
 * 负责从配置文件加载API提供商配置
 */
export class ApiManagerInitializer {
  private apiManager: ApiManager;
  private configManager: ConfigManager;
  private logger: Logger;

  constructor(apiManager: ApiManager, configManager: ConfigManager, logger: Logger) {
    this.apiManager = apiManager;
    this.configManager = configManager;
    this.logger = logger;
  }

  /**
   * 初始化API提供商配置
   */
  async initialize(): Promise<void> {
    try {
      // 获取保存的API配置
      const savedConfigs = this.configManager.getCustomApiConfigs();
      
      // 加载自定义API配置
      for (const [id, config] of Object.entries(savedConfigs)) {
        try {
          this.apiManager.updateProviderConfig(id, config);
          this.logger.info(`已加载API配置: ${config.name}`);
        } catch (error) {
          this.logger.error(`加载API配置失败: ${id}`, error);
        }
      }

      // 获取默认API提供商
      const currentProvider = this.configManager.get('processing.defaultApiProvider');
      if (currentProvider) {
        try {
          this.apiManager.setCurrentProvider(currentProvider);
          this.logger.info(`已设置默认API提供商: ${currentProvider}`);
        } catch (error) {
          this.logger.warn(`设置默认API提供商失败: ${currentProvider}`, error);
        }
      }

      this.logger.info('API管理器初始化完成');
    } catch (error) {
      this.logger.error('API管理器初始化失败', error);
    }
  }

  /**
   * 保存配置到持久化存储
   */
  async saveConfigs(): Promise<void> {
    try {
      const allProviders = this.apiManager.getAllProviders();
      const customConfigs: any = {};

      // 只保存自定义API配置
      for (const provider of allProviders) {
        if (provider.isCustom) {
          // 移除敏感信息
          const { id, isCustom, ...config } = provider;
          customConfigs[id] = config;
        }
      }

      this.configManager.setAllApiConfigs(customConfigs);
      this.logger.info('API配置已保存');
    } catch (error) {
      this.logger.error('保存API配置失败', error);
    }
  }
}