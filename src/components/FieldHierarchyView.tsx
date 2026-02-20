import { useMemo } from 'react'
import type { FieldHierarchy } from '../types'

interface FieldHierarchyViewProps {
  fields: FieldHierarchy[]
  onSelect?: (field: FieldHierarchy) => void
  selectedPath?: string
}

export default function FieldHierarchyView({ fields, onSelect, selectedPath }: FieldHierarchyViewProps) {
  // 构建树状结构
  const tree = useMemo(() => {
    const rootNodes: FieldHierarchy[] = []
    const nodeMap = new Map<string, FieldHierarchy[]>() // parent -> children

    // 先按层级排序
    const sortedFields = [...fields].sort((a, b) => a.level - b.level)

    // 构建映射
    sortedFields.forEach((field) => {
      if (!field.parent) {
        rootNodes.push(field)
      } else {
        if (!nodeMap.has(field.parent)) {
          nodeMap.set(field.parent, [])
        }
        nodeMap.get(field.parent)!.push(field)
      }
    })

    return { rootNodes, nodeMap }
  }, [fields])

  // 递归渲染节点
  const renderNode = (field: FieldHierarchy, depth: number = 0) => {
    const children = tree.nodeMap.get(field.displayName) || []
    const isSelected = selectedPath === field.fullPath

    return (
      <div key={field.fullPath}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 8px',
            paddingLeft: depth * 16 + 8,
            cursor: onSelect ? 'pointer' : 'default',
            background: isSelected ? '#e0e7ff' : 'transparent',
            borderRadius: 4,
            transition: 'background 0.15s',
          }}
          onClick={() => onSelect?.(field)}
          onMouseEnter={(e) => {
            if (onSelect && !isSelected) {
              e.currentTarget.style.background = '#f3f4f6'
            }
          }}
          onMouseLeave={(e) => {
            if (!isSelected) {
              e.currentTarget.style.background = 'transparent'
            }
          }}
        >
          {/* 展开/折叠图标（如果有子节点） */}
          <span style={{ width: 16, flexShrink: 0 }}>
            {children.length > 0 && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <path d="M9 18l6-6-6-6" />
              </svg>
            )}
          </span>
          {/* 字段名称 */}
          <span style={{ fontWeight: depth === 0 ? 500 : 400, fontSize: 13 }}>
            {field.displayName}
          </span>
          {/* 列索引 */}
          <span style={{ color: '#9ca3af', fontSize: 11, marginLeft: 'auto' }}>
            列 {field.columnIndex + 1}
          </span>
        </div>
        {/* 子节点 */}
        {children.map((child) => renderNode(child, depth + 1))}
      </div>
    )
  }

  if (fields.length === 0) {
    return (
      <div style={{ padding: 16, color: '#9ca3af', textAlign: 'center', fontSize: 13 }}>
        暂无字段信息
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {tree.rootNodes.map((node) => renderNode(node))}
    </div>
  )
}
