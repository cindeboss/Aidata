import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import type { SheetInfo, ColumnType } from '../types'

interface ParseResult {
  type: 'csv' | 'excel' | 'json'
  sheets: SheetInfo[]
  rowCount: number
  quality: number
}

// 检测列类型
function detectColumnType(values: any[]): ColumnType {
  const nonEmpty = values.filter((v) => v !== null && v !== undefined && v !== '')
  if (nonEmpty.length === 0) return 'empty'

  const types = new Set<ColumnType>()

  for (const val of nonEmpty) {
    if (typeof val === 'boolean') {
      types.add('boolean')
    } else if (typeof val === 'number') {
      types.add('number')
    } else if (val instanceof Date || (!isNaN(Date.parse(val)) && typeof val === 'string')) {
      types.add('date')
    } else {
      types.add('string')
    }
  }

  if (types.size === 1) {
    return Array.from(types)[0]
  }
  return 'mixed'
}

// 计算数据质量
function calculateQuality(data: any[][]): number {
  if (data.length === 0) return 100

  let totalCells = 0
  let emptyCells = 0
  let duplicateRows = 0
  const seenRows = new Set<string>()

  for (const row of data) {
    const rowKey = JSON.stringify(row)
    if (seenRows.has(rowKey)) {
      duplicateRows++
    } else {
      seenRows.add(rowKey)
    }

    for (const cell of row) {
      totalCells++
      if (cell === null || cell === undefined || cell === '') {
        emptyCells++
      }
    }
  }

  const emptyScore = totalCells > 0 ? ((totalCells - emptyCells) / totalCells) * 60 : 60
  const duplicateScore = data.length > 0 ? ((data.length - duplicateRows) / data.length) * 40 : 40

  return Math.round(emptyScore + duplicateScore)
}

// 解析 CSV 文件
async function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        const data = results.data as any[][]
        if (data.length === 0) {
          reject(new Error('CSV 文件为空'))
          return
        }

        const headers = data[0] as string[]
        const rows = data.slice(1)

        const sheets: SheetInfo[] = [
          {
            name: 'Sheet1',
            headers: headers.map((h) => String(h || '')),
            rowCount: rows.length,
            columnTypes: headers.map((_, i) => detectColumnType(rows.map((r) => r[i]))),
          },
        ]

        resolve({
          type: 'csv',
          sheets,
          rowCount: rows.length,
          quality: calculateQuality(rows),
        })
      },
      error: (error) => reject(error),
    })
  })
}

// 解析 Excel 文件
async function parseExcel(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })

        const sheets: SheetInfo[] = []
        let totalRows = 0
        let totalQuality = 0

        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

          if (jsonData.length === 0) continue

          const headers = (jsonData[0] as any[]).map((h) => String(h || `Column ${jsonData[0].indexOf(h) + 1}`))
          const rows = jsonData.slice(1)

          sheets.push({
            name: sheetName,
            headers,
            rowCount: rows.length,
            columnTypes: headers.map((_, i) => detectColumnType(rows.map((r) => r[i]))),
          })

          totalRows += rows.length
          totalQuality += calculateQuality(rows)
        }

        if (sheets.length === 0) {
          reject(new Error('Excel 文件没有有效的工作表'))
          return
        }

        resolve({
          type: 'excel',
          sheets,
          rowCount: totalRows,
          quality: Math.round(totalQuality / sheets.length),
        })
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsArrayBuffer(file)
  })
}

// 解析 JSON 文件
async function parseJSON(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        let data = JSON.parse(content)

        // 确保是数组
        if (!Array.isArray(data)) {
          if (typeof data === 'object') {
            data = [data]
          } else {
            reject(new Error('JSON 格式不正确'))
            return
          }
        }

        if (data.length === 0) {
          reject(new Error('JSON 文件为空'))
          return
        }

        // 获取所有键作为表头
        const headers = [...new Set(data.flatMap((item: any) => (typeof item === 'object' ? Object.keys(item) : [])))] as string[]

        const rows: any[][] = data.map((item: any) => {
          if (typeof item === 'object') {
            return headers.map((h: string) => item[h])
          }
          return [item]
        })

        const sheets: SheetInfo[] = [
          {
            name: 'Data',
            headers,
            rowCount: rows.length,
            columnTypes: headers.map((_, i) => detectColumnType(rows.map((r: any[]) => r[i]))),
          },
        ]

        resolve({
          type: 'json',
          sheets,
          rowCount: rows.length,
          quality: calculateQuality(rows),
        })
      } catch (error) {
        reject(new Error('JSON 解析失败'))
      }
    }
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsText(file)
  })
}

// 主解析函数
export async function parseFile(file: File): Promise<ParseResult> {
  const extension = file.name.split('.').pop()?.toLowerCase()

  switch (extension) {
    case 'csv':
      return parseCSV(file)
    case 'xlsx':
    case 'xls':
      return parseExcel(file)
    case 'json':
      return parseJSON(file)
    default:
      throw new Error(`不支持的文件格式: ${extension}`)
  }
}
