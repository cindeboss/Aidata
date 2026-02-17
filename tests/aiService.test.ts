import { describe, it, expect } from 'vitest'
import { callAI, DEFAULT_AI_CONFIG, generateAnalysisPrompt } from '../src/utils/aiService'

describe('aiService', () => {
  it('should have correct default config', () => {
    expect(DEFAULT_AI_CONFIG.provider).toBe('kimi-coding')
    expect(DEFAULT_AI_CONFIG.model).toBe('Kimi code')
    expect(DEFAULT_AI_CONFIG.apiKey).toBeDefined()
  })

  it('should generate analysis prompt', () => {
    const prompt = generateAnalysisPrompt({
      fileName: 'test.csv',
      rowCount: 100,
      columns: ['name', 'age', 'city'],
      sampleRows: [['张三', 25, '北京'], ['李四', 30, '上海']],
    })

    expect(prompt).toContain('test.csv')
    expect(prompt).toContain('100')
    expect(prompt).toContain('name, age, city')
    expect(prompt).toContain('张三')
  })

  it('should return local response when provider is local', async () => {
    const response = await callAI(
      [{ role: 'user', content: '帮我清洗数据' }],
      { provider: 'local' }
    )

    expect(response).toContain('数据质量问题')
  })

  it('should return error message when apiKey is missing', async () => {
    const response = await callAI(
      [{ role: 'user', content: '你好' }],
      { provider: 'kimi', apiKey: '' }
    )

    expect(response).toContain('请先配置')
  })
})
