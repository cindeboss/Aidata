// 本地存储工具
// 在 Electron 中使用 electron-store，在浏览器中使用 localStorage

const STORAGE_KEY = 'dataclean-ai-data'

interface StorageData {
  files: any[]
  flows: any[]
  settings: {
    theme: 'light' | 'dark'
    language: 'zh' | 'en'
    aiProvider?: string
    apiKey?: string
  }
}

const defaultData: StorageData = {
  files: [],
  flows: [],
  settings: {
    theme: 'light',
    language: 'zh',
  },
}

// 保存数据
export async function saveData(data: Partial<StorageData>): Promise<void> {
  try {
    const existing = await loadData()
    const merged = { ...existing, ...data }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch (error) {
    console.error('Failed to save data:', error)
  }
}

// 加载数据
export async function loadData(): Promise<StorageData> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...defaultData, ...JSON.parse(stored) }
    }
  } catch (error) {
    console.error('Failed to load data:', error)
  }
  return defaultData
}

// 清除数据
export async function clearData(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY)
}

// 导出项目
export async function exportProject(): Promise<Blob> {
  const data = await loadData()
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}

// 导入项目
export async function importProject(file: File): Promise<StorageData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content)
        resolve({ ...defaultData, ...data })
      } catch (error) {
        reject(new Error('无法解析项目文件'))
      }
    }
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsText(file)
  })
}

// 获取设置
export async function getSettings(): Promise<StorageData['settings']> {
  const data = await loadData()
  return data.settings
}

// 保存设置
export async function saveSettings(settings: Partial<StorageData['settings']>): Promise<void> {
  const data = await loadData()
  await saveData({
    settings: { ...data.settings, ...settings },
  })
}
