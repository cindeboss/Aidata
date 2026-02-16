import { useState } from 'react'
import { useStore } from '../store/useStore'
import { exportData, downloadBlob } from '../utils/fileExporter'
import type { ExportConfig, TableData } from '../types'

interface Props {
  fileId: string
  onClose: () => void
}

export default function ExportModal({ fileId, onClose }: Props) {
  const { files } = useStore()
  const file = files.find((f) => f.id === fileId)

  const [config, setConfig] = useState<ExportConfig>({
    format: 'xlsx',
    includeHeaders: true,
    sheetName: file?.activeSheet || 'Sheet1',
  })

  if (!file) {
    return null
  }

  const handleExport = () => {
    // 构造表格数据
    const activeSheet = file.sheets.find((s) => s.name === file.activeSheet)
    const tableData: TableData = {
      headers: activeSheet?.headers || [],
      rows: [], // 实际应用中应该从文件中读取真实数据
    }

    const blob = exportData(tableData, config)
    const fileName = file.name.replace(/\.(xlsx|csv|json)$/, '') + '.' + config.format
    downloadBlob(blob, fileName)
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 16,
          padding: 24,
          width: 400,
          maxWidth: '90vw',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: 20, fontSize: 18, fontWeight: 600 }}>导出数据</h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: 'var(--text-secondary)' }}>
            导出格式
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['xlsx', 'csv', 'json'] as const).map((format) => (
              <button
                key={format}
                onClick={() => setConfig({ ...config, format })}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: config.format === format ? 'var(--accent-light)' : 'var(--bg-gray)',
                  border: `1px solid ${config.format === format ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 500,
                  color: config.format === format ? 'var(--accent)' : 'var(--text-primary)',
                }}
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config.includeHeaders}
              onChange={(e) => setConfig({ ...config, includeHeaders: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            <span>包含表头</span>
          </label>
        </div>

        {config.format === 'xlsx' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: 'var(--text-secondary)' }}>
              工作表名称
            </label>
            <input
              type="text"
              value={config.sheetName}
              onChange={(e) => setConfig({ ...config, sheetName: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 14,
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: 'var(--bg-gray)',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            取消
          </button>
          <button
            onClick={handleExport}
            style={{
              padding: '10px 20px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            导出
          </button>
        </div>
      </div>
    </div>
  )
}
