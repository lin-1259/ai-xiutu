import axios, { AxiosInstance } from 'axios';
import CryptoJS from 'crypto-js';
import { ApiRequest, ApiResponse, ApiConfig } from '../../src/types/index.js';
import { Logger } from './Logger.js';

export class ApiManager {
  private logger: Logger;
  private currentProvider: 'doubao' | 'gemini';
  private providers: Map<string, AxiosInstance> = new Map();
  private configs: Map<string, ApiConfig> = new Map();
  private rateLimiter: Map<string, number[]> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
    this.currentProvider = 'doubao'; // 默认使用豆包
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // 豆包Seedream API
    const doubaoConfig: ApiConfig = {
      provider: 'doubao',
      apiKey: process.env.DOUBAO_API_KEY || '',
      endpoint: 'https://ark.cn-beijing.volces.com/api/v3/seedream',
      maxRetries: 3,
      retryDelay: 1000,
      rateLimit: 3, // 每秒3个请求
      enabled: true
    };

    const doubaoClient = axios.create({
      baseURL: doubaoConfig.endpoint,
      timeout: 60000, // 60秒超时
      headers: {
        'Authorization': `Bearer ${doubaoConfig.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Photo-Editor/1.0'
      }
    });

    // 请求拦截器 - 添加重试逻辑
    doubaoClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;
        
        if (!config._retryCount) {
          config._retryCount = 0;
        }

        if (config._retryCount < doubaoConfig.maxRetries) {
          config._retryCount++;
          await this.delay(doubaoConfig.retryDelay * config._retryCount);
          return doubaoClient(config);
        }

        throw error;
      }
    );

    this.providers.set('doubao', doubaoClient);
    this.configs.set('doubao', doubaoConfig);

    // Google Gemini API
    const geminiConfig: ApiConfig = {
      provider: 'gemini',
      apiKey: process.env.GEMINI_API_KEY || '',
      endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-3-pro-image',
      maxRetries: 3,
      retryDelay: 1000,
      rateLimit: 3,
      enabled: false // 默认禁用
    };

    const geminiClient = axios.create({
      baseURL: geminiConfig.endpoint,
      timeout: 60000,
      headers: {
        'x-goog-api-key': geminiConfig.apiKey,
        'Content-Type': 'application/json'
      }
    });

    geminiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;
        
        if (!config._retryCount) {
          config._retryCount = 0;
        }

        if (config._retryCount < geminiConfig.maxRetries) {
          config._retryCount++;
          await this.delay(geminiConfig.retryDelay * config._retryCount);
          return geminiClient(config);
        }

        throw error;
      }
    );

    this.providers.set('gemini', geminiClient);
    this.configs.set('gemini', geminiConfig);
  }

  async processImage(request: ApiRequest): Promise<ApiResponse> {
    const startTime = Date.now();

    try {
      // 检查API配置
      const providerConfig = this.configs.get(this.currentProvider);
      if (!providerConfig || !providerConfig.enabled || !providerConfig.apiKey) {
        throw new Error(`API provider ${this.currentProvider} not configured`);
      }

      // 检查速率限制
      if (!this.checkRateLimit(this.currentProvider)) {
        throw new Error(`Rate limit exceeded for ${this.currentProvider}`);
      }

      // 发送请求
      let response: any;
      
      if (this.currentProvider === 'doubao') {
        response = await this.callDoubaoAPI(request);
      } else if (this.currentProvider === 'gemini') {
        response = await this.callGeminiAPI(request);
      } else {
        throw new Error(`Unsupported API provider: ${this.currentProvider}`);
      }

      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        imageData: response.imageData,
        cost: this.calculateCost(this.currentProvider, request.params),
        processingTime
      };

    } catch (error) {
      this.logger.error(`API调用失败: ${this.currentProvider}`, error);
      
      // 尝试备用API
      if (this.currentProvider === 'doubao' && this.configs.get('gemini')?.enabled) {
        this.logger.info('尝试切换到备用API: Gemini');
        this.currentProvider = 'gemini';
        return this.processImage(request);
      }

      return {
        success: false,
        error: error.message || 'API调用失败',
        processingTime: Date.now() - startTime
      };
    }
  }

  private async callDoubaoAPI(request: ApiRequest): Promise<any> {
    const client = this.providers.get('doubao')!;
    
    const payload = {
      model: 'seedream-v3',
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

  private async callGeminiAPI(request: ApiRequest): Promise<any> {
    const client = this.providers.get('gemini')!;
    
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

    const response = await client.post(':generateContent?key=' + this.configs.get('gemini')?.apiKey, payload);
    
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

  private calculateCost(provider: string, params: any): number {
    // 简化成本计算
    const resolution = params.resolution || '1024x1024';
    const [width, height] = resolution.split('x').map(Number);
    const pixelCount = width * height;
    
    let baseCost = 0;
    
    if (provider === 'doubao') {
      if (pixelCount <= 1024 * 1024) { // 1K
        baseCost = 0.01;
      } else if (pixelCount <= 1920 * 1080) { // 2K
        baseCost = 0.02;
      } else { // 4K+
        baseCost = 0.03;
      }
    } else if (provider === 'gemini') {
      baseCost = 0.08; // 统一价格
    }
    
    return baseCost;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getCurrentProvider(): 'doubao' | 'gemini' {
    return this.currentProvider;
  }

  setCurrentProvider(provider: 'doubao' | 'gemini'): void {
    if (this.configs.get(provider)?.enabled) {
      this.currentProvider = provider;
      this.logger.info(`切换API提供商到: ${provider}`);
    } else {
      throw new Error(`Provider ${provider} is not enabled`);
    }
  }

  getProviderStatus(): any {
    const status: any = {};
    
    for (const [provider, config] of this.configs) {
      status[provider] = {
        enabled: config.enabled,
        configured: !!config.apiKey,
        rateLimit: config.rateLimit,
        maxRetries: config.maxRetries
      };
    }
    
    return status;
  }

  updateProviderConfig(provider: string, config: Partial<ApiConfig>): void {
    const existingConfig = this.configs.get(provider);
    if (existingConfig) {
      const updatedConfig = { ...existingConfig, ...config };
      this.configs.set(provider, updatedConfig);
      
      // 更新HTTP客户端配置
      const client = this.providers.get(provider);
      if (client && config.apiKey) {
        if (provider === 'doubao') {
          client.defaults.headers['Authorization'] = `Bearer ${config.apiKey}`;
        } else if (provider === 'gemini') {
          client.defaults.headers['x-goog-api-key'] = config.apiKey;
        }
      }
      
      this.logger.info(`更新API配置: ${provider}`);
    }
  }

  async testProvider(provider: 'doubao' | 'gemini'): Promise<boolean> {
    try {
      const config = this.configs.get(provider);
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

      const response = await this.processImage(testRequest);
      return response.success;
      
    } catch (error) {
      this.logger.error(`测试API失败: ${provider}`, error);
      return false;
    }
  }
}