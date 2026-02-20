// 简单的 Markdown 渲染组件，支持表格
interface Props {
  content: string
}

export default function MarkdownMessage({ content }: Props) {
  // 检查是否包含表格
  const hasTable = content.includes('|')

  if (!hasTable) {
    return <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>
  }

  // 解析并渲染 Markdown
  const lines = content.split('\n')
  const elements: JSX.Element[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // 检测表格开始：当前行以 | 开头，且下一行包含 | 和 -（分隔线）
    if (line.startsWith('|') && i + 1 < lines.length &&
        lines[i + 1].startsWith('|') && lines[i + 1].includes('-')) {
      const tableLines: string[] = []
      tableLines.push(line)
      i++

      // 收集所有表格行
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }

      // 渲染表格
      elements.push(renderTable(tableLines))
    } else {
      // 普通文本行
      if (line.trim()) {
        elements.push(
          <p key={i} style={{ margin: '0 0 8px 0', whiteSpace: 'pre-wrap' }}>
            {renderInline(line)}
          </p>
        )
      } else {
        elements.push(<br key={i} />)
      }
      i++
    }
  }

  return <div>{elements}</div>
}

// 智能分割表格行，处理单元格内的 |
function splitTableRow(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inCode = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '`') {
      inCode = !inCode
      current += char
    } else if (char === '|' && !inCode) {
      // 检查是否是转义的 |
      if (i > 0 && line[i - 1] === '\\') {
        // 移除反斜杠，保留 |
        current = current.slice(0, -1) + '|'
      } else {
        cells.push(current.trim())
        current = ''
      }
    } else {
      current += char
    }
  }

  // 添加最后一个单元格
  if (current.trim()) {
    cells.push(current.trim())
  }

  // 移除首尾的空白单元格（由行首行尾的 | 产生）
  return cells.slice(1).filter((c, i, arr) => !(i === arr.length - 1 && c === ''))
}

// 渲染表格
function renderTable(lines: string[]): JSX.Element {
  if (lines.length < 2) return <div>{lines.join('\n')}</div>

  // 解析表头（第一行）
  const headers = splitTableRow(lines[0])

  // 计算最大列数（用于对齐）
  const maxCols = Math.max(
    headers.length,
    ...lines.slice(2).map(line => splitTableRow(line).length)
  )

  // 跳过分隔行（第二行），解析数据行
  const dataLines = lines.slice(2)
  const rows = dataLines.map(line => {
    const cells = splitTableRow(line)
    // 补齐单元格数量
    while (cells.length < maxCols) {
      cells.push('')
    }
    return cells.slice(0, maxCols)
  }).filter(row => row.some(cell => cell !== ''))

  return (
    <table
      style={{
        borderCollapse: 'collapse',
        width: '100%',
        fontSize: 13,
        margin: '12px 0',
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <thead>
        <tr style={{ background: '#f9fafb' }}>
          {headers.map((h, idx) => (
            <th
              key={idx}
              style={{
                padding: '10px 12px',
                textAlign: 'left',
                borderBottom: '2px solid #e5e7eb',
                fontWeight: 600,
                color: '#374151',
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIdx) => (
          <tr key={rowIdx} style={{ borderBottom: '1px solid #f3f4f6' }}>
            {row.map((cell, cellIdx) => (
              <td
                key={cellIdx}
                style={{
                  padding: '8px 12px',
                  color: '#4b5563',
                }}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// 渲染行内元素（粗体、代码等）
function renderInline(text: string): JSX.Element {
  // 处理粗体 **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g)

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
