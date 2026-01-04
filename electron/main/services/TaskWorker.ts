import { parentPort, workerData } from 'worker_threads';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { ApiManager } from './ApiManager.js';
import { Logger } from './Logger.js';
import { CacheManager } from './CacheManager.js';
import { Task, ApiRequest, Template } from '../../src/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface WorkerTaskData {
  taskId: string;
  imageId: string;
  templateId: string;
  templateData?: any;
  userDataPath: string;
}

export class TaskWorker {
  private apiManager: ApiManager;
  private cacheManager: CacheManager;
  private logger: Logger;
  private userDataPath: string;

  constructor(userDataPath: string) {
    this.userDataPath = userDataPath;
    this.logger = new Logger();
    this.apiManager = new ApiManager(this.logger);
    this.cacheManager = new CacheManager(this.logger, userDataPath);
  }

  async processTask(taskData: WorkerTaskData): Promise<void> {
    try {
      this.logger.info(`开始处理任务: ${taskData.taskId}`);

      // 读取图片
      const imagePath = join(this.userDataPath, 'temp', `${taskData.imageId}.jpg`);
      if (!existsSync(imagePath)) {
        throw new Error(`图片文件不存在: ${imagePath}`);
      }

      const imageBuffer = readFileSync(imagePath);
      
      // 检查缓存
      const cacheKey = this.cacheManager.generateCacheKey(imageBuffer, taskData.templateId);
      const cachedResult = await this.cacheManager.get(cacheKey);
      
      if (cachedResult) {
        this.logger.info(`缓存命中: ${taskData.taskId}`);
        
        // 发送进度更新
        parentPort?.postMessage({
          type: 'progress',
          progress: 100
        });

        // 发送完成结果
        parentPort?.postMessage({
          type: 'completed',
          result: cachedResult,
          cost: 0
        });

        return;
      }

      // 读取模板配置
      let template = taskData.templateData;
      if (!template) {
        template = await this.getTemplate(taskData.templateId);
      }
      
      if (!template) {
        throw new Error(`模板不存在: ${taskData.templateId}`);
      }

      // 图片预处理
      const sharpInstance = await this.preprocessImage(imageBuffer, template.params);
      const processedImageBuffer = await sharpInstance.toBuffer();
      const metadata = await sharpInstance.metadata();

      // 准备API请求
      const apiRequest: ApiRequest = {
        imageData: processedImageBuffer.toString('base64'),
        prompt: template.prompt,
        negativePrompt: template.negativePrompt,
        params: template.params
      };

      this.logger.info(`调用API处理: ${taskData.taskId}`);

      // 调用API
      const apiResponse = await this.apiManager.processImage(apiRequest);

      if (!apiResponse.success) {
        throw new Error(apiResponse.error || 'API处理失败');
      }

      // 确保输出目录存在
      const outputDir = join(this.userDataPath, 'output');
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      // 保存结果
      const outputPath = join(outputDir, `${taskData.taskId}.jpg`);
      const outputBuffer = Buffer.from(apiResponse.imageData!, 'base64');

      // 写入文件
      const fs = await import('fs');
      fs.writeFileSync(outputPath, outputBuffer);

      // 生成缩略图
      const thumbnailPath = join(outputDir, `${taskData.taskId}_thumb.jpg`);
      await sharp(outputBuffer)
        .resize(200, 200, { fit: 'inside' })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      // 准备结果数据
      const result = {
        id: taskData.taskId,
        originalPath: imagePath,
        processedPath: outputPath,
        thumbnailPath: thumbnailPath,
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: 'jpg',
        size: outputBuffer.length,
        processedAt: new Date(),
        templateId: taskData.templateId,
        apiProvider: this.apiManager.getCurrentProviderId(),
        cost: apiResponse.cost || 0
      };

      // 缓存结果
      await this.cacheManager.set(cacheKey, result);

      // 发送进度更新
      parentPort?.postMessage({
        type: 'progress',
        progress: 90
      });

      // 发送完成结果
      parentPort?.postMessage({
        type: 'completed',
        result: result,
        cost: apiResponse.cost || 0
      });

      this.logger.info(`任务处理完成: ${taskData.taskId}`);

    } catch (error) {
      this.logger.error(`任务处理失败: ${taskData.taskId}`, error);
      
      parentPort?.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async preprocessImage(imageBuffer: Buffer, params: any): Promise<sharp.Sharp> {
    let sharpImage = sharp(imageBuffer);

    // 根据参数调整图片
    if (params.resolution) {
      const [width, height] = params.resolution.split('x').map(Number);
      sharpImage = sharpImage.resize(width, height, { 
        fit: 'inside', 
        withoutEnlargement: true 
      });
    }

    // 质量优化
    if (params.quality === 'high') {
      sharpImage = sharpImage.jpeg({ quality: 95 });
    } else if (params.quality === 'balanced') {
      sharpImage = sharpImage.jpeg({ quality: 85 });
    } else {
      sharpImage = sharpImage.jpeg({ quality: 75 });
    }

    return sharpImage;
  }

  private async getTemplate(templateId: string): Promise<Template | null> {
    // 这里应该从数据库或配置文件读取模板
    // 暂时返回一些预设模板
    const templates = this.getBuiltInTemplates();
    return templates.find(t => t.id === templateId) || null;
  }

  private getBuiltInTemplates(): Template[] {
    return [
      {
        id: 'ecommerce-white-bg',
        name: '电商白底图',
        description: '将图片背景变为纯白色，适合电商产品展示',
        category: 'product',
        prompt: 'Remove background and replace with pure white background, keep product unchanged, professional product photography',
        negativePrompt: 'distorted, blurry, poor quality, artifacts',
        params: {
          strength: 0.8,
          guidanceScale: 7.5,
          steps: 20,
          resolution: '1024x1024',
          quality: 'balanced'
        },
        isBuiltIn: true,
        createdAt: new Date()
      },
      {
        id: 'portrait-beautify',
        name: '人像美化',
        description: '自然美化人像，保持真实感',
        category: 'portrait',
        prompt: 'Natural portrait enhancement, smooth skin, bright eyes, natural makeup, maintain facial features',
        negativePrompt: 'over-processed, artificial, plastic surgery, distorted features',
        params: {
          strength: 0.6,
          guidanceScale: 8.0,
          steps: 25,
          resolution: '1024x1024',
          quality: 'high'
        },
        isBuiltIn: true,
        createdAt: new Date()
      },
      {
        id: 'document-scan',
        name: '文档扫描',
        description: '将照片转为清晰的文档效果',
        category: 'document',
        prompt: 'Convert to high-quality document scan, enhance text clarity, remove shadows, increase contrast',
        negativePrompt: 'blurry text, poor contrast, distorted, skewed',
        params: {
          strength: 0.9,
          guidanceScale: 7.0,
          steps: 15,
          resolution: '1920x1080',
          quality: 'high'
        },
        isBuiltIn: true,
        createdAt: new Date()
      },
      {
        id: 'landscape-enhance',
        name: '风景增强',
        description: '增强风景照片的色彩和细节',
        category: 'landscape',
        prompt: 'Enhance landscape photo, vibrant colors, clear details, beautiful sky, professional photography',
        negativePrompt: 'over-saturated, artificial colors, HDR artifacts',
        params: {
          strength: 0.7,
          guidanceScale: 7.5,
          steps: 20,
          resolution: '1920x1080',
          quality: 'balanced'
        },
        isBuiltIn: true,
        createdAt: new Date()
      },
      {
        id: 'artistic-style',
        name: '艺术风格',
        description: '将照片转换为艺术作品风格',
        category: 'artistic',
        prompt: 'Convert to artistic style, painting-like, beautiful colors, artistic effect, creative interpretation',
        negativePrompt: 'realistic, photographic, literal',
        params: {
          strength: 0.8,
          guidanceScale: 8.5,
          steps: 30,
          resolution: '1024x1024',
          quality: 'high'
        },
        isBuiltIn: true,
        createdAt: new Date()
      }
    ];
  }
}

// 工作线程主逻辑
if (parentPort) {
  const { taskId, imageId, templateId, userDataPath } = workerData as WorkerTaskData;
  const worker = new TaskWorker(userDataPath);

  worker.processTask({ taskId, imageId, templateId, userDataPath })
    .then(() => {
      // parentPort.postMessage({ type: 'completed' }); // 已经在processTask中发送了更详细的结果
    })
    .catch((error) => {
      parentPort?.postMessage({ 
        type: 'error', 
        error: error instanceof Error ? error.message : String(error) 
      });
    });
}