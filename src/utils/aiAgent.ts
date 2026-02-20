// AI Agent - 简化版数据处理
// 不依赖 AI 输出结构化格式，直接在代码中处理用户意图

import type { DataFile } from '../types'
import { useStore } from '../store/useStore'
import { ErrorCode, createAgentResult, createErrorResult, logError } from './errorHandler'

export interface AgentResult {
  success: boolean
  message: string
  data?: any
}

// 解析用户意图，直接执行
export async function executeAgentCommand(
  command: string,
  context: { files: DataFile[] }
): Promise<AgentResult> {
  const { files } = context

  // 意图识别
  const intent = parseIntent(command)

  console.log('[Agent] 意图识别:', {
    command: command.slice(0, 50),
    type: intent.type,
    confidence: intent.confidence.toFixed(2),
    reason: intent.reason
  })

  // 根据置信度决定如何处理
  if (intent.confidence >= 0.8) {
    // 高置信度：直接执行
    console.log('[Agent] 高置信度，直接执行:', intent.type)
    return await executeByIntent(intent, files)

  } else if (intent.confidence >= 0.5) {
    // 中等置信度：执行但提示用户
    console.log('[Agent] 中等置信度，执行并提示:', intent.type)
    const result = await executeByIntent(intent, files)

    // 在结果中添加提示
    if (result.success) {
      return {
        ...result,
        message: result.message + `

💡 提示: 系统以 ${(intent.confidence * 100).toFixed(0)}% 的置信度识别您的意图为"${getIntentDescription(intent)}"，如果不正确请尝试更明确的指令（如"提取机票数据"）。`
      }
    }
    return result

  } else {
    // 低置信度：返回建议，不执行
    console.log('[Agent] 低置信度，返回建议')
    return {
      success: false,
      message: `无法确定您的意图（置信度 ${(intent.confidence * 100).toFixed(0)}%）。

您是想：
1️⃣ 提取数据 - 说"提取机票数据"、"导出酒店信息"
2️⃣ 分析数据 - 说"分析数据质量"、"统计一下"
3️⃣ 转换格式 - 说"转成 JSON"、"导出为 CSV"

请用更明确的指令描述您的需求。`
    }
  }
}

// 根据意图执行对应操作
async function executeByIntent(intent: IntentResult, files: DataFile[]): Promise<AgentResult> {
  switch (intent.type) {
    case 'extract':
      return await handleExtract(intent, files)
    case 'analyze':
      return await handleAnalyze(intent, files)
    case 'transform':
      return await handleTransform(intent, files)
    default:
      return {
        success: false,
        message: '无法识别的指令。支持的指令：提取数据、分析数据、转换格式等'
      }
  }
}

// 获取意图描述
function getIntentDescription(intent: IntentResult): string {
  const typeMap: Record<string, string> = {
    extract: '提取数据',
    analyze: '分析数据',
    transform: '转换格式',
    unknown: '未知'
  }
  let desc = typeMap[intent.type] || intent.type
  if (intent.target) {
    desc += `(${intent.target})`
  }
  return desc
}

// 意图解析结果
export interface IntentResult {
  type: 'extract' | 'analyze' | 'transform' | 'unknown'
  target?: string
  sheet?: string
  confidence: number  // 0-1 置信度
  reason: string      // 置信度计算原因
}

// 带置信度的意图解析
export function parseIntent(command: string): IntentResult {
  const lower = command.toLowerCase()
  let confidence = 0
  let reason = ''

  // 提取数据 - 强关键词
  const extractKeywords = ['提取', '导出', '保存', '下载']
  const extractWeakKeywords = ['我要', '给我', '拿出', '找出']
  const hasExtractKeyword = extractKeywords.some(k => lower.includes(k))
  const hasExtractWeakKeyword = extractWeakKeywords.some(k => lower.includes(k))

  // 分析数据 - 强关键词
  const analyzeKeywords = ['分析', '统计', '查看', '检查', '看看']
  const hasAnalyzeKeyword = analyzeKeywords.some(k => lower.includes(k))

  // 转换格式 - 强关键词
  const transformKeywords = ['转换', '转成', '转为', '转json', '转csv', '转excel']
  const hasTransformKeyword = transformKeywords.some(k => lower.includes(k))

  // 目标关键词
  const targets = ['机票', '酒店', '火车', '用车', '对账单']
  const target = targets.find(t => lower.includes(t))

  // 计算提取置信度
  if (hasExtractKeyword) {
    confidence = 0.9
    reason = `包含强关键词: ${extractKeywords.filter(k => lower.includes(k)).join(', ')}`
    if (target) {
      confidence += 0.05
      reason += `, 识别目标: ${target}`
    }
    // 高置信度直接返回
    return { type: 'extract', target, confidence: Math.min(confidence, 1), reason }
  }

  // 弱意图：有弱关键词 + 有目标
  if (hasExtractWeakKeyword && target) {
    confidence = 0.6
    reason = `包含弱关键词: ${extractWeakKeywords.filter(k => lower.includes(k)).join(', ')} + 目标: ${target}`
    return { type: 'extract', target, confidence, reason }
  }

  // 计算分析置信度
  if (hasAnalyzeKeyword) {
    confidence = 0.85
    reason = `包含关键词: ${analyzeKeywords.filter(k => lower.includes(k)).join(', ')}`
    return { type: 'analyze', confidence, reason }
  }

  // 计算转换置信度
  if (hasTransformKeyword) {
    confidence = 0.9
    reason = `包含关键词: ${transformKeywords.filter(k => lower.includes(k)).join(', ')}`
    return { type: 'transform', confidence, reason }
  }

  // 完全无法识别
  return { type: 'unknown', confidence: 0, reason: '未匹配到任何关键词' }
}

// 处理提取请求
async function handleExtract(
  intent: { target?: string },
  files: DataFile[]
): Promise<AgentResult> {
  if (files.length === 0) {
    return createErrorResult(ErrorCode.FILE_NOT_FOUND, {
      suggestion: '请先拖拽上传 Excel 或 CSV 文件'
    })
  }

  // 查找包含目标数据的 sheet
  const targetSheets = findTargetSheets(intent.target, files)

  console.log('[Agent] Found target sheets:', targetSheets.map(ts => ({
    fileName: ts.file.name,
    sheetName: ts.sheet.name,
    rowCount: ts.sheet.rowCount
  })))

  if (targetSheets.length === 0) {
    return createErrorResult(ErrorCode.TARGET_NOT_FOUND, {
      target: intent.target,
      availableTargets: ['机票', '酒店', '火车', '用车', '对账单'],
      availableSheets: listAllSheets(files)
    })
  }

  // 通过 Electron IPC 读取完整 Excel 数据
  const electronAPI = (window as any).electronAPI
  if (!electronAPI?.readExcelSheet) {
    return createErrorResult(ErrorCode.SYSTEM_ELECTRON_UNAVAILABLE)
  }

  const results: { fileName: string; sheetName: string; newFileId: string; rowCount: number }[] = []
  const store = useStore.getState()

  // 批量处理所有匹配的 sheets
  for (let i = 0; i < targetSheets.length; i++) {
    const { file, sheet } = targetSheets[i]

    if (!file.path) {
      console.log(`[Agent] Skipping ${file.name}/${sheet.name}: no file path`)
      continue
    }

    try {
      // 确定使用哪个 headerRow：优先使用 AI 分析的结果
      const aiHeaderRow = sheet.structureAnalysis?.headerRow
      const headerRowToUse = (aiHeaderRow !== undefined && aiHeaderRow >= 0) ? aiHeaderRow : undefined

      console.log(`[Agent] [${i + 1}/${targetSheets.length}] Reading Excel sheet:`, file.path, sheet.name, 'headerRow:', headerRowToUse)

      // 传入 headerRow，让 IPC 使用正确的表头行
      const result = await electronAPI.readExcelSheet(file.path, sheet.name, headerRowToUse)
      if (!result.success) {
        console.error(`[Agent] Failed to read ${file.name}/${sheet.name}:`, result.error)
        continue
      }

      const fullHeaders = result.data.headers
      const fullRows = result.data.rows
      const actualHeaderRow = result.data.headerRow

      console.log('[Agent] Full data from IPC:', {
        file: file.name,
        sheet: sheet.name,
        requestedHeaderRow: headerRowToUse,
        actualHeaderRow: actualHeaderRow,
        ipcHeaders: fullHeaders.slice(0, 5),
        ipcRowCount: fullRows.length
      })

      // IPC 已经根据 headerRow 返回了正确的表头和数据
      // 直接使用，不需要重新映射
      const headers = fullHeaders
      const dataRows = fullRows

      console.log('[Agent] Using headers from IPC:', {
        file: file.name,
        sheet: sheet.name,
        headers: headers.slice(0, 5),
        rowCount: dataRows.length
      })

      if (dataRows.length === 0) {
        console.log(`[Agent] ${sheet.name} has no data, skipping`)
        continue
      }

      // 数据已经是正确格式（在 hasValidAIAnalysis 分支中已重新映射）
      const rows = dataRows

      // 保存到文件（通过 Electron IPC）
      const safeFileName = file.name.replace(/\.[^/.]+$/, '') // 移除扩展名
      const safeSheetName = sheet.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_') // 替换特殊字符
      const fileName = `${intent.target || '数据'}_${safeFileName}_${safeSheetName}.json`
      let filePath: string | undefined

      if (electronAPI?.getUserDataPath && electronAPI?.exportJSON) {
        const userDataPath = await electronAPI.getUserDataPath()
        filePath = `${userDataPath}/exports/${fileName}`
        await electronAPI.exportJSON(rows, filePath)
      }

      // 计算位置：在源文件右侧水平排列
      const newPosition = {
        x: file.position.x + file.size.width + 150,
        y: file.position.y + i * 100 // 垂直错开，避免重叠
      }

      // 将对象数组转换为数组的数组，以便 FileCard 正确渲染
      const sampleRowsArray = dataRows.slice(0, 100).map((row: any) => {
        return headers.map((h: string) => row[h] ?? null)
      })

      const newFileId = store.addFile({
        name: fileName,
        type: 'json',
        path: filePath,
        sheets: [{
          name: 'Data',
          headers,
          rowCount: rows.length,
          columnTypes: [],
          sampleRows: sampleRowsArray
        }],
        activeSheet: 'Data',
        position: newPosition,
        size: { width: 500, height: 350 },
        quality: 100,
        rowCount: rows.length
      })

      store.addFlow({
        from: file.id,
        to: newFileId,
        label: '提取',
        type: 'transform'
      })

      results.push({
        fileName: file.name,
        sheetName: sheet.name,
        newFileId,
        rowCount: rows.length
      })

      console.log('[Agent] Extraction complete for:', {
        file: file.name,
        sheet: sheet.name,
        rowCount: rows.length,
        newFileId
      })

    } catch (error) {
      logError(ErrorCode.AGENT_EXECUTION_FAILED, error, {
        file: file.name,
        sheet: sheet.name
      })
      continue
    }
  }

  if (results.length === 0) {
    return createErrorResult(ErrorCode.AGENT_EXECUTION_FAILED, {
      suggestion: '请检查文件是否可以正常打开，或尝试重新上传文件。'
    })
  }

  const totalRows = results.reduce((sum, r) => sum + r.rowCount, 0)
  const message = results.length === 1
    ? `已提取 ${results[0].sheetName} 的 ${results[0].rowCount} 行数据`
    : `已成功提取 ${results.length} 个文件，共 ${totalRows} 行数据：\n${results.map(r => `- ${r.fileName}/${r.sheetName}: ${r.rowCount} 行`).join('\n')}`

  return createAgentResult(true, message, { results, totalRows, count: results.length })
}

// 查找目标 sheets
function findTargetSheets(target: string | undefined, files: DataFile[]) {
  const results: { file: DataFile; sheet: any }[] = []

  console.log('[Agent] Searching for target sheets:', {
    target,
    fileCount: files.length,
    allSheets: files.flatMap(f => f.sheets.filter(s => !s.hidden).map(s => `${f.name}/${s.name}`))
  })

  for (const file of files) {
    for (const sheet of file.sheets) {
      // 跳过隐藏的
      if (sheet.hidden) continue

      // 如果指定了目标，匹配名称
      if (target) {
        const isMatch = sheet.name.includes(target) || sheet.name.toLowerCase().includes(target.toLowerCase())
        console.log(`[Agent] Matching "${target}" against "${sheet.name}": ${isMatch}`)
        if (isMatch) {
          results.push({ file, sheet })
        }
      } else {
        // 未指定目标，找数据量最大的明细表
        if (sheet.rowCount > 10) {
          results.push({ file, sheet })
        }
      }
    }
  }

  // 按行数排序，优先返回数据量大的
  const sorted = results.sort((a, b) => b.sheet.rowCount - a.sheet.rowCount)

  console.log('[Agent] Target sheets found:', sorted.map(r => ({
    file: r.file.name,
    sheet: r.sheet.name,
    rowCount: r.sheet.rowCount
  })))

  return sorted
}

// 列出所有可用 sheets
function listAllSheets(files: DataFile[]): string {
  return files
    .flatMap(f => f.sheets.filter(s => !s.hidden).map(s => s.name))
    .join(', ')
}

// 处理分析请求
async function handleAnalyze(
  _intent: any,
  _files: DataFile[]
): Promise<AgentResult> {
  // 实现数据分析逻辑
  return { success: true, message: '分析功能开发中' }
}

// 处理转换请求
async function handleTransform(
  _intent: any,
  _files: DataFile[]
): Promise<AgentResult> {
  // 实现格式转换逻辑
  return { success: true, message: '转换功能开发中' }
}
