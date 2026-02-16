interface Props {
  scale: number
  panX: number
  panY: number
}

export default function AlignmentLines({ scale, panX, panY }: Props) {
  // 对齐线会在拖拽时动态添加
  return (
    <svg
      id="alignmentLines"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 3000,
        height: 3000,
        pointerEvents: 'none',
        zIndex: 99,
        transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
        transformOrigin: '0 0',
      }}
    />
  )
}
