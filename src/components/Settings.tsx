import React, { useState } from 'react'
import { useStore } from '../store/useStore'

interface SettingsProps {
  onClose: () => void
}

const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const { aiConfig, setAIConfig } = useStore()
  const [localConfig, setLocalConfig] = useState(aiConfig)

  const providers = [
    { id: 'local', name: '本地模式', description: '无需 API Key，使用模拟响应' },
    { id: 'kimi-coding', name: 'Kimi Coding', description: 'Kimi 编程助手，API 端点: api.kimi.com/coding' },
    { id: 'kimi', name: 'Kimi (Moonshot)', description: '月之暗面 AI，API 端点: api.moonshot.cn' },
    { id: 'zhipu', name: '智谱 GLM', description: '智谱 AI，API 端点: open.bigmodel.cn' },
    { id: 'openai', name: 'OpenAI', description: 'GPT-4 等，API 端点: api.openai.com' },
    { id: 'anthropic', name: 'Anthropic', description: 'Claude，API 端点: api.anthropic.com' },
  ]

  const handleSave = () => {
    setAIConfig(localConfig)
    onClose()
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>设置</h2>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.content}>
          <h3 style={styles.sectionTitle}>AI 配置</h3>

          <div style={styles.field}>
            <label style={styles.label}>AI 提供商</label>
            <select
              style={styles.select}
              value={localConfig.provider}
              onChange={(e) => setLocalConfig({
                ...localConfig,
                provider: e.target.value as typeof localConfig.provider
              })}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p style={styles.hint}>
              {providers.find(p => p.id === localConfig.provider)?.description}
            </p>
          </div>

          {localConfig.provider !== 'local' && (
            <div style={styles.field}>
              <label style={styles.label}>API Key</label>
              <input
                type="password"
                style={styles.input}
                placeholder="请输入 API Key"
                value={localConfig.apiKey}
                onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
              />
              <p style={styles.hint}>
                API Key 将安全存储在本地，不会上传到任何服务器
              </p>
            </div>
          )}

          {localConfig.provider === 'local' && (
            <div style={styles.infoBox}>
              本地模式下，AI 将使用预设的模拟响应。
              如需真实的 AI 对话能力，请选择其他提供商并配置 API Key。
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose}>取消</button>
          <button style={styles.saveBtn} onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    width: 480,
    maxWidth: '90vw',
    maxHeight: '90vh',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #333',
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: '#fff',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: 24,
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  },
  content: {
    padding: 20,
    maxHeight: 400,
    overflowY: 'auto',
  },
  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: 14,
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    display: 'block',
    marginBottom: 8,
    fontSize: 14,
    fontWeight: 500,
    color: '#ddd',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    backgroundColor: '#2a2a2a',
    border: '1px solid #444',
    borderRadius: 6,
    color: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    backgroundColor: '#2a2a2a',
    border: '1px solid #444',
    borderRadius: 6,
    color: '#fff',
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  hint: {
    margin: '8px 0 0 0',
    fontSize: 12,
    color: '#666',
  },
  infoBox: {
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    fontSize: 13,
    color: '#aaa',
    lineHeight: 1.5,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    padding: '16px 20px',
    borderTop: '1px solid #333',
  },
  cancelBtn: {
    padding: '8px 16px',
    fontSize: 14,
    backgroundColor: 'transparent',
    border: '1px solid #444',
    borderRadius: 6,
    color: '#aaa',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '8px 20px',
    fontSize: 14,
    backgroundColor: '#6366f1',
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 500,
  },
}

export default Settings
