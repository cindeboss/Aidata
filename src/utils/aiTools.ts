// AI 工具调用系统 - 真实数据处理能力
import type { DataFile } from '../types'
import { useStore } from '../store/useStore'

// 工具定义
export interface Tool {
  name: string
  description: string
  parameters: {
    type: string
    properties: Record<string, any>
    required: string[]
  }
}

// 可用的工具列表
export const AVAILABLE_TOOLS: Tool[] = [
  {
    name: 'extract_sheet_data',
    description: '从 Excel 的指定 sheet 中提取完整数据，支持筛选字段',
    parameters: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: '源文件 ID' },
        sheetName: { type: 'string', description: '工作表名称' },
        selectedFields: { type: 'array', items: { type: 'string' }, description: '要保留的字段列表（可选，不提供则保留所有）' }
      },
      required: ['fileId', 'sheetName']
    }
  },
  {
    name: 'create_result_file',
    description: '将提取的数据保存为文件，并在画布上创建结果卡片',
    parameters: {
      type: 'object',
      properties: {
        sourceFileId: { type: 'string', description: '源文件 ID' },
        fileName: { type: 'string', description: '新文件名（包含扩展名如 .json）' },
        data: { type: 'object', description: '包含 headers 和 rows 的数据对象' },
        fileType: { type: 'string', enum: ['json', 'csv'], description: '文件类型' }
      },
      required: ['sourceFileId', 'fileName', 'data', 'fileType']
    }
  }
]

// 工具执行结果
export interface ToolResult {
  success: boolean
  data?: any
  error?: string
  message?: string
}

// 执行工具调用
export async function executeTool(
  toolName: string,
  params: any,
  context: { files: DataFile[] }
): Promise<ToolResult> {
  console.log(`[executeTool] ${toolName}`, params)

  switch (toolName) {
    case 'extract_sheet_data':
      return extractSheetData(params, context)
    case 'create_result_file':
      return createResultFile(params, context)
    default:
      return { success: false, error: `未知工具: ${toolName}` }
  }
}

// 从 sheet 提取完整数据
async function extractSheetData(
  params: {
    fileId: string
    sheetName: string
    selectedFields?: string[]
  },
  context: { files: DataFile[] }
): Promise<ToolResult> {
  const { fileId, sheetName, selectedFields } = params

  // 找到源文件
  const sourceFile = context.files.find(f => f.id === fileId)
  if (!sourceFile) {
    return { success: false, error: `未找到文件: ${fileId}` }
  }

  if (!sourceFile.path) {
    return { success: false, error: '文件路径不存在，无法读取完整数据' }
  }

  // 找到指定的 sheet
  const sheet = sourceFile.sheets.find(s => s.name === sheetName)
  if (!sheet) {
    return { success: false, error: `未找到工作表: ${sheetName}` }
  }

  // 默认不处理隐藏的 sheet（静默跳过）
  if (sheet.hidden) {
    return {
      success: true,
      data: {
        sourceFileId: fileId,
        sourceFileName: sourceFile.name,
        sheetName: sheetName,
        headers: [],
        rows: [],
        rowCount: 0,
        skipped: true,
        reason: '隐藏的 sheet 默认不处理'
      },
      message: `已跳过隐藏的工作表 "${sheetName}"`
    }
  }

  try {
    // 通过 Electron IPC 读取完整 Excel 数据
    const electronAPI = (window as any).electronAPI
    if (!electronAPI?.readExcelSheet) {
      return { success: false, error: 'Electron API 不可用' }
    }

    const result = await electronAPI.readExcelSheet(sourceFile.path, sheetName)

    if (!result.success) {
      return { success: false, error: result.error || '读取 Excel 失败' }
    }

    let { headers, rows } = result.data

    // 如果需要筛选特定字段
    if (selectedFields && selectedFields.length > 0) {
      const validFields = selectedFields.filter(f => headers.includes(f))
      if (validFields.length === 0) {
        return { success: false, error: '指定的字段不存在于数据中' }
      }

      // 重新构建数据，只保留选定字段
      rows = rows.map((row: any) => {
        const filtered: Record<string, any> = {}
        validFields.forEach(field => {
          filtered[field] = row[field]
        })
        return filtered
      })
      headers = validFields
    }

    return {
      success: true,
      data: {
        sourceFileId: fileId,
        sourceFileName: sourceFile.name,
        sheetName: sheetName,
        headers,
        rows,
        rowCount: rows.length
      },
      message: `已从 ${sheetName} 提取 ${rows.length} 行数据，${headers.length} 个字段`
    }
  } catch (error) {
    return {
      success: false,
      error: `提取数据失败: ${(error as Error).message}`
    }
  }
}

// 创建结果文件并保存到磁盘
async function createResultFile(
  params: {
    sourceFileId: string
    fileName: string
    data: {
      headers: string[]
      rows: any[]
      rowCount: number
      skipped?: boolean
      reason?: string
    }
    fileType: string
  },
  context: { files: DataFile[] }
): Promise<ToolResult> {
  const { sourceFileId, fileName, data, fileType } = params

  // 如果数据被跳过（如隐藏的 sheet），不创建文件
  if (data.skipped) {
    return {
      success: true,
      data: { skipped: true },
      message: `已跳过: ${data.reason || '无需创建文件'}`
    }
  }

  const sourceFile = context.files.find(f => f.id === sourceFileId)
  if (!sourceFile) {
    return { success: false, error: `未找到源文件: ${sourceFileId}` }
  }

  // 如果没有数据，不创建文件
  if (data.rowCount === 0 || data.rows.length === 0) {
    return {
      success: true,
      data: { skipped: true },
      message: '没有数据需要导出，跳过文件创建'
    }
  }

  const electronAPI = (window as any).electronAPI
  if (!electronAPI) {
    return { success: false, error: 'Electron API 不可用' }
  }

  try {
    // 获取用户数据目录
    const userDataPath = await electronAPI.getUserDataPath()
    const exportsDir = `${userDataPath}/exports`

    // 确保导出目录存在
    // 注意：这里我们需要通过 IPC 创建目录，暂时先直接尝试写入

    const filePath = `${exportsDir}/${fileName}`

    // 根据类型导出文件
    if (fileType === 'json') {
      const result = await electronAPI.exportJSON(data.rows, filePath)
      if (!result.success) {
        return { success: false, error: result.error || '导出 JSON 失败' }
      }
    } else if (fileType === 'csv') {
      const rowsArray = data.rows.map((row: any) =>
        data.headers.map(h => row[h] ?? '')
      )
      const result = await electronAPI.exportCSV(data.headers, rowsArray, filePath)
      if (!result.success) {
        return { success: false, error: result.error || '导出 CSV 失败' }
      }
    } else {
      return { success: false, error: `不支持的文件类型: ${fileType}` }
    }

    // 通过 store 创建新文件卡片
    const store = useStore.getState()

    // 计算新文件位置（在源文件右侧）
    const newPosition = {
      x: sourceFile.position.x + sourceFile.size.width + 150,
      y: sourceFile.position.y
    }

    // 转换数据为 sampleRows 格式用于显示
    const sampleRows = data.rows.slice(0, 100).map((row: any) =>
      data.headers.map(h => row[h] ?? null)
    )

    // 创建新文件
    const newFileId = store.addFile({
      name: fileName,
      type: fileType === 'json' ? 'json' : 'csv',
      path: filePath,
      sheets: [{
        name: 'Data',
        headers: data.headers,
        rowCount: data.rowCount,
        columnTypes: [],
        sampleRows: sampleRows
      }],
      activeSheet: 'Data',
      position: newPosition,
      size: { width: 500, height: 350 },
      quality: 100,
      rowCount: data.rowCount
    })

    // 创建数据流连接
    store.addFlow({
      from: sourceFileId,
      to: newFileId,
      label: '提取数据',
      type: 'transform'
    })

    return {
      success: true,
      data: {
        newFileId,
        fileName,
        filePath,
        position: newPosition
      },
      message: `已创建文件: ${fileName} (${data.rowCount} 行数据)，保存于 ${filePath}`
    }
  } catch (error) {
    return {
      success: false,
      error: `创建文件失败: ${(error as Error).message}`
    }
  }
}

// 构建工具调用的 system prompt
export function buildToolSystemPrompt(): string {
  const toolsDesc = AVAILABLE_TOOLS.map(tool => {
    const params = Object.entries(tool.parameters.properties)
      .map(([key, val]: [string, any]) => {
        const required = tool.parameters.required.includes(key) ? '(必填)' : '(可选)'
        return `    - ${key}: ${val.description} ${required}`
      })
      .join('\n')

    return `- ${tool.name}: ${tool.description}\n  参数:\n${params}`
  }).join('\n\n')

  return `你是 DataClean AI 的数据处理助手。你有工具可以直接操作数据文件。

重要原则：
- **必须直接调用工具执行，不要询问用户确认**
- **不要返回普通文本说明，必须输出工具调用**
- **不要要求用户手动复制数据或提供截图**
- **你有权限读取文件、提取数据、创建新文件**

可用工具:
${toolsDesc}

输出格式要求：
**你的回复只能包含工具调用，格式如下：**
<tool name="extract_sheet_data">{"fileId": "文件ID", "sheetName": "sheet名称"}</tool>

**禁止以下行为：**
❌ 询问用户"可以吗？""需要吗？"
❌ 要求用户"请确认""请提供"
❌ 返回纯文本说明而不调用工具
❌ 要求用户手动复制粘贴数据

正确示例：
用户: "提取机票数据"
你（直接输出）: <tool name="extract_sheet_data">{"fileId": "file_xxx", "sheetName": "国内机票对账单"}</tool>

错误示例：
用户: "提取机票数据"
你: "我来帮您提取..." ❌ 不要这样说，直接调用工具
你: "请问您需要..." ❌ 不要问，直接执行

如果用户请求不明确，选择最可能的 sheet 直接提取。执行完成后再展示结果。`
}

// 解析工具调用
export function parseToolCalls(text: string): Array<{ name: string; params: any }> {
  const toolCalls: Array<{ name: string; params: any }> = []
  const regex = /<tool name="([^"]+)">\s*(\{[^}]+\})\s*<\/tool>/g

  let match
  while ((match = regex.exec(text)) !== null) {
    try {
      const name = match[1]
      const params = JSON.parse(match[2])
      toolCalls.push({ name, params })
    } catch (e) {
      console.error('解析工具调用失败:', match[0])
    }
  }

  return toolCalls
}
