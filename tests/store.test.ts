import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../src/store/useStore'

describe('useStore', () => {
  beforeEach(() => {
    // 重置 store
    useStore.setState({
      files: [],
      flows: [],
      messages: [],
      canvas: {
        scale: 0.8,
        panX: 80,
        panY: 60,
        mode: 'drag',
        selectedCards: [],
      },
      activeFileId: null,
      isLoading: false,
      error: null,
    })
  })

  it('should add file', () => {
    const { addFile, files } = useStore.getState()

    const fileId = addFile({
      name: 'test.csv',
      type: 'csv',
      sheets: [{ name: 'Sheet1', headers: ['a', 'b'], rowCount: 10, columnTypes: ['string', 'number'] }],
      activeSheet: 'Sheet1',
      position: { x: 0, y: 0 },
      size: { width: 400, height: 300 },
      quality: 95,
      rowCount: 10,
    })

    expect(fileId).toBeDefined()
    expect(useStore.getState().files).toHaveLength(1)
  })

  it('should update canvas scale', () => {
    const { setCanvasScale, canvas } = useStore.getState()

    setCanvasScale(1.0)

    expect(useStore.getState().canvas.scale).toBe(1.0)
  })

  it('should add message', () => {
    const { addMessage } = useStore.getState()

    addMessage({ role: 'user', content: '你好' })

    const messages = useStore.getState().messages
    expect(messages.length).toBeGreaterThan(0)
    expect(messages[messages.length - 1].content).toBe('你好')
  })
})
