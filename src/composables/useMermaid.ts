import { onMounted } from 'vue'
import mermaid from 'mermaid'

/**
 * Mermaid 圖表渲染 composable
 * 負責初始化 Mermaid 並渲染圖表
 */
export function useMermaid() {
  // Mermaid 初始化標記
  let isInitialized = false

  /**
   * 初始化 Mermaid
   */
  const initMermaid = async () => {
    if (isInitialized) return

    try {
      // 配置 Mermaid 主題（根據當前主題動態調整）
      const theme = document.documentElement.classList.contains('v-theme--dark')
        ? 'dark'
        : 'default'

      mermaid.initialize({
        startOnLoad: false, // 不自動渲染，由我們手動控制
        theme: theme,
        securityLevel: 'loose', // 允許更多圖表類型
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis'
        },
        sequence: {
          diagramMarginX: 50,
          diagramMarginY: 10,
          actorMargin: 50,
          width: 150,
          height: 65,
          boxMargin: 10,
          boxTextMargin: 5,
          noteMargin: 10,
          messageMargin: 35,
          mirrorActors: true,
          bottomMarginAdj: 1,
          useMaxWidth: true,
          rightAngles: false,
          showSequenceNumbers: false
        },
        gantt: {
          titleTopMargin: 25,
          barHeight: 20,
          barGap: 4,
          topPadding: 50,
          leftPadding: 75,
          gridLineStartPadding: 35,
          fontSize: 11,
          numberSectionStyles: 4,
          axisFormat: '%Y-%m-%d',
          topAxis: false
        }
      })

      isInitialized = true
    } catch (error) {
      console.error('Failed to initialize Mermaid:', error)
    }
  }

  /**
   * 渲染單個 Mermaid 圖表
   * @param container - 包含 Mermaid 程式碼的容器元素
   * @param mermaidCode - Mermaid 程式碼字串
   * @returns Promise<void>
   */
  const renderMermaid = async (
    container: HTMLElement,
    mermaidCode: string
  ): Promise<void> => {
    try {
      // 確保 Mermaid 已初始化
      if (!isInitialized) {
        await initMermaid()
      }

      // 生成唯一 ID
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // 創建臨時元素用於渲染
      const tempDiv = document.createElement('div')
      tempDiv.className = 'mermaid'
      tempDiv.id = id
      tempDiv.textContent = mermaidCode.trim()

      // 清空容器並添加臨時元素
      container.innerHTML = ''
      container.appendChild(tempDiv)

      // 使用 Mermaid 渲染
      const { svg } = await mermaid.render(id, mermaidCode.trim())

      // 替換為渲染後的 SVG
      container.innerHTML = svg

      // 移除錯誤訊息（如果存在）
      const errorElement = container.querySelector('.mermaid-error')
      if (errorElement) {
        errorElement.remove()
      }
    } catch (error) {
      console.error('Mermaid rendering error:', error)
      
      // 顯示錯誤訊息
      const errorMessage = error instanceof Error ? error.message : String(error)
      container.innerHTML = `
        <div class="mermaid-error">
          <p><strong>⚠️ Mermaid 圖表渲染錯誤</strong></p>
          <pre>${escapeHtml(errorMessage)}</pre>
          <details style="margin-top: 8px;">
            <summary style="cursor: pointer; color: rgba(244, 67, 54, 0.8);">查看原始程式碼</summary>
            <pre style="margin-top: 8px; padding: 8px; background: rgba(0, 0, 0, 0.1); border-radius: 4px; font-size: 0.85em;">${escapeHtml(mermaidCode)}</pre>
          </details>
        </div>
      `
    }
  }

  /**
   * 渲染容器內的所有 Mermaid 圖表
   * @param container - 包含 Mermaid 區塊的容器元素
   */
  const renderAllMermaid = async (container: HTMLElement): Promise<void> => {
    // 確保 Mermaid 已初始化
    if (!isInitialized) {
      await initMermaid()
    }

    // 查找所有 mermaid 容器
    const mermaidContainers = container.querySelectorAll<HTMLElement>(
      '.mermaid-container[data-mermaid-code]'
    )

    // 並行渲染所有圖表
    const renderPromises = Array.from(mermaidContainers).map(async (el) => {
      const mermaidCode = el.getAttribute('data-mermaid-code')
      if (mermaidCode) {
        await renderMermaid(el, mermaidCode)
      }
    })

    await Promise.all(renderPromises)
  }

  /**
   * HTML 轉義函數
   */
  function escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  // 在組件掛載時初始化
  onMounted(() => {
    initMermaid()
  })

  return {
    initMermaid,
    renderMermaid,
    renderAllMermaid,
    isInitialized: () => isInitialized
  }
}
