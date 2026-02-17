import { describe, it, expect } from 'vitest'
import { parseFile } from '../src/utils/fileParser'

describe('fileParser', () => {
  it('should parse CSV file', async () => {
    const csvContent = 'name,age,city\n张三,25,北京\n李四,30,上海'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

    const result = await parseFile(file)

    expect(result.type).toBe('csv')
    expect(result.sheets).toHaveLength(1)
    expect(result.sheets[0].headers).toEqual(['name', 'age', 'city'])
    expect(result.rowCount).toBe(2)
  })

  it('should parse JSON file', async () => {
    const jsonContent = JSON.stringify([
      { name: '张三', age: 25 },
      { name: '李四', age: 30 }
    ])
    const file = new File([jsonContent], 'test.json', { type: 'application/json' })

    const result = await parseFile(file)

    expect(result.type).toBe('json')
    expect(result.sheets).toHaveLength(1)
    expect(result.rowCount).toBe(2)
  })

  it('should reject unsupported format', async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })

    await expect(parseFile(file)).rejects.toThrow('不支持的文件格式')
  })
})
