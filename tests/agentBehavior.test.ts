// Agent 行为模拟测试
// 测试用户场景和意图识别的正确性

import { describe, it, expect } from 'vitest'
import { parseIntent, executeAgentCommand, type AgentResult } from '../src/utils/aiAgent'
import type { DataFile } from '../src/types'

// 模拟文件数据
const mockFiles: DataFile[] = [
  {
    id: 'file-1',
    name: '阿里202501.xlsx',
    type: 'excel',
    path: '/temp/阿里202501.xlsx',
    sheets: [
      {
        name: '机票明细',
        headers: ['日期', '航班号', '出发地', '目的地', '金额'],
        rowCount: 100,
        columnTypes: ['date', 'string', 'string', 'string', 'number'],
        sampleRows: []
      },
      {
        name: '酒店记录',
        headers: ['日期', '酒店名', '城市', '金额'],
        rowCount: 50,
        columnTypes: ['date', 'string', 'string', 'number'],
        sampleRows: []
      }
    ],
    activeSheet: '机票明细',
    position: { x: 100, y: 100 },
    size: { width: 500, height: 400 },
    quality: 100,
    rowCount: 150,
    createdAt: Date.now()
  },
  {
    id: 'file-2',
    name: '携程202501.xlsx',
    type: 'excel',
    path: '/temp/携程202501.xlsx',
    sheets: [
      {
        name: '机票订单',
        headers: ['订单号', '日期', '航线', '价格'],
        rowCount: 80,
        columnTypes: ['string', 'date', 'string', 'number'],
        sampleRows: []
      }
    ],
    activeSheet: '机票订单',
    position: { x: 700, y: 100 },
    size: { width: 500, height: 350 },
    quality: 100,
    rowCount: 80,
    createdAt: Date.now()
  }
]

describe('意图识别置信度', () => {
  it('应该高置信度识别提取指令', () => {
    const result = parseIntent('提取机票数据')
    expect(result.type).toBe('extract')
    expect(result.target).toBe('机票')
    expect(result.confidence).toBeGreaterThanOrEqual(0.8)
    expect(result.reason).toContain('提取')
  })

  it('应该高置信度识别分析指令', () => {
    const result = parseIntent('分析一下数据质量')
    expect(result.type).toBe('analyze')
    expect(result.confidence).toBeGreaterThanOrEqual(0.8)
  })

  it('应该高置信度识别转换指令', () => {
    const result = parseIntent('转成JSON格式')
    expect(result.type).toBe('transform')
    expect(result.confidence).toBeGreaterThanOrEqual(0.8)
  })

  it('应该中置信度识别弱意图', () => {
    const result = parseIntent('我要机票')
    expect(result.type).toBe('extract')
    expect(result.target).toBe('机票')
    expect(result.confidence).toBeGreaterThanOrEqual(0.5)
    expect(result.confidence).toBeLessThan(0.8)
  })

  it('应该低置信度处理模糊输入', () => {
    const result = parseIntent('处理一下')
    expect(result.type).toBe('unknown')
    expect(result.confidence).toBeLessThan(0.5)
  })

  it('应该低置信度处理不相关输入', () => {
    const result = parseIntent('今天天气怎么样')
    expect(result.type).toBe('unknown')
    expect(result.confidence).toBe(0)
  })
})

describe('目标识别', () => {
  it('应该识别机票目标', () => {
    const result = parseIntent('导出机票信息')
    expect(result.target).toBe('机票')
  })

  it('应该识别酒店目标', () => {
    const result = parseIntent('提取酒店数据')
    expect(result.target).toBe('酒店')
  })

  it('应该识别火车目标', () => {
    const result = parseIntent('保存火车记录')
    expect(result.target).toBe('火车')
  })

  it('应该识别用车目标', () => {
    const result = parseIntent('导出用车明细')
    expect(result.target).toBe('用车')
  })

  it('无目标时应该返回undefined', () => {
    const result = parseIntent('提取数据')
    expect(result.target).toBeUndefined()
  })
})

describe('Agent 执行场景', () => {
  it('高置信度指令应该直接执行', async () => {
    // 注意：实际执行需要 Electron 环境，这里只测试返回结构
    // 在真实环境中会返回执行结果
    const result = await executeAgentCommand('提取机票数据', { files: mockFiles })

    // 如果没有 Electron 环境，应该返回错误
    // 但错误消息应该清晰说明问题
    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('message')
  })

  it('空文件列表应该返回友好提示', async () => {
    const result = await executeAgentCommand('提取机票数据', { files: [] })
    expect(result.success).toBe(false)
    expect(result.message).toContain('上传')
  })
})

describe('边界情况', () => {
  it('应该处理空字符串', () => {
    const result = parseIntent('')
    expect(result.type).toBe('unknown')
    expect(result.confidence).toBe(0)
  })

  it('应该处理只有空格的字符串', () => {
    const result = parseIntent('   ')
    expect(result.type).toBe('unknown')
  })

  it('应该处理混合意图', () => {
    // "分析并导出" - 应该识别其中一个
    const result = parseIntent('分析一下然后导出')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('应该处理大小写混合', () => {
    const result = parseIntent('提取Ji票数据')
    // "Ji票" 不会匹配 "机票"，但 "提取" 会匹配
    expect(result.type).toBe('extract')
    expect(result.target).toBeUndefined()
  })
})

describe('多文件处理', () => {
  it('应该匹配多个文件中的目标 sheet', () => {
    // 两个文件都有机票相关 sheet
    const targetSheets = mockFiles.flatMap(f =>
      f.sheets.filter(s => s.name.includes('机票')).map(s => ({ file: f.name, sheet: s.name }))
    )

    expect(targetSheets.length).toBe(2)
    expect(targetSheets.some(t => t.file === '阿里202501.xlsx')).toBe(true)
    expect(targetSheets.some(t => t.file === '携程202501.xlsx')).toBe(true)
  })

  it('应该正确处理文件过滤', () => {
    const filtered = mockFiles.filter(f => f.name.includes('阿里'))
    expect(filtered.length).toBe(1)
    expect(filtered[0].name).toBe('阿里202501.xlsx')
  })
})

// 场景测试
describe('用户场景模拟', () => {
  it('场景1: 用户想提取阿里的机票', async () => {
    const intent = parseIntent('提取阿里文件中的机票数据')
    expect(intent.type).toBe('extract')
    expect(intent.target).toBe('机票')
    expect(intent.confidence).toBeGreaterThan(0.8)
  })

  it('场景2: 用户说模糊的话', async () => {
    const intent = parseIntent('帮我看看这些数据')
    expect(intent.type).toBe('analyze')
    expect(intent.confidence).toBeGreaterThan(0.5)
    // 应该返回中置信度，并建议更明确的指令
  })

  it('场景3: 用户想导出所有数据', async () => {
    const intent = parseIntent('全部导出')
    expect(intent.type).toBe('extract')
    // 没有特定目标，应该提取所有
    expect(intent.target).toBeUndefined()
  })
})
