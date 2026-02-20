import { contextBridge, ipcRenderer } from 'electron'

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 文件对话框
  openFile: (filters?: any) => ipcRenderer.invoke('dialog:openFile', filters),
  saveFile: (defaultName?: string) => ipcRenderer.invoke('dialog:saveFile', defaultName),

  // 文件操作
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath: string, data: Buffer | string) => ipcRenderer.invoke('file:write', filePath, data),
  saveTempFile: (fileName: string, buffer: ArrayBuffer) => ipcRenderer.invoke('file:saveTemp', fileName, buffer),

  // 应用信息
  getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),

  // AI API 调用
  callAI: (url: string, options: { method: string; headers: Record<string, string>; body: string }) =>
    ipcRenderer.invoke('ai:call', url, options),

  // Excel 数据处理
  // 支持传入 headerRow 指定表头行（0-based），不传入则自动推断
  readExcelSheet: (filePath: string, sheetName: string, headerRow?: number) =>
    ipcRenderer.invoke('excel:readSheet', filePath, sheetName, headerRow),

  // 数据导出
  exportJSON: (data: any[], filePath: string) =>
    ipcRenderer.invoke('data:exportJSON', data, filePath),
  exportCSV: (headers: string[], rows: any[][], filePath: string) =>
    ipcRenderer.invoke('data:exportCSV', headers, rows, filePath),

  // 事件监听
  onFileDrop: (callback: (paths: string[]) => void) => {
    ipcRenderer.on('file-drop', (_event, paths) => callback(paths))
  },
})

// TypeScript 类型定义
export interface ElectronAPI {
  openFile: (filters?: any) => Promise<string[]>
  saveFile: (defaultName?: string) => Promise<string | undefined>
  readFile: (filePath: string) => Promise<{ success: boolean; data?: Buffer; error?: string; path: string }>
  writeFile: (filePath: string, data: Buffer | string) => Promise<{ success: boolean; error?: string }>
  saveTempFile: (fileName: string, buffer: ArrayBuffer) => Promise<{ success: boolean; path?: string; error?: string }>
  getUserDataPath: () => Promise<string>
  callAI: (url: string, options: { method: string; headers: Record<string, string>; body: string }) =>
    Promise<{ success: boolean; data?: any; error?: string; status?: number }>
  readExcelSheet: (filePath: string, sheetName: string, headerRow?: number) => Promise<{
    success: boolean
    data?: { headers: string[]; rows: any[]; rowCount: number; headerRow: number }
    error?: string
  }>
  exportJSON: (data: any[], filePath: string) => Promise<{ success: boolean; path?: string; error?: string }>
  exportCSV: (headers: string[], rows: any[][], filePath: string) => Promise<{ success: boolean; path?: string; error?: string }>
  onFileDrop: (callback: (paths: string[]) => void) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
