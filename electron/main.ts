import { app, BrowserWindow, ipcMain, dialog, FileFilter } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as https from 'https'
import * as http from 'http'
import * as XLSX from 'xlsx'

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

  // 开发环境加载 Vite 开发服务器，生产环境加载打包文件
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
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

// AI API 调用（绑过 CORS）
ipcMain.handle('ai:call', async (event, url: string, options: {
  method: string
  headers: Record<string, string>
  body: string
}) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const isHttps = urlObj.protocol === 'https:'
    const lib = isHttps ? https : http

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'POST',
      headers: options.headers,
    }

    const req = lib.request(reqOptions, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data)
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, data: jsonData, status: res.statusCode })
          } else {
            resolve({ success: false, error: jsonData.error?.message || `HTTP ${res.statusCode}`, status: res.statusCode })
          }
        } catch {
          resolve({ success: false, error: `HTTP ${res.statusCode}: ${data}`, status: res.statusCode })
        }
      })
    })

    req.on('error', (error) => {
      resolve({ success: false, error: error.message })
    })

    if (options.body) {
      req.write(options.body)
    }
    req.end()
  })
})

// 读取 Excel sheet 的完整数据
// 支持传入 headerRow 指定表头行（0-based），不传入则自动推断
ipcMain.handle('excel:readSheet', async (event, filePath: string, sheetName: string, headerRow?: number) => {
  try {
    const workbook = XLSX.readFile(filePath)
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) {
      return { success: false, error: `Sheet "${sheetName}" not found` }
    }

    // 读取为 JSON，获取完整数据
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][]

    // 确定表头行
    let actualHeaderRow = headerRow ?? 0

    // 如果没有指定 headerRow，尝试自动推断（找第一个有多个非空值的行）
    if (headerRow === undefined) {
      for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
        const row = jsonData[i]
        if (row) {
          const nonEmptyCount = row.filter(c => c !== null && c !== undefined && c !== '').length
          // 如果一行有超过 3 个非空值，认为是表头
          if (nonEmptyCount >= 3) {
            actualHeaderRow = i
            break
          }
        }
      }
    }

    // 获取表头
    const headers = (jsonData[actualHeaderRow] || []).map((h: any) => String(h || '').trim())

    // 数据行（从表头行的下一行开始）
    const rows = jsonData.slice(actualHeaderRow + 1).map((row: any) => {
      const rowData: Record<string, any> = {}
      headers.forEach((h: string, i: number) => {
        rowData[h] = row[i] ?? null
      })
      return rowData
    }).filter((row: any) => Object.values(row).some(v => v !== null))

    return {
      success: true,
      data: {
        headers,
        rows,
        rowCount: rows.length,
        headerRow: actualHeaderRow  // 返回实际使用的表头行
      }
    }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// 导出数据为 JSON 文件
ipcMain.handle('data:exportJSON', async (event, data: any[], filePath: string) => {
  try {
    // 确保目录存在
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const jsonContent = JSON.stringify(data, null, 2)
    fs.writeFileSync(filePath, jsonContent, 'utf-8')
    return { success: true, path: filePath }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// 导出数据为 CSV 文件
ipcMain.handle('data:exportCSV', async (event, headers: string[], rows: any[][], filePath: string) => {
  try {
    // 确保目录存在
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const csvContent = XLSX.utils.sheet_to_csv(worksheet)
    fs.writeFileSync(filePath, csvContent, 'utf-8')
    return { success: true, path: filePath }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// 保存上传的文件到临时目录
ipcMain.handle('file:saveTemp', async (event, fileName: string, buffer: ArrayBuffer) => {
  try {
    const tempDir = path.join(app.getPath('userData'), 'temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    const filePath = path.join(tempDir, `${Date.now()}_${fileName}`)
    fs.writeFileSync(filePath, Buffer.from(buffer))

    // 记录调试日志
    const logPath = path.join(app.getPath('userData'), 'debug.log')
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] saveTemp: ${fileName} -> ${filePath}\n`)

    return { success: true, path: filePath }
  } catch (error) {
    const logPath = path.join(app.getPath('userData'), 'debug.log')
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] saveTemp ERROR: ${(error as Error).message}\n`)
    return { success: false, error: (error as Error).message }
  }
})
