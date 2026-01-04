import { contextBridge, ipcRenderer } from 'electron';

// 安全的IPC接口暴露给渲染进程
const electronAPI = {
  // 任务管理
  addTask: (taskData: any) => ipcRenderer.invoke('task:add', taskData),
  pauseTask: (taskId: string) => ipcRenderer.invoke('task:pause', taskId),
  resumeTask: (taskId: string) => ipcRenderer.invoke('task:resume', taskId),
  cancelTask: (taskId: string) => ipcRenderer.invoke('task:cancel', taskId),
  getTaskStats: () => ipcRenderer.invoke('task:get-stats'),
  getTaskList: (filters?: any) => ipcRenderer.invoke('task:get-list', filters),

  // 文件操作
  selectFiles: (options: any) => ipcRenderer.invoke('file:select', options),
  saveFile: (options: any) => ipcRenderer.invoke('file:save', options),
  readImageInfo: (filePath: string) => ipcRenderer.invoke('file:read-image-info', filePath),

  // 配置管理
  getConfig: (key: string) => ipcRenderer.invoke('config:get', key),
  setConfig: (key: string, value: any) => ipcRenderer.invoke('config:set', key, value),
  resetConfig: () => ipcRenderer.invoke('config:reset'),

  // 热文件夹
  startHotFolder: (config: any) => ipcRenderer.invoke('hotfolder:start', config),
  stopHotFolder: () => ipcRenderer.invoke('hotfolder:stop'),
  getHotFolderStatus: () => ipcRenderer.invoke('hotfolder:get-status'),

  // 系统集成
  installContextMenu: () => ipcRenderer.invoke('system:install-context-menu'),
  uninstallContextMenu: () => ipcRenderer.invoke('system:uninstall-context-menu'),

  // 通知
  showNotification: (notification: any) => ipcRenderer.invoke('notification:show', notification),

  // 应用信息
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  getAppPath: (name: string) => ipcRenderer.invoke('app:get-path', name),
  restartApp: () => ipcRenderer.invoke('app:restart'),

  // 事件监听
  onTaskProgress: (callback: (taskId: string, progress: any) => void) => {
    ipcRenderer.on('task:progress', (_, taskId, progress) => callback(taskId, progress));
  },

  onTaskCompleted: (callback: (taskId: string, result: any) => void) => {
    ipcRenderer.on('task:completed', (_, taskId, result) => callback(taskId, result));
  },

  onTaskFailed: (callback: (taskId: string, error: string) => void) => {
    ipcRenderer.on('task:failed', (_, taskId, error) => callback(taskId, error));
  },

  onHotFolderNewFile: (callback: (filePath: string) => void) => {
    ipcRenderer.on('hotfolder:new-file', (_, filePath) => callback(filePath));
  },

  onShowSettings: (callback: () => void) => {
    ipcRenderer.on('show-settings', callback);
  },

  // 移除事件监听
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
};

// 将API暴露给渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// 定义全局类型声明
declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}