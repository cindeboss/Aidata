// AI 服务 - 支持多种 AI 提供商

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
const SYSTEM_PROMPT = `你是 DataClean AI 的数据分析助手。你的任务是帮助用户：
1. 理解和分析数据
2. 发现数据质量问题（空值、重复、异常等）
3. 提供数据清洗建议
4. 回答关于数据的问题

请用简洁、专业的语言回复，必要时使用 emoji 增加可读性。
如果用户提到具体的文件或列，请使用 @ 提及，例如：@sales_data.xlsx 或 @Amount`

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
  const { ok, status, data } = await apiCall(`${config.baseUrl || defaultBaseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || defaultModel,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  })

  if (!ok) {
    throw new Error(`AI API 错误: ${status} - ${data.error?.message || '未知错误'}`)
  }

  return data.choices[0].message.content
}

// 调用智谱 GLM API
async function callZhipu(messages: AIMessage[], config: AIConfig): Promise<string> {
  const { ok, status, data } = await apiCall(`${config.baseUrl || ZHIPU_CONFIG.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || ZHIPU_CONFIG.model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  })

  if (!ok) {
    throw new Error(`智谱 API 错误: ${status} - ${data.error?.message || '未知错误'}`)
  }

  return data.choices[0].message.content
}

// 调用 Anthropic API
async function callAnthropic(messages: AIMessage[], config: AIConfig): Promise<string> {
  const { ok, status, data } = await apiCall(`${config.baseUrl || 'https://api.anthropic.com'}/v1/messages`, {
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
    throw new Error(`AI API 错误: ${status} - ${data.error?.message || '未知错误'}`)
  }

  return data.content[0].text
}

// 调用 Kimi Coding API (Anthropic 兼容)
async function callKimiCoding(messages: AIMessage[], config: AIConfig): Promise<string> {
  const baseUrl = config.baseUrl || KIMI_CODING_CONFIG.baseUrl
  const { ok, status, data } = await apiCall(`${baseUrl}/v1/messages`, {
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
    throw new Error(`Kimi Coding API 错误: ${status} - ${data.error?.message || '未知错误'}`)
  }

  return data.content[0].text
}

// 本地模拟响应（用于测试）
function getLocalResponse(messages: AIMessage[]): string {
  const lastMessage = messages[messages.length - 1]?.content || ''

  if (lastMessage.includes('清洗') || lastMessage.includes('clean')) {
    return '好的，我来帮你分析数据质量问题。\n\n🔍 检测到以下问题：\n• 空值：12 个单元格\n• 重复行：3 行\n• 格式异常：2 处\n\n要执行清洗操作吗？'
  }

  if (lastMessage.includes('分析') || lastMessage.includes('analysis')) {
    return '📊 数据分析结果：\n\n• 总行数：1,000\n• 总列数：8\n• 数据质量：95%\n• 主要字段：日期、金额、类别、地区\n\n需要查看详细的统计信息吗？'
  }

  if (lastMessage.includes('导出') || lastMessage.includes('export')) {
    return '请选择导出格式：\n\n• Excel (.xlsx)\n• CSV\n• JSON\n\n选择后我会帮你导出数据。'
  }

  return `我收到了你的请求。目前我支持以下操作：\n\n• 📋 数据清洗：删除空值、去重\n• 📊 数据分析：查看统计信息\n• 📤 数据导出：导出为 Excel/CSV\n\n请问你想执行哪个操作？`
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
    return `抱歉，AI 服务出现错误：${(error as Error).message}\n\n请检查网络连接和 API 配置。`
  }
}

// 数据分析提示
export function generateAnalysisPrompt(data: {
  fileName: string
  rowCount: number
  columns: string[]
  sampleRows: any[][]
}): string {
  return `请分析以下数据：

文件名：${data.fileName}
行数：${data.rowCount}
列：${data.columns.join(', ')}

样例数据：
${data.sampleRows.map((row) => row.join(' | ')).join('\n')}

请提供：
1. 数据概览
2. 潜在问题
3. 清洗建议`
}

// 默认 AI 配置（使用本地模式，无需 API Key）
// 用户可以在设置中配置自己的 Kimi/智谱/OpenAI API Key
export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'local',
  apiKey: '',
  model: '',
}
