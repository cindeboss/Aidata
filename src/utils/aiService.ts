// AI 服务 - 支持多种 AI 提供商

import type { RawSheetData, TableStructureAnalysis } from '../types'

export interface AIConfig {
  provider: 'kimi-coding' | 'kimi' | 'zhipu' | 'openai' | 'anthropic' | 'local'
  apiKey?: string
  model?: string
  baseUrl?: string
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// 默认系统提示
const SYSTEM_PROMPT = '你是 DataClean AI 的数据分析助手。你的任务是帮助用户：\n' +
  '1. 理解和分析数据\n' +
  '2. 发现数据质量问题（空值、重复、异常等）\n' +
  '3. 提供数据清洗建议\n' +
  '4. 回答关于数据的问题\n\n' +
  '请用简洁、专业的语言回复。如果用户提到具体的文件或列，请使用 @ 提及。'

// Kimi Coding 配置 (Anthropic 兼容)
const KIMI_CODING_CONFIG = {
  baseUrl: 'https://api.kimi.com/coding',
  model: 'Kimi code',
}

// Kimi (Moonshot AI) 配置
const KIMI_CONFIG = {
  baseUrl: 'https://api.moonshot.cn',
  model: 'moonshot-v1-8k',
}

// 智谱 GLM 配置
const ZHIPU_CONFIG = {
  baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  model: 'glm-4-flash',
}

// 检测是否在 Electron 环境中
function isElectron(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).electronAPI?.callAI === 'function'
}

// 通过 Electron IPC 发起 API 请求（绑过 CORS）
async function electronFetch(url: string, options: {
  method: string
  headers: Record<string, string>
  body: string
}): Promise<{ ok: boolean; status: number; data: any }> {
  const result = await (window as any).electronAPI.callAI(url, options)

  if (result.success) {
    return { ok: true, status: result.status || 200, data: result.data }
  } else {
    return { ok: false, status: result.status || 500, data: { error: { message: result.error } } }
  }
}

// 通用 API 调用函数
async function apiCall(url: string, options: {
  method: string
  headers: Record<string, string>
  body: string
}): Promise<{ ok: boolean; status: number; data: any }> {
  if (isElectron()) {
    return electronFetch(url, options)
  }

  // 浏览器环境使用 fetch
  const response = await fetch(url, {
    method: options.method,
    headers: options.headers,
    body: options.body,
  })

  const data = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, data }
}

// 调用 OpenAI 兼容 API（包括 Kimi）
async function callOpenAICompatible(messages: AIMessage[], config: AIConfig, defaultBaseUrl: string, defaultModel: string): Promise<string> {
  const { ok, status, data } = await apiCall((config.baseUrl || defaultBaseUrl) + '/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + config.apiKey,
    },
    body: JSON.stringify({
      model: config.model || defaultModel,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  })

  if (!ok) {
    throw new Error('AI API 错误: ' + status + ' - ' + (data.error?.message || '未知错误'))
  }

  return data.choices[0].message.content
}

// 调用智谱 GLM API
async function callZhipu(messages: AIMessage[], config: AIConfig): Promise<string> {
  const { ok, status, data } = await apiCall((config.baseUrl || ZHIPU_CONFIG.baseUrl) + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + config.apiKey,
    },
    body: JSON.stringify({
      model: config.model || ZHIPU_CONFIG.model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  })

  if (!ok) {
    throw new Error('智谱 API 错误: ' + status + ' - ' + (data.error?.message || '未知错误'))
  }

  return data.choices[0].message.content
}

// 调用 Anthropic API
async function callAnthropic(messages: AIMessage[], config: AIConfig): Promise<string> {
  const { ok, status, data } = await apiCall((config.baseUrl || 'https://api.anthropic.com') + '/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model || 'claude-3-haiku-20240307',
      system: SYSTEM_PROMPT,
      messages: messages.filter((m) => m.role !== 'system'),
      max_tokens: 1000,
    }),
  })

  if (!ok) {
    throw new Error('AI API 错误: ' + status + ' - ' + (data.error?.message || '未知错误'))
  }

  return data.content[0].text
}

// 调用 Kimi Coding API (Anthropic 兼容)
async function callKimiCoding(messages: AIMessage[], config: AIConfig): Promise<string> {
  const baseUrl = config.baseUrl || KIMI_CODING_CONFIG.baseUrl
  const { ok, status, data } = await apiCall(baseUrl + '/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model || KIMI_CODING_CONFIG.model,
      system: SYSTEM_PROMPT,
      messages: messages.filter((m) => m.role !== 'system'),
      max_tokens: 4096,
    }),
  })

  if (!ok) {
    throw new Error('Kimi Coding API 错误: ' + status + ' - ' + (data.error?.message || '未知错误'))
  }

  return data.content[0].text
}

// 本地模拟响应（用于测试）
function getLocalResponse(messages: AIMessage[]): string {
  const lastMessage = messages[messages.length - 1]?.content || ''

  // 提示用户当前使用的是本地模拟模式
  const localModeNotice = '【本地模式】当前未配置 AI API Key，使用模拟响应。建议在设置中配置 Kimi Coding API Key 以获得更准确的分析结果。\n\n'

  if (lastMessage.includes('清洗') || lastMessage.includes('clean')) {
    return localModeNotice + '好的，我来帮你分析数据质量问题。\n\n检测到以下问题：\n- 空值：12 个单元格\n- 重复行：3 行\n- 格式异常：2 处\n\n要执行清洗操作吗？'
  }

  if (lastMessage.includes('分析') || lastMessage.includes('analysis')) {
    return localModeNotice + '数据分析结果：\n\n- 总行数：1,000\n- 总列数：8\n- 数据质量：95%\n- 主要字段：日期、金额、类别、地区\n\n需要查看详细的统计信息吗？'
  }

  if (lastMessage.includes('导出') || lastMessage.includes('export')) {
    return localModeNotice + '请选择导出格式：\n\n- Excel (.xlsx)\n- CSV\n- JSON\n\n选择后我会帮你导出数据。'
  }

  return localModeNotice + '我收到了你的请求。目前我支持以下操作：\n\n- 数据清洗：删除空值、去重\n- 数据分析：查看统计信息\n- 数据导出：导出为 Excel/CSV\n\n请问你想执行哪个操作？'
}

// 主函数：调用 AI
export async function callAI(messages: AIMessage[], config: AIConfig): Promise<string> {
  try {
    switch (config.provider) {
      case 'kimi-coding':
        if (!config.apiKey) {
          return '请先配置 Kimi Coding API Key。你可以在设置中添加。'
        }
        return await callKimiCoding(messages, config)

      case 'kimi':
        if (!config.apiKey) {
          return '请先配置 Kimi API Key。你可以在设置中添加。'
        }
        return await callOpenAICompatible(messages, config, KIMI_CONFIG.baseUrl, KIMI_CONFIG.model)

      case 'zhipu':
        if (!config.apiKey) {
          return '请先配置智谱 API Key。你可以在设置中添加。'
        }
        return await callZhipu(messages, config)

      case 'openai':
        if (!config.apiKey) {
          return '请先配置 OpenAI API Key。你可以在设置中添加。'
        }
        return await callOpenAICompatible(messages, config, 'https://api.openai.com', 'gpt-4o-mini')

      case 'anthropic':
        if (!config.apiKey) {
          return '请先配置 Anthropic API Key。你可以在设置中添加。'
        }
        return await callAnthropic(messages, config)

      case 'local':
      default:
        // 本地模式：使用模拟响应
        return getLocalResponse(messages)
    }
  } catch (error) {
    console.error('AI API error:', error)
    return '抱歉，AI 服务出现错误：' + (error as Error).message + '\n\n请检查网络连接和 API 配置。'
  }
}

// 工具调用版 AI（支持 Function Calling）
export async function callAIWithTools(
  messages: AIMessage[],
  config: AIConfig,
  tools?: any[]
): Promise<{ content: string; toolCalls?: any[] }> {
  try {
    // 目前只有 OpenAI 兼容接口支持工具调用
    if (config.provider === 'openai' || config.provider === 'kimi') {
      return await callOpenAIWithTools(messages, config, tools)
    }

    // 其他提供商回退到普通调用
    const content = await callAI(messages, config)
    return { content }
  } catch (error) {
    console.error('AI with tools error:', error)
    return { content: '错误：' + (error as Error).message }
  }
}

// OpenAI 兼容工具调用
async function callOpenAIWithTools(
  messages: AIMessage[],
  config: AIConfig,
  tools?: any[]
): Promise<{ content: string; toolCalls?: any[] }> {
  const baseUrl = config.baseUrl || 'https://api.openai.com'
  const model = config.model || 'gpt-4o-mini'

  const { ok, status, data } = await apiCall(baseUrl + '/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + config.apiKey,
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      tools: tools,
      tool_choice: tools ? 'auto' : undefined,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  })

  if (!ok) {
    throw new Error('AI API 错误: ' + status + ' - ' + (data.error?.message || '未知错误'))
  }

  const choice = data.choices[0]
  const content = choice.message?.content || ''
  const toolCalls = choice.message?.tool_calls

  return { content, toolCalls }
}

// 数据分析提示
export function generateAnalysisPrompt(data: {
  fileName: string
  rowCount: number
  columns: string[]
  sampleRows: any[][]
}): string {
  return '请分析以下数据：\n\n' +
    '文件名：' + data.fileName + '\n' +
    '行数：' + data.rowCount + '\n' +
    '列：' + data.columns.join(', ') + '\n\n' +
    '样例数据：\n' + data.sampleRows.map((row) => row.join(' | ')).join('\n') + '\n\n' +
    '请提供：\n1. 数据概览\n2. 潜在问题\n3. 清洗建议'
}

// 默认 AI 配置（使用 Kimi Coding）
export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'kimi-coding',
  apiKey: '',
  model: 'Kimi code',
}

// 从原始数据推断表格结构
function inferStructureFromData(rawData: RawSheetData): TableStructureAnalysis {
  const maxCol = rawData.cells[0]?.length || 1
  const maxRow = rawData.cells.length

  // 尝试识别表头行：找到第一个非空行作为表头
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

  // 构建字段列表（从表头行获取）
  const headerCells = rawData.cells[headerRow] || []
  const fields = headerCells.map(c => String(c.value || '').trim()).filter(f => f)

  return {
    sheetType: fields.length > 1 ? 'standard' : 'irregular' as const,
    sheetTypeReason: fields.length > 1 ? '基于默认推断' : '列数过少',
    headerRow,
    dataStartRow: headerRow + 1,
    fields,
    confidence: 0.4,
    status: 'completed' as const,
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

// 从 sheetAnalyzer.ts 重新导出
export { analyzeAllSheets, inferStructureFromData as inferStructureFromDataExport, type SheetAnalysisResult } from './sheetAnalyzer'

// 表格结构分析 Prompt - 分析单个 sheet
const SHEET_ANALYSIS_PROMPT = '分析这个 Excel sheet 的结构，判断它是什么类型的表格。\n\n' +
  '## 输入\n你会收到前 20 行的单元格数据和合并单元格信息。\n\n' +
  '## 输出要求\n返回一个 JSON 对象，格式如下：\n' +
  '{"sheetType": "standard 或 irregular", "sheetTypeReason": "原因", "headerRow": 0, "dataStartRow": 1, "fields": ["字段1"], "confidence": 0.9}\n\n' +
  '## 类型判断规则\n1. standard（标准表格）：有一行明确的表头，下面是数据行\n2. irregular（异形表格）：表头不明确，字段和值是树状/层级结构\n\n' +
  '只返回 JSON，不要其他文字。'

// 解析 AI 返回的 JSON
function parseAIJsonResponse(response: string): any {
  // 尝试提取 json 代码块 (使用 unicode 避免解析问题)
  const backtick = '\u0060'
  const pattern = backtick + backtick + backtick + 'json\\s*([\\s\\S]*?)' + backtick + backtick + backtick
  const jsonBlockPattern = new RegExp(pattern)
  const jsonBlockMatch = jsonBlockPattern.exec(response)
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim())
    } catch (e) {}
  }

  // 尝试找到完整的 JSON 对象
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

// 兼容旧接口：分析单个表格结构
export async function analyzeTableStructure(
  rawData: RawSheetData,
  config: AIConfig
): Promise<TableStructureAnalysis> {
  console.log('[analyzeTableStructure] Starting analysis, provider:', config.provider)

  // local 模式不支持自动分析
  if (config.provider === 'local') {
    const inferred = inferStructureFromData(rawData)
    return {
      ...inferred,
      status: 'failed',
      error: '本地模式不支持自动表格分析，请配置 AI API',
    }
  }

  try {
    // 构建输入数据
    const cellsPreview = rawData.cells.slice(0, 20).map((row, rowIndex) =>
      row.map((cell, colIndex) => ({
        row: rowIndex,
        col: colIndex,
        value: cell.value,
        isMerged: !!cell.mergeId,
      }))
    )

    const mergesInfo = rawData.merges.map((m) => ({
      start: 'R' + m.s.r + 'C' + m.s.c,
      end: 'R' + m.e.r + 'C' + m.e.c,
      size: (m.e.r - m.s.r + 1) + ' rows x ' + (m.e.c - m.s.c + 1) + ' cols',
    }))

    const cellsStr = JSON.stringify(cellsPreview, null, 2)
    const mergesStr = mergesInfo.length > 0 ? JSON.stringify(mergesInfo, null, 2) : 'none'
    const userMessage = 'Analyze this Excel sheet:\n\nCell data:\n' + cellsStr + '\n\nMerges:\n' + mergesStr + '\n\nReturn JSON.'

    const messages: AIMessage[] = [
      { role: 'system', content: SHEET_ANALYSIS_PROMPT },
      { role: 'user', content: userMessage },
    ]

    const response = await callAI(messages, config)
    console.log('[analyzeTableStructure] AI response:', response)

    const parsed = parseAIJsonResponse(response)
    console.log('[analyzeTableStructure] Parsed:', JSON.stringify(parsed, null, 2))

    // 检查返回格式是否正确
    if (parsed && parsed.sheetType && Array.isArray(parsed.fields)) {
      return {
        sheetType: parsed.sheetType,
        sheetTypeReason: parsed.sheetTypeReason,
        headerRow: parsed.headerRow ?? 0,
        dataStartRow: parsed.dataStartRow ?? 1,
        fields: parsed.fields,
        confidence: parsed.confidence ?? 0.5,
        status: 'completed',
        headerRegion: {
          startRow: parsed.headerRow ?? 0,
          endRow: parsed.headerRow ?? 0,
          startCol: 0,
          endCol: parsed.fields.length - 1,
        },
        fieldHierarchy: parsed.fields.map((f: string, i: number) => ({
          fullPath: f,
          displayName: f,
          columnIndex: i,
          level: 0,
        })),
      }
    }

    // 格式不对，使用默认推断
    const inferred = inferStructureFromData(rawData)
    return {
      ...inferred,
      sheetType: 'unknown',
      status: 'completed',
    }
  } catch (error) {
    console.error('[analyzeTableStructure] Error:', error)
    const inferred = inferStructureFromData(rawData)
    return {
      ...inferred,
      sheetType: 'unknown',
      status: 'failed',
      error: (error as Error).message,
    }
  }
}
