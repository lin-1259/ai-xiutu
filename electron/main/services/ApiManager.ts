import axios, { AxiosInstance } from 'axios';
import CryptoJS from 'crypto-js';
import { ApiRequest, ApiResponse, ApiConfig } from '../../src/types/index.js';
import { Logger } from './Logger.js';

export class ApiManager {
  private logger: Logger;
  private providers: Map<string, AxiosInstance> = new Map();
  private configs: Map<string, ApiConfig> = new Map();
  private rateLimiter: Map<string, number[]> = new Map();
  private currentProviderId: string = '';

  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeDefaultProviders();
  }

  private initializeDefaultProviders(): void {
    // 豆包Seedream API
    const doubaoConfig: ApiConfig = {
      id: 'doubao',
      provider: 'doubao',
      name: '豆包Seedream 4.0',
      apiKey: process.env.DOUBAO_API_KEY || '',
      endpoint: 'https://ark.cn-beijing.volces.com/api/v3/seedream',
      model: 'seedream-v3',
      maxRetries: 3,
      retryDelay: 1000,
      rateLimit: 3, // 每秒3个请求
      enabled: true,
      isCustom: false,
      authType: 'bearer'
    };

    const doubaoClient = this.createClient(doubaoConfig);
    this.providers.set('doubao', doubaoClient);
    this.configs.set('doubao', doubaoConfig);

    // Google Gemini API
    const geminiConfig: ApiConfig = {
      id: 'gemini',
      provider: 'gemini',
      name: 'Google Gemini 3 Pro',
      apiKey: process.env.GEMINI_API_KEY || '',
      endpoint: 'https://generativelanguage.googleapis.com/v1',
      model: 'gemini-3-pro-image',
      maxRetries: 3,
      retryDelay: 1000,
      rateLimit: 3,
      enabled: false, // 默认禁用
      isCustom: false,
      authType: 'header',
      customHeaders: {
        'x-goog-api-key': process.env.GEMINI_API_KEY || ''
      }
    };

    const geminiClient = this.createClient(geminiConfig);
    this.providers.set('gemini', geminiClient);
    this.configs.set('gemini', geminiConfig);

    // 设置默认提供商
    this.currentProviderId = 'doubao';
  }

  private createClient(config: ApiConfig): AxiosInstance {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'AI-Photo-Editor/1.0'
    };

    // 根据认证类型设置请求头
    if (config.authType === 'bearer' && config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    } else if (config.authType === 'apikey') {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    // 添加自定义请求头
    if (config.customHeaders) {
      Object.assign(headers, config.customHeaders);
    }

    const client = axios.create({
      baseURL: config.endpoint,
      timeout: 60000, // 60秒超时
      headers
    });

    // 请求拦截器 - 添加重试逻辑
    client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;

        if (!config || !config.url) {
          return Promise.reject(error);
        }

        config._retryCount = config._retryCount || 0;

        const maxRetries = 3;
        if (config._retryCount < maxRetries) {
          config._retryCount++;
          await this.delay(1000 * config._retryCount);
          return client(config);
        }

        throw error;
      }
    );

    return client;
  }

  async processImage(request: ApiRequest): Promise<ApiResponse> {
    const startTime = Date.now();

    try {
      // 检查当前API配置
      const providerConfig = this.configs.get(this.currentProviderId);
      if (!providerConfig || !providerConfig.enabled || !providerConfig.apiKey) {
        throw new Error(`API provider ${this.currentProviderId} not configured`);
      }

      // 检查速率限制
      if (!this.checkRateLimit(this.currentProviderId)) {
        throw new Error(`Rate limit exceeded for ${this.currentProviderId}`);
      }

      // 发送请求
      let response: any;
      
      if (providerConfig.provider === 'doubao') {
        response = await this.callDoubaoAPI(request, providerConfig);
      } else if (providerConfig.provider === 'gemini') {
        response = await this.callGeminiAPI(request, providerConfig);
      } else if (providerConfig.isCustom) {
        response = await this.callCustomAPI(request, providerConfig);
      } else {
        throw new Error(`Unsupported API provider: ${providerConfig.provider}`);
      }

      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        imageData: response.imageData,
        cost: this.calculateCost(providerConfig, request.params),
        processingTime
      };

    } catch (error) {
      this.logger.error(`API调用失败: ${this.currentProviderId}`, error);
      
      // 尝试备用API
      const availableProviders = Array.from(this.configs.values())
        .filter(config => config.enabled && config.apiKey && config.id !== this.currentProviderId);
      
      if (availableProviders.length > 0) {
        const fallbackProvider = availableProviders[0];
        this.logger.info(`尝试切换到备用API: ${fallbackProvider.name}`);
        this.currentProviderId = fallbackProvider.id;
        return this.processImage(request);
      }

      return {
        success: false,
        error: error.message || 'API调用失败',
        processingTime: Date.now() - startTime
      };
    }
  }

  private async callDoubaoAPI(request: ApiRequest, config: ApiConfig): Promise<any> {
    const client = this.providers.get(config.id)!;
    
    const payload = {
      model: config.model || 'seedream-v3',
      prompt: request.prompt,
      negative_prompt: request.negativePrompt,
      image: request.imageData,
      strength: request.params.strength,
      guidance_scale: request.params.guidanceScale,
      num_inference_steps: request.params.steps,
      output_format: 'jpeg',
      quality: request.params.quality === 'high' ? 'high' : 'standard'
    };

    const response = await client.post('/generate', payload);
    
    if (response.data.error) {
      throw new Error(response.data.error.message);
    }

    return {
      imageData: response.data.image
    };
  }

  private async callGeminiAPI(request: ApiRequest, config: ApiConfig): Promise<any> {
    const client = this.providers.get(config.id)!;
    
    const payload = {
      contents: [
        {
          parts: [
            {
              text: request.prompt
            },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: request.imageData
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 2048,
        stopSequences: []
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };

    const response = await client.post(`/models/${config.model || 'gemini-3-pro-image'}:generateContent`, payload);
    
    if (response.data.error) {
      throw new Error(response.data.error.message);
    }

    // Gemini返回格式处理
    const candidates = response.data.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('No response from Gemini API');
    }

    const candidate = candidates[0];
    if (candidate.content.parts.length === 0) {
      throw new Error('Empty response from Gemini API');
    }

    const part = candidate.content.parts[0];
    if (!part.inline_data) {
      throw new Error('No image data in Gemini response');
    }

    return {
      imageData: part.inline_data.data
    };
  }

  private async callCustomAPI(request: ApiRequest, config: ApiConfig): Promise<any> {
    const client = this.providers.get(config.id)!;
    
    // 自定义API的通用请求格式
    const payload = {
      model: config.model || 'default-model',
      prompt: request.prompt,
      negative_prompt: request.negativePrompt,
      image: request.imageData,
      strength: request.params.strength,
      guidance_scale: request.params.guidanceScale,
      num_inference_steps: request.params.steps,
      output_format: 'jpeg',
      quality: request.params.quality === 'high' ? 'high' : 'standard'
    };

    const response = await client.post('/generate', payload);
    
    if (response.data.error) {
      throw new Error(response.data.error.message);
    }

    // 假设返回格式与豆包相同
    return {
      imageData: response.data.image || response.data.result || response.data.output
    };
  }

  private checkRateLimit(provider: string): boolean {
    const now = Date.now();
    const timestamps = this.rateLimiter.get(provider) || [];
    
    // 移除1秒前的请求记录
    const recentRequests = timestamps.filter(ts => now - ts < 1000);
    
    if (recentRequests.length >= this.configs.get(provider)?.rateLimit!) {
      return false;
    }
    
    recentRequests.push(now);
    this.rateLimiter.set(provider, recentRequests);
    
    return true;
  }

  private calculateCost(config: ApiConfig, params: any): number {
    // 简化成本计算
    const resolution = params.resolution || '1024x1024';
    const [width, height] = resolution.split('x').map(Number);
    const pixelCount = width * height;
    
    let baseCost = 0;
    
    if (config.provider === 'doubao') {
      if (pixelCount <= 1024 * 1024) { // 1K
        baseCost = 0.01;
      } else if (pixelCount <= 1920 * 1080) { // 2K
        baseCost = 0.02;
      } else { // 4K+
        baseCost = 0.03;
      }
    } else if (config.provider === 'gemini') {
      baseCost = 0.08; // 统一价格
    } else {
      // 自定义API的成本估算
      baseCost = 0.05; // 默认成本
    }
    
    return baseCost;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 新增：添加自定义API提供商
  addCustomProvider(config: Omit<ApiConfig, 'id'>): string {
    const id = `custom_${Date.now()}`;
    const newConfig: ApiConfig = {
      ...config,
      id,
      isCustom: true
    };

    const client = this.createClient(newConfig);
    this.providers.set(id, client);
    this.configs.set(id, newConfig);

    this.logger.info(`添加自定义API提供商: ${config.name}`);
    return id;
  }

  // 新增：移除自定义API提供商
  removeCustomProvider(id: string): boolean {
    const config = this.configs.get(id);
    if (config && config.isCustom) {
      this.providers.delete(id);
      this.configs.delete(id);
      this.rateLimiter.delete(id);
      
      // 如果删除的是当前使用的提供商，切换到默认提供商
      if (this.currentProviderId === id) {
        this.currentProviderId = 'doubao';
      }
      
      this.logger.info(`移除自定义API提供商: ${config.name}`);
      return true;
    }
    return false;
  }

  // 新增：更新API配置
  updateProviderConfig(id: string, config: Partial<ApiConfig>): void {
    const existingConfig = this.configs.get(id);
    if (existingConfig) {
      const updatedConfig = { ...existingConfig, ...config };
      this.configs.set(id, updatedConfig);
      
      // 重新创建HTTP客户端
      if (config.endpoint || config.apiKey || config.customHeaders || config.authType) {
        const client = this.createClient(updatedConfig);
        this.providers.set(id, client);
      }
      
      this.logger.info(`更新API配置: ${existingConfig.name}`);
    }
  }

  // 获取所有API提供商
  getAllProviders(): ApiConfig[] {
    return Array.from(this.configs.values());
  }

  // 获取启用的API提供商
  getEnabledProviders(): ApiConfig[] {
    return Array.from(this.configs.values()).filter(config => config.enabled);
  }

  // 获取当前使用的提供商ID
  getCurrentProviderId(): string {
    return this.currentProviderId;
  }

  // 获取当前提供商配置
  getCurrentProviderConfig(): ApiConfig | undefined {
    return this.configs.get(this.currentProviderId);
  }

  // 设置当前使用的提供商
  setCurrentProvider(providerId: string): void {
    const config = this.configs.get(providerId);
    if (config && config.enabled && config.apiKey) {
      this.currentProviderId = providerId;
      this.logger.info(`切换API提供商到: ${config.name}`);
    } else {
      throw new Error(`Provider ${providerId} is not available or not configured`);
    }
  }

  getProviderStatus(): any {
    const status: any = {};
    
    for (const [id, config] of this.configs) {
      status[id] = {
        name: config.name,
        provider: config.provider,
        enabled: config.enabled,
        configured: !!config.apiKey,
        rateLimit: config.rateLimit,
        maxRetries: config.maxRetries,
        isCustom: config.isCustom,
        model: config.model
      };
    }
    
    return status;
  }

  async testProvider(providerId: string): Promise<boolean> {
    try {
      const config = this.configs.get(providerId);
      if (!config || !config.apiKey) {
        return false;
      }

      // 创建一个小的测试图片
      const testImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
      
      const testRequest: ApiRequest = {
        imageData: testImage.split(',')[1],
        prompt: 'test',
        params: {
          strength: 0.5,
          resolution: '512x512',
          quality: 'fast'
        }
      };

      // 临时切换到测试提供商
      const originalProvider = this.currentProviderId;
      this.currentProviderId = providerId;
      
      const response = await this.processImage(testRequest);
      
      // 恢复原来的提供商
      this.currentProviderId = originalProvider;
      
      return response.success;
      
    } catch (error) {
      this.logger.error(`测试API失败: ${providerId}`, error);
      return false;
    }
  }
}