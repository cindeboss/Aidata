// Sheet 分析服务
import type { RawSheetData, TableStructureAnalysis } from '../types'
import { callAI, type AIConfig, type AIMessage } from './aiService'

// 单个 Sheet 分析结果
export interface SheetAnalysisResult {
  name: string
  type: 'standard' | 'irregular' | 'unknown'
  typeReason?: string
  headerRow: number
  dataStartRow: number
  fields: string[]
  confidence: number
}

// 分析 Prompt - 让 AI 自主判断表头位置
const BATCH_SHEET_ANALYSIS_PROMPT = `分析 Excel 工作表，找出表头位置和字段名。

我会提供每个 sheet 的前 15 行原始数据。

你的任务：
1. 看数据，判断哪一行是表头（列标题）
2. 判断数据从哪一行开始
3. **提取表头那一行的所有字段名称，放到 fields 数组中**

返回 JSON：
{
  "sheets": [
    {
      "name": "sheet名称",
      "type": "standard" | "irregular",
      "headerRow": 数字,
      "dataStartRow": 数字,
      "fields": ["字段1", "字段2", "字段3", ...],
      "confidence": 0.9
    }
  ]
}

重要：
- type 为 standard 时，必须返回完整的 fields 数组（包含所有列名）
- type 为 irregular 时，fields 可以为空数组
- headerRow 从 0 开始计数

只返回 JSON。`

// 批量分析所有 sheets
export async function analyzeAllSheets(
  sheetsData: { name: string; rawData: RawSheetData }[],
  config: AIConfig,
  onProgress?: (current: number, total: number, sheetName: string) => void
): Promise<SheetAnalysisResult[]> {
  console.log('[analyzeAllSheets] Starting batch analysis for', sheetsData.length, 'sheets')

  if (config.provider === 'local') {
    return sheetsData.map(sheet => ({
      name: sheet.name,
      type: 'unknown' as const,
      typeReason: 'Local mode does not support auto analysis',
      headerRow: 0,
      dataStartRow: 1,
      fields: [],
      confidence: 0,
    }))
  }

  try {
    onProgress?.(0, sheetsData.length, '')

    // 构建每个 sheet 的原始数据（给 AI 50 行数据用于分析）
    const sheetsWithData = sheetsData.map(sheet => {
      const cells = sheet.rawData.cells.slice(0, 50)
      // 格式化单元格数据
      const rows = cells.map((row, rowIndex) => {
        const values = row.map(c => c.value === null || c.value === undefined || c.value === '' ? '(空)' : String(c.value))
        return `  Row ${rowIndex}: ${values.join(' | ')}`
      }).join('\n')

      return {
        name: sheet.name,
        rows: rows,
        mergeCount: sheet.rawData.merges.length,
      }
    })

    // 构建 userMessage，包含原始数据
    const sheetsInfo = sheetsWithData.map((s, i) => {
      return `\n=== Sheet ${i + 1}: ${s.name} ===\n${s.rows}\n(共 ${s.mergeCount} 处合并单元格)`
    }).join('\n')

    const userMessage = `请分析以下 ${sheetsData.length} 个 Excel 工作表，找出每个 sheet 的表头位置：\n${sheetsInfo}\n\n返回 JSON。`

    const messages: AIMessage[] = [
      { role: 'system', content: BATCH_SHEET_ANALYSIS_PROMPT },
      { role: 'user', content: userMessage },
    ]

    onProgress?.(1, sheetsData.length, '请求 AI 分析...')

    const response = await callAI(messages, config)
    console.log('[analyzeAllSheets] AI response:', response.substring(0, 500))

    onProgress?.(2, sheetsData.length, '解析结果...')

    const parsed = parseAIJsonResponse(response)
    console.log('[analyzeAllSheets] Parsed result:', JSON.stringify(parsed, null, 2))

    // 处理各种可能的返回格式
    let sheetsList = null
    if (parsed && Array.isArray(parsed.sheets)) {
      sheetsList = parsed.sheets
    } else if (parsed && parsed.analysis && Array.isArray(parsed.analysis.sheets)) {
      // AI 返回 { analysis: { sheets: [...] } }
      sheetsList = parsed.analysis.sheets
    } else if (parsed && parsed.data && Array.isArray(parsed.data.sheets)) {
      sheetsList = parsed.data.sheets
    }

    if (sheetsList) {
      const results = sheetsList.map((s: any) => {
        // 智能推断 type：如果 AI 没返回 type，根据 purpose/name/内容推断
        let sheetType = s.type || s.sheet_type || s.role

        // 根据 purpose 推断
        if (!sheetType && s.purpose) {
          const purpose = String(s.purpose).toLowerCase()
          if (purpose.includes('明细') || purpose.includes('transaction') || purpose.includes('detail') ||
              purpose.includes('数据') || purpose.includes('明细表')) {
            sheetType = 'standard'
          } else if (purpose.includes('目录') || purpose.includes('说明') || purpose.includes('汇总') ||
                     purpose.includes('索引') || purpose.includes('overview') || purpose.includes('summary') ||
                     purpose.includes('导航') || purpose.includes('文档')) {
            sheetType = 'irregular'
          }
        }

        // 根据 name 推断
        const sheetName = s.name || s.sheet_name || ''
        if (!sheetType && sheetName) {
          const nameLower = String(sheetName).toLowerCase()
          if (nameLower.includes('目录') || nameLower.includes('说明') || nameLower.includes('汇总') ||
              nameLower.includes('索引') || nameLower.includes('导航')) {
            sheetType = 'irregular'
          } else if (nameLower.includes('明细') || nameLower.includes('对账单') || nameLower.includes('数据') ||
                     nameLower.includes('record') || nameLower.includes('detail')) {
            sheetType = 'standard'
          }
        }

        // 根据 columns 数量推断（有列数的通常是表格）
        if (!sheetType && s.columns > 0) {
          // 列数大于5且小于100的，通常是明细表
          if (s.columns > 5 && s.columns < 100) {
            sheetType = 'standard'
          } else if (s.columns <= 5) {
            // 列数很少的可能是目录/说明
            sheetType = 'irregular'
          }
        }

        // 默认类型
        if (!sheetType) {
          sheetType = 'unknown'
        }

        // 获取原始的 sheet 数据用于推断
        const originalSheet = sheetsData.find(sd => sd.name === (s.name || s.sheet_name))

        // 使用 AI 返回的值，如果没有则尝试从 rawData 推断
        let headerRow = s.headerRow ?? s.header_row ?? s.header_rows ?? 0
        // 如果 AI 明确返回了 null，说明是异形表格
        if (s.headerRow === null || s.header_row === null) {
          headerRow = -1 // 标记为无表头
        }

        let fields: string[] = s.fields || s.header_columns || s.columns_list || s.columns || []

        // 如果 AI 没返回 fields 但有 header_row，尝试从 rawData 提取
        if (fields.length === 0 && headerRow >= 0 && originalSheet?.rawData) {
          const rawData = originalSheet.rawData
          const row = rawData.cells[headerRow]
          if (row) {
            fields = row
              .map(c => String(c.value || '').trim())
              .filter(f => f && f !== 'null' && f !== 'undefined')
          }
        }

        // 如果还是没找到，尝试自动推断
        if (fields.length === 0 && originalSheet?.rawData) {
          const rawData = originalSheet.rawData
          const candidates = []
          for (let r = 0; r < Math.min(rawData.cells.length, 10); r++) {
            const row = rawData.cells[r]
            if (row) {
              const values = row
                .map(c => String(c.value || '').trim())
                .filter(f => f && f !== 'null' && f !== 'undefined')
              if (values.length > 3) {
                candidates.push({ row: r, values, count: values.length })
              }
            }
          }
          if (candidates.length > 0) {
            const best = candidates.sort((a, b) => b.count - a.count)[0]
            fields = best.values
            headerRow = best.row
          }
        }

        return {
          name: s.name || s.sheet_name || '',
          type: mapSheetType(sheetType),
          typeReason: s.typeReason || s.note || s.purpose || '',
          headerRow: headerRow >= 0 ? headerRow : 0,
          dataStartRow: headerRow >= 0 ? (headerRow + 1) : 0,
          fields: fields,
          confidence: s.confidence ?? (fields.length > 0 ? 0.8 : 0.5),
        }
      })

      onProgress?.(sheetsData.length, sheetsData.length, '分析完成')
      return results
    }

    return sheetsData.map(sheet => inferSingleSheetStructure(sheet.rawData, sheet.name))
  } catch (error) {
    console.error('[analyzeAllSheets] Error:', error)
    return sheetsData.map(sheet => inferSingleSheetStructure(sheet.rawData, sheet.name))
  }
}

// 映射 sheet 类型 - 直接使用 AI 返回的类型
function mapSheetType(type: string): 'standard' | 'irregular' | 'unknown' {
  if (!type) return 'unknown'
  const lower = String(type).toLowerCase()

  if (lower === 'standard' || lower === '标准' || lower === '明细') {
    return 'standard'
  }
  if (lower === 'irregular' || lower === '异形' || lower === '汇总' || lower === '目录') {
    return 'irregular'
  }

  return 'unknown'
}

// 解析 AI 返回的 JSON
function parseAIJsonResponse(response: string): any {
  const backtick = '\u0060'
  const pattern = backtick + backtick + backtick + 'json\\s*([\\s\\S]*?)' + backtick + backtick + backtick
  const jsonBlockPattern = new RegExp(pattern)
  const jsonBlockMatch = jsonBlockPattern.exec(response)

  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim())
    } catch (e) {}
  }

  const braceIndex = response.indexOf('{')
  if (braceIndex !== -1) {
    let depth = 0
    let endIndex = braceIndex
    for (let i = braceIndex; i < response.length; i++) {
      if (response[i] === '{') depth++
      if (response[i] === '}') depth--
      if (depth === 0) {
        endIndex = i + 1
        break
      }
    }
    try {
      return JSON.parse(response.substring(braceIndex, endIndex))
    } catch (e) {}
  }

  return null
}

// 推断单个 sheet 的结构
function inferSingleSheetStructure(rawData: RawSheetData, name: string): SheetAnalysisResult {
  const maxCol = rawData.cells[0]?.length || 0
  const maxRow = rawData.cells.length

  let headerRow = 0
  for (let r = 0; r < Math.min(maxRow, 5); r++) {
    const nonEmpty = rawData.cells[r]?.filter(c => c.value !== null && c.value !== '').length || 0
    if (nonEmpty > maxCol / 2) {
      headerRow = r
      break
    }
  }

  const fields = (rawData.cells[headerRow] || []).map(c => String(c.value || '').trim()).filter(f => f)

  return {
    name,
    type: fields.length > 1 ? 'standard' : 'irregular',
    typeReason: fields.length > 1 ? 'Based on default inference' : 'Too few columns',
    headerRow,
    dataStartRow: headerRow + 1,
    fields,
    confidence: 0.4,
  }
}

// 从原始数据推断表格结构
export function inferStructureFromData(rawData: RawSheetData): TableStructureAnalysis {
  const maxCol = rawData.cells[0]?.length || 1
  const maxRow = rawData.cells.length

  let headerRow = 0
  for (let r = 0; r < Math.min(maxRow, 5); r++) {
    const row = rawData.cells[r]
    if (row) {
      const nonEmptyCount = row.filter(c => c.value !== null && c.value !== undefined && c.value !== '').length
      if (nonEmptyCount > 0) {
        headerRow = r
        break
      }
    }
  }

  const headerCells = rawData.cells[headerRow] || []
  const fields = headerCells.map(c => String(c.value || '').trim() || 'Column').filter(f => f)

  return {
    sheetType: fields.length > 1 ? 'standard' : 'irregular',
    sheetTypeReason: fields.length > 1 ? 'Based on default inference' : 'Too few columns',
    headerRow,
    dataStartRow: headerRow + 1,
    fields,
    confidence: 0.4,
    status: 'completed',
    headerRegion: { startRow: headerRow, endRow: headerRow, startCol: 0, endCol: maxCol - 1 },
    fieldHierarchy: fields.map((f, i) => ({
      fullPath: f,
      displayName: f,
      columnIndex: i,
      level: 0,
    })),
    rawHeaders: [headerCells.map(c => String(c.value || ''))],
  }
}
