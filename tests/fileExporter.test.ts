import { describe, it, expect } from 'vitest'
import { exportToCSV, exportToJSON } from '../src/utils/fileExporter'

describe('fileExporter', () => {
  const testData = {
    headers: ['name', 'age', 'city'],
    rows: [['张三', 25, '北京'], ['李四', 30, '上海']],
  }

  it('should export to CSV', () => {
    const blob = exportToCSV(testData, { format: 'csv', includeHeaders: true })
    expect(blob.type).toBe('text/csv;charset=utf-8')
  })

  it('should export to JSON', () => {
    const blob = exportToJSON(testData, { format: 'json', includeHeaders: true })
    expect(blob.type).toBe('application/json')
  })
})
