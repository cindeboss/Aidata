"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 15, y: 15 },
        backgroundColor: '#f8f9fa',
    });
    // 开发环境加载 Vite 开发服务器
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
// IPC 处理器
// 打开文件对话框
electron_1.ipcMain.handle('dialog:openFile', async (event, filters) => {
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: filters || [
            { name: 'Data Files', extensions: ['csv', 'xlsx', 'xls', 'json'] },
            { name: 'CSV', extensions: ['csv'] },
            { name: 'Excel', extensions: ['xlsx', 'xls'] },
            { name: 'JSON', extensions: ['json'] },
        ],
    });
    return result.filePaths;
});
// 保存文件对话框
electron_1.ipcMain.handle('dialog:saveFile', async (event, defaultName) => {
    const result = await electron_1.dialog.showSaveDialog(mainWindow, {
        defaultPath: defaultName,
        filters: [
            { name: 'Excel', extensions: ['xlsx'] },
            { name: 'CSV', extensions: ['csv'] },
            { name: 'JSON', extensions: ['json'] },
        ],
    });
    return result.filePath;
});
// 读取文件
electron_1.ipcMain.handle('file:read', async (event, filePath) => {
    try {
        const content = fs.readFileSync(filePath);
        return { success: true, data: content, path: filePath };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// 写入文件
electron_1.ipcMain.handle('file:write', async (event, filePath, data) => {
    try {
        fs.writeFileSync(filePath, data);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// 获取用户数据目录
electron_1.ipcMain.handle('app:getUserDataPath', () => {
    return electron_1.app.getPath('userData');
});
// AI API 调用（绑过 CORS）
electron_1.ipcMain.handle('ai:call', async (event, url, options) => {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const lib = isHttps ? https : http;
        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'POST',
            headers: options.headers,
        };
        const req = lib.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ success: true, data: jsonData, status: res.statusCode });
                    }
                    else {
                        resolve({ success: false, error: jsonData.error?.message || `HTTP ${res.statusCode}`, status: res.statusCode });
                    }
                }
                catch {
                    resolve({ success: false, error: `HTTP ${res.statusCode}: ${data}`, status: res.statusCode });
                }
            });
        });
        req.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
});
