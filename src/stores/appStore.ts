import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppConfig, Task, Template, ImageFile } from '../types';

interface AppStore {
  // 配置状态
  config: AppConfig;
  setConfig: (key: string, value: any) => void;
  resetConfig: () => void;
  
  // 任务状态
  tasks: Task[];
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  removeTask: (taskId: string) => void;
  clearCompletedTasks: () => void;
  
  // 模板状态
  templates: Template[];
  addTemplate: (template: Template) => void;
  updateTemplate: (templateId: string, updates: Partial<Template>) => void;
  removeTemplate: (templateId: string) => void;
  
  // 图片状态
  images: ImageFile[];
  addImages: (images: ImageFile[]) => void;
  updateImage: (imageId: string, updates: Partial<ImageFile>) => void;
  removeImage: (imageId: string) => void;
  clearImages: () => void;
  
  // UI状态
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  
  selectedTemplateId: string | null;
  setSelectedTemplateId: (templateId: string | null) => void;
  
  // 统计信息
  stats: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    processingTasks: number;
    totalCost: number;
  };
  updateStats: () => void;
}

const defaultConfig: AppConfig = {
  general: {
    theme: 'system',
    language: 'zh-CN',
    autoSave: true,
    autoSaveInterval: 300
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

// 内置模板
const defaultTemplates: Template[] = [
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

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // 配置状态
      config: defaultConfig,
      setConfig: (key: string, value: any) => {
        set((state) => {
          const keys = key.split('.');
          const newConfig = { ...state.config };
          let current: any = newConfig;
          
          for (let i = 0; i < keys.length - 1; i++) {
            current[keys[i]] = { ...current[keys[i]] };
            current = current[keys[i]];
          }
          
          current[keys[keys.length - 1]] = value;
          
          return { config: newConfig };
        });
      },
      resetConfig: () => set({ config: defaultConfig }),
      
      // 任务状态
      tasks: [],
      addTask: (task: Task) => {
        set((state) => ({ tasks: [...state.tasks, task] }));
        get().updateStats();
      },
      updateTask: (taskId: string, updates: Partial<Task>) => {
        set((state) => ({
          tasks: state.tasks.map(task =>
            task.id === taskId ? { ...task, ...updates } : task
          )
        }));
        get().updateStats();
      },
      removeTask: (taskId: string) => {
        set((state) => ({
          tasks: state.tasks.filter(task => task.id !== taskId)
        }));
        get().updateStats();
      },
      clearCompletedTasks: () => {
        set((state) => ({
          tasks: state.tasks.filter(task => task.status !== 'completed')
        }));
        get().updateStats();
      },
      
      // 模板状态
      templates: defaultTemplates,
      addTemplate: (template: Template) => {
        set((state) => ({ templates: [...state.templates, template] }));
      },
      updateTemplate: (templateId: string, updates: Partial<Template>) => {
        set((state) => ({
          templates: state.templates.map(template =>
            template.id === templateId ? { ...template, ...updates } : template
          )
        }));
      },
      removeTemplate: (templateId: string) => {
        set((state) => ({
          templates: state.templates.filter(template => template.id !== templateId)
        }));
      },
      
      // 图片状态
      images: [],
      addImages: (images: ImageFile[]) => {
        set((state) => ({ images: [...state.images, ...images] }));
      },
      updateImage: (imageId: string, updates: Partial<ImageFile>) => {
        set((state) => ({
          images: state.images.map(image =>
            image.id === imageId ? { ...image, ...updates } : image
          )
        }));
      },
      removeImage: (imageId: string) => {
        set((state) => ({
          images: state.images.filter(image => image.id !== imageId)
        }));
      },
      clearImages: () => set({ images: [] }),
      
      // UI状态
      isLoading: false,
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      
      selectedTemplateId: 'ecommerce-white-bg',
      setSelectedTemplateId: (templateId: string | null) =>
        set({ selectedTemplateId: templateId }),
      
      // 统计信息
      stats: {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        processingTasks: 0,
        totalCost: 0
      },
      updateStats: () => {
        const tasks = get().tasks;
        const stats = {
          totalTasks: tasks.length,
          completedTasks: tasks.filter(task => task.status === 'completed').length,
          failedTasks: tasks.filter(task => task.status === 'failed').length,
          processingTasks: tasks.filter(task => task.status === 'processing').length,
          totalCost: tasks.reduce((sum, task) => sum + task.cost, 0)
        };
        set({ stats });
      }
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        config: state.config,
        templates: state.templates,
        selectedTemplateId: state.selectedTemplateId
      })
    }
  )
);