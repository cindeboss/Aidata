// 工具注册表 - 类似 MCP (Model Context Protocol) 的实现
// 统一管理所有可用的工具和它们的元数据

import type { DataFile } from '../types'

// 工具参数定义
export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  required?: boolean
  enum?: string[]  // 可选值列表
}

// 工具定义
export interface ToolDefinition {
  name: string
  description: string
  parameters: ToolParameter[]
  handler: (params: Record<string, any>, context: ToolContext) => Promise<ToolResult>
}

// 工具执行上下文
export interface ToolContext {
  files: DataFile[]
  addMessage: (content: string) => void
  setLoading: (loading: boolean) => void
}

// 工具执行结果
export interface ToolResult {
  success: boolean
  message: string
  data?: any
}

// 工具注册表类
class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map()

  // 注册工具
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[ToolRegistry] 工具 ${tool.name} 已存在，将被覆盖`)
    }
    this.tools.set(tool.name, tool)
    console.log(`[ToolRegistry] 注册工具: ${tool.name}`)
  }

  // 获取工具
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  // 获取所有工具
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  // 检查工具是否存在
  has(name: string): boolean {
    return this.tools.has(name)
  }

  // 列出所有工具名称
  list(): string[] {
    return Array.from(this.tools.keys())
  }

  // 验证参数
  validateParams(toolName: string, params: Record<string, any>): { valid: boolean; errors: string[] } {
    const tool = this.get(toolName)
    if (!tool) {
      return { valid: false, errors: [`工具 ${toolName} 不存在`] }
    }

    const errors: string[] = []

    // 检查必填参数
    for (const param of tool.parameters) {
      if (param.required && !(param.name in params)) {
        errors.push(`缺少必填参数: ${param.name}`)
      }
    }

    // 检查参数类型
    for (const [key, value] of Object.entries(params)) {
      const param = tool.parameters.find(p => p.name === key)
      if (!param) {
        errors.push(`未知参数: ${key}`)
        continue
      }

      // 类型检查
      const actualType = Array.isArray(value) ? 'array' : typeof value
      if (actualType !== param.type) {
        errors.push(`参数 ${key} 类型错误: 期望 ${param.type}, 实际 ${actualType}`)
      }

      // 枚举值检查
      if (param.enum && !param.enum.includes(value)) {
        errors.push(`参数 ${key} 值错误: 必须是 ${param.enum.join(' / ')} 之一`)
      }
    }

    return { valid: errors.length === 0, errors }
  }

  // 执行工具
  async execute(
    name: string,
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = this.get(name)
    if (!tool) {
      return {
        success: false,
        message: `工具 ${name} 不存在。可用工具: ${this.list().join(', ')}`
      }
    }

    // 验证参数
    const validation = this.validateParams(name, params)
    if (!validation.valid) {
      return {
        success: false,
        message: `参数验证失败:\n${validation.errors.join('\n')}`
      }
    }

    // 执行工具
    try {
      console.log(`[ToolRegistry] 执行工具: ${name}`, params)
      const result = await tool.handler(params, context)
      console.log(`[ToolRegistry] 工具执行完成: ${name}`, result.success)
      return result
    } catch (error) {
      console.error(`[ToolRegistry] 工具执行错误: ${name}`, error)
      return {
        success: false,
        message: `工具执行失败: ${(error as Error).message}`
      }
    }
  }

  // 生成工具描述文本（用于 AI 提示）
  generateToolDescription(): string {
    const tools = this.getAll()
    if (tools.length === 0) {
      return '暂无可用工具'
    }

    return tools.map(tool => {
      const params = tool.parameters.map(p => {
        const required = p.required ? '(必填)' : '(可选)'
        const enumValues = p.enum ? ` [可选值: ${p.enum.join('/')}]` : ''
        return `  - ${p.name}: ${p.type} ${required} - ${p.description}${enumValues}`
      }).join('\n')

      return `## ${tool.name}\n${tool.description}\n参数:\n${params || '  无参数'}`
    }).join('\n\n')
  }
}

// 导出单例
export const toolRegistry = new ToolRegistry()

// 导出便捷函数
export const registerTool = (tool: ToolDefinition) => toolRegistry.register(tool)
export const getTool = (name: string) => toolRegistry.get(name)
export const executeTool = toolRegistry.execute.bind(toolRegistry)
