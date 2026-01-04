// 图片相关类型
export interface ImageFile {
  id: string;
  name: string;
  path: string;
  size: number;
  width: number;
  height: number;
  format: string;
  createdAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: ProcessedImage;
  error?: string;
}

export interface ProcessedImage {
  id: string;
  originalPath: string;
  processedPath: string;
  thumbnailPath: string;
  width: number;
  height: number;
  format: string;
  size: number;
  processedAt: Date;
  templateId: string;
  apiProvider: 'doubao' | 'gemini';
  cost: number;
}

// 模板相关类型
export interface Template {
  id: string;
  name: string;
  description: string;
  category: 'portrait' | 'product' | 'landscape' | 'document' | 'artistic';
  prompt: string;
  negativePrompt?: string;
  params: TemplateParams;
  thumbnail?: string;
  isBuiltIn: boolean;
  createdAt: Date;
}

export interface TemplateParams {
  strength: number; // 0-1，处理强度
  guidanceScale?: number; // 引导比例
  steps?: number; // 推理步数
  resolution?: '512x512' | '1024x1024' | '1920x1080' | '2560x1440';
  quality?: 'fast' | 'balanced' | 'high';
}

// 任务队列相关类型
export interface Task {
  id: string;
  imageId: string;
  templateId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  priority: number; // 1-10，数字越大优先级越高
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
  progress: number;
  result?: ProcessedImage;
  error?: string;
  cost: number;
}

// API相关类型
export interface ApiConfig {
  provider: 'doubao' | 'gemini';
  apiKey: string;
  endpoint?: string;
  maxRetries: number;
  retryDelay: number;
  rateLimit: number; // 每秒最大请求数
  enabled: boolean;
}

export interface ApiRequest {
  imageData: string;
  prompt: string;
  negativePrompt?: string;
  params: TemplateParams;
}

export interface ApiResponse {
  success: boolean;
  imageData?: string;
  cost?: number;
  error?: string;
  processingTime?: number;
}

// 应用配置类型
export interface AppConfig {
  general: {
    theme: 'light' | 'dark' | 'system';
    language: 'zh-CN' | 'en-US';
    autoSave: boolean;
    autoSaveInterval: number; // 秒
  };
  processing: {
    maxConcurrentTasks: number;
    defaultApiProvider: 'doubao' | 'gemini';
    outputFormat: 'jpg' | 'png';
    quality: number; // 1-100
    compressionLevel: number; // 1-9
    enableOptimization: boolean;
  };
  hotFolder: {
    enabled: boolean;
    inputPath: string;
    outputPath: string;
    templateId: string;
    filePatterns: string[];
    autoStart: boolean;
  };
  system: {
    minimizeToTray: boolean;
    showNotifications: boolean;
    closeToTray: boolean;
    startOnBoot: boolean;
  };
  cost: {
    dailyBudget: number;
    monthlyBudget: number;
    costAlertEnabled: boolean;
    costAlertThreshold: number; // 百分比
  };
}

// 缓存相关类型
export interface CacheEntry {
  key: string;
  originalHash: string;
  processedHash: string;
  templateId: string;
  params: TemplateParams;
  imagePath: string;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  size: number;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number; // 字节
  hitRate: number; // 0-1
  hitCount: number;
  missCount: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

// 日志相关类型
export interface LogEntry {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  source: string;
  metadata?: Record<string, any>;
  taskId?: string;
  imageId?: string;
}

// UI相关类型
export interface NotificationMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: () => void;
}

export interface ProgressInfo {
  taskId: string;
  imageName: string;
  status: string;
  progress: number; // 0-100
  estimatedTimeRemaining?: number; // 秒
  speed?: number; // 张/秒
}

// 右键菜单类型
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  enabled?: boolean;
  separator?: boolean;
  submenu?: ContextMenuItem[];
}