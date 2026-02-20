import type { TableStructureAnalysis } from '../types'

interface AnalysisConfirmModalProps {
  analysis: TableStructureAnalysis
  fileName: string
  onConfirm: () => void
  onReanalyze?: () => void
  onClose: () => void
}

export default function AnalysisConfirmModal({
  analysis,
  fileName,
  onConfirm,
  onReanalyze,
  onClose,
}: AnalysisConfirmModalProps) {

  const confidencePercent = Math.round(analysis.confidence * 100)
  const isLowConfidence = analysis.confidence < 0.7

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
          width: '90%',
          maxWidth: 600,
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>表格结构分析结果</h3>
            <div style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>{fileName}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 内容 */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {/* 置信度 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 20,
              padding: 16,
              background: isLowConfidence ? '#fef3c7' : '#ecfdf5',
              borderRadius: 12,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: isLowConfidence ? '#f59e0b' : '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {confidencePercent}%
            </div>
            <div>
              <div style={{ fontWeight: 500, color: isLowConfidence ? '#92400e' : '#065f46' }}>
                {isLowConfidence ? '置信度较低' : '置信度良好'}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>
                {isLowConfidence ? '建议检查识别结果是否正确' : '表格结构识别较为准确'}
              </div>
            </div>
          </div>

          {/* 分析详情 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ padding: 16, background: '#f9fafb', borderRadius: 12 }}>
              <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>表格类型</div>
              <div style={{ fontWeight: 500 }}>
                {analysis.sheetType === 'standard' ? '标准表格' : analysis.sheetType === 'irregular' ? '异形表格' : '未知'}
              </div>
            </div>
            <div style={{ padding: 16, background: '#f9fafb', borderRadius: 12 }}>
              <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>表头行</div>
              <div style={{ fontWeight: 500 }}>第 {analysis.headerRow + 1} 行</div>
            </div>
            <div style={{ padding: 16, background: '#f9fafb', borderRadius: 12 }}>
              <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>数据起始行</div>
              <div style={{ fontWeight: 500 }}>第 {analysis.dataStartRow + 1} 行</div>
            </div>
            <div style={{ padding: 16, background: '#f9fafb', borderRadius: 12 }}>
              <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>识别字段数</div>
              <div style={{ fontWeight: 500 }}>{analysis.fields?.length || 0} 个</div>
            </div>
          </div>

          {/* 字段列表 */}
          {analysis.fields && analysis.fields.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 500, marginBottom: 12 }}>字段列表</div>
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: 12,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                {analysis.fields.map((field, index) => (
                  <span
                    key={index}
                    style={{
                      padding: '4px 12px',
                      background: '#e0e7ff',
                      color: '#4f46e5',
                      borderRadius: 16,
                      fontSize: 13,
                    }}
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 原始表头预览 */}
          {analysis.rawHeaders && analysis.rawHeaders.length > 0 && (
            <div>
              <div style={{ fontWeight: 500, marginBottom: 12 }}>表头预览</div>
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  overflow: 'auto',
                }}
              >
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <tbody>
                    {analysis.rawHeaders.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, colIndex) => (
                          <td
                            key={colIndex}
                            style={{
                              padding: '8px 12px',
                              borderBottom: rowIndex < analysis.rawHeaders!.length - 1 ? '1px solid #f3f4f6' : 'none',
                              borderRight: colIndex < row.length - 1 ? '1px solid #f3f4f6' : 'none',
                              background: rowIndex === 0 ? '#f9fafb' : 'white',
                            }}
                          >
                            {cell || <span style={{ color: '#d1d5db' }}>(空)</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #f3f4f6',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
          }}
        >
          {onReanalyze && (
            <button
              onClick={onReanalyze}
              style={{
                padding: '10px 20px',
                border: '1px solid #d1d5db',
                background: 'white',
                borderRadius: 8,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              重新分析
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid #d1d5db',
              background: 'white',
              borderRadius: 8,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: '#6366f1',
              color: 'white',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            应用到全部数据
          </button>
        </div>
      </div>
    </div>
  )
}
