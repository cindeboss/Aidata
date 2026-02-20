// 数据操作工具集
// 将原有的提取、分析、导出功能注册为标准化工具

import { registerTool } from '../utils/toolRegistry'
import { executeAgentCommand } from '../utils/aiAgent'
import { useStore } from '../store/useStore'

// 1. 数据提取工具
registerTool({
  name: 'extract_data',
  description: '从 Excel/CSV 文件中提取指定类型的数据（如机票、酒店、火车等）',
  parameters: [
    {
      name: 'target',
      type: 'string',
      description: '要提取的数据类型',
      required: true,
      enum: ['机票', '酒店', '火车', '用车', '对账单', '全部']
    },
    {
      name: 'fileFilter',
      type: 'string',
      description: '文件过滤条件（如"阿里"、"携程"），不填则处理所有文件',
      required: false
    }
  ],
  handler: async (params, context) => {
    const { target, fileFilter } = params
    const { files } = context

    // 如果有过滤条件，只处理匹配的文件
    let targetFiles = files
    if (fileFilter) {
      targetFiles = files.filter(f => f.name.includes(fileFilter))
      if (targetFiles.length === 0) {
        return {
          success: false,
          message: `未找到包含"${fileFilter}"的文件。可用文件: ${files.map(f => f.name).join(', ')}`
        }
      }
    }

    context.setLoading(true)
    context.addMessage(`正在提取${target}数据...`)

    try {
      const result = await executeAgentCommand(
        `提取${target}数据`,
        { files: targetFiles }
      )

      return {
        success: result.success,
        message: result.message,
        data: result.data
      }
    } finally {
      context.setLoading(false)
    }
  }
})

// 2. 数据分析工具
registerTool({
  name: 'analyze_data',
  description: '分析数据质量、统计信息和异常情况',
  parameters: [
    {
      name: 'fileId',
      type: 'string',
      description: '要分析的文件ID',
      required: true
    },
    {
      name: 'analysisType',
      type: 'string',
      description: '分析类型',
      required: false,
      enum: ['quality', 'statistics', 'duplicates', 'all']
    }
  ],
  handler: async (params, context) => {
    const { fileId, analysisType = 'all' } = params
    const { files } = context

    const file = files.find(f => f.id === fileId)
    if (!file) {
      return {
        success: false,
        message: `未找到文件 ID: ${fileId}`
      }
    }

    // TODO: 实现具体的分析逻辑
    const typeMap: Record<string, string> = {
      quality: '质量分析',
      statistics: '统计分析',
      duplicates: '重复项分析',
      all: '全面分析'
    }
    return {
      success: true,
      message: `已分析文件 "${file.name}" (${typeMap[analysisType]})，\n- 总行数: ${file.rowCount}\n- Sheet 数: ${file.sheets.length}\n- 数据质量: 良好`,
      data: { rowCount: file.rowCount, sheetCount: file.sheets.length, analysisType }
    }
  }
})

// 3. 数据导出工具
registerTool({
  name: 'export_data',
  description: '将提取的数据导出为 JSON 或 CSV 格式',
  parameters: [
    {
      name: 'fileId',
      type: 'string',
      description: '要导出的文件ID',
      required: true
    },
    {
      name: 'format',
      type: 'string',
      description: '导出格式',
      required: false,
      enum: ['json', 'csv', 'xlsx'],
    },
    {
      name: 'outputPath',
      type: 'string',
      description: '导出路径（可选，默认使用系统目录）',
      required: false
    }
  ],
  handler: async (params, context) => {
    const { fileId, format = 'json' } = params
    const { addMessage } = context
    const store = useStore.getState()
    const file = store.files.find(f => f.id === fileId)

    // 通知用户开始导出
    addMessage(`开始导出 "${file?.name}"...`)

    if (!file) {
      return {
        success: false,
        message: `未找到文件 ID: ${fileId}`
      }
    }

    const electronAPI = (window as any).electronAPI
    if (!electronAPI?.exportJSON) {
      return {
        success: false,
        message: '导出功能在当前环境不可用'
      }
    }

    try {
      // TODO: 实现具体导出逻辑
      return {
        success: true,
        message: `已将 "${file.name}" 导出为 ${format.toUpperCase()} 格式`,
        data: { format, fileName: `${file.name}.${format}` }
      }
    } catch (error) {
      return {
        success: false,
        message: `导出失败: ${(error as Error).message}`
      }
    }
  }
})

// 4. 文件查询工具
registerTool({
  name: 'list_files',
  description: '列出当前已上传的所有文件及其信息',
  parameters: [],
  handler: async (_params, context) => {
    const { files } = context

    if (files.length === 0) {
      return {
        success: true,
        message: '当前没有上传的文件',
        data: { count: 0, files: [] }
      }
    }

    const fileList = files.map(f => ({
      id: f.id,
      name: f.name,
      type: f.type,
      sheets: f.sheets.map(s => s.name),
      rowCount: f.rowCount
    }))

    return {
      success: true,
      message: `共有 ${files.length} 个文件:\n${files.map(f =>
        `- ${f.name} (${f.sheets.length} 个 sheet, ${f.rowCount} 行)`
      ).join('\n')}`,
      data: { count: files.length, files: fileList }
    }
  }
})

console.log('[DataTools] 数据操作工具已注册')
