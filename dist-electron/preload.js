"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// 暴露安全的 API 给渲染进程
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // 文件对话框
    openFile: (filters) => electron_1.ipcRenderer.invoke('dialog:openFile', filters),
    saveFile: (defaultName) => electron_1.ipcRenderer.invoke('dialog:saveFile', defaultName),
    // 文件操作
    readFile: (filePath) => electron_1.ipcRenderer.invoke('file:read', filePath),
    writeFile: (filePath, data) => electron_1.ipcRenderer.invoke('file:write', filePath, data),
    // 应用信息
    getUserDataPath: () => electron_1.ipcRenderer.invoke('app:getUserDataPath'),
    // AI API 调用
    callAI: (url, options) => electron_1.ipcRenderer.invoke('ai:call', url, options),
    // 事件监听
    onFileDrop: (callback) => {
        electron_1.ipcRenderer.on('file-drop', (_event, paths) => callback(paths));
    },
});
