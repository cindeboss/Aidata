import * as XLSX from 'xlsx'
import type { ExportConfig, TableData } from '../types'

// 导出为 Excel
export function exportToExcel(data: TableData, config: ExportConfig): Blob {
  const ws = XLSX.utils.aoa_to_sheet([config.includeHeaders ? data.headers : [], ...data.rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, config.sheetName || 'Sheet1')
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// 导出为 CSV
export function exportToCSV(data: TableData, config: ExportConfig): Blob {
  const rows = config.includeHeaders ? [data.headers, ...data.rows] : data.rows
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  return new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
}

// 导出为 JSON
export function exportToJSON(data: TableData, _config: ExportConfig): Blob {
  const headers = data.headers
  const jsonData = data.rows.map((row) => {
    const obj: Record<string, any> = {}
    headers.forEach((h, i) => {
      obj[h] = row[i]
    })
    return obj
  })
  return new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' })
}

// 主导出函数
export function exportData(data: TableData, config: ExportConfig): Blob {
  switch (config.format) {
    case 'xlsx':
      return exportToExcel(data, config)
    case 'csv':
      return exportToCSV(data, config)
    case 'json':
      return exportToJSON(data, config)
    default:
      throw new Error(`不支持的导出格式: ${config.format}`)
  }
}

// 下载文件
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
