import { app, BrowserWindow, ipcMain, dialog, FileFilter } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
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
  })

  // 开发环境加载 Vite 开发服务器
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

// IPC 处理器

// 打开文件对话框
ipcMain.handle('dialog:openFile', async (event, filters?: FileFilter[]) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections'],
    filters: filters || [
      { name: 'Data Files', extensions: ['csv', 'xlsx', 'xls', 'json'] },
      { name: 'CSV', extensions: ['csv'] },
      { name: 'Excel', extensions: ['xlsx', 'xls'] },
      { name: 'JSON', extensions: ['json'] },
    ],
  })
  return result.filePaths
})

// 保存文件对话框
ipcMain.handle('dialog:saveFile', async (event, defaultName?: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: defaultName,
    filters: [
      { name: 'Excel', extensions: ['xlsx'] },
      { name: 'CSV', extensions: ['csv'] },
      { name: 'JSON', extensions: ['json'] },
    ],
  })
  return result.filePath
})

// 读取文件
ipcMain.handle('file:read', async (event, filePath: string) => {
  try {
    const content = fs.readFileSync(filePath)
    return { success: true, data: content, path: filePath }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// 写入文件
ipcMain.handle('file:write', async (event, filePath: string, data: Buffer | string) => {
  try {
    fs.writeFileSync(filePath, data)
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// 获取用户数据目录
ipcMain.handle('app:getUserDataPath', () => {
  return app.getPath('userData')
})
