export default function DropOverlay() {
  return (
    <div className="drop-indicator">
      <div className="drop-indicator-content">
        <div className="drop-indicator-icon">📁</div>
        <div className="drop-indicator-text">拖放文件到这里</div>
        <div className="drop-indicator-hint">支持 CSV、Excel、JSON 格式</div>
      </div>
    </div>
  )
}
