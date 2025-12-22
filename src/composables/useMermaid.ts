import mermaid from 'mermaid'
import { onMounted } from 'vue'

/**
 * Mermaid diagram rendering composable
 * Responsible for initializing Mermaid and rendering diagrams
 */
export function useMermaid() {
  // Mermaid initialization flag
  let isInitialized = false

  /**
   * Initialize Mermaid
   */
  const initMermaid = async () => {
    if (isInitialized) return

    try {
      // Configure Mermaid theme (dynamically adjusted based on current theme)
      const theme = document.documentElement.classList.contains('v-theme--dark')
        ? 'dark'
        : 'default'

      mermaid.initialize({
        startOnLoad: false, // Don't auto-render, we control it manually
        theme: theme,
        securityLevel: 'loose', // Allow more diagram types
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
   * Render a single Mermaid diagram
   * @param container - Container element containing Mermaid code
   * @param mermaidCode - Mermaid code string
   * @returns Promise<void>
   */
  const renderMermaid = async (
    container: HTMLElement,
    mermaidCode: string
  ): Promise<void> => {
    try {
      // Ensure Mermaid is initialized
      if (!isInitialized) {
        await initMermaid()
      }

      // Generate unique ID
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Create temporary element for rendering
      const tempDiv = document.createElement('div')
      tempDiv.className = 'mermaid'
      tempDiv.id = id
      tempDiv.textContent = mermaidCode.trim()

      // Clear container and add temporary element
      container.innerHTML = ''
      container.appendChild(tempDiv)

      // Render using Mermaid
      const { svg } = await mermaid.render(id, mermaidCode.trim())

      // Replace with rendered SVG
      container.innerHTML = svg

      // Remove error message (if exists)
      const errorElement = container.querySelector('.mermaid-error')
      if (errorElement) {
        errorElement.remove()
      }
    } catch (error) {
      console.error('Mermaid rendering error:', error)

      // Display error message
      const errorMessage = error instanceof Error ? error.message : String(error)
      container.innerHTML = `
        <div class="mermaid-error">
          <p><strong>⚠️ Mermaid Rendering Error</strong></p>
          <pre>${escapeHtml(errorMessage)}</pre>
          <details style="margin-top: 8px;">
            <summary style="cursor: pointer; color: rgba(244, 67, 54, 0.8);">View source code</summary>
            <pre style="margin-top: 8px; padding: 8px; background: rgba(0, 0, 0, 0.1); border-radius: 4px; font-size: 0.85em;">${escapeHtml(mermaidCode)}</pre>
          </details>
        </div>
      `
    }
  }

  /**
   * Render all Mermaid diagrams within a container
   * @param container - Container element containing Mermaid blocks
   */
  const renderAllMermaid = async (container: HTMLElement): Promise<void> => {
    // Ensure Mermaid is initialized
    if (!isInitialized) {
      await initMermaid()
    }

    // Find all mermaid containers
    const mermaidContainers = container.querySelectorAll<HTMLElement>(
      '.mermaid-container[data-mermaid-code]'
    )

    // Parallel render all diagrams
    const renderPromises = Array.from(mermaidContainers).map(async (el) => {
      const mermaidCode = el.getAttribute('data-mermaid-code')
      if (mermaidCode) {
        // Unescape HTML entities since the code was escaped when stored in the data attribute
        await renderMermaid(el, unescapeHtml(mermaidCode))
      }
    })

    await Promise.all(renderPromises)
  }

  /**
   * HTML escape function
   */
  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  /**
   * HTML unescape function - decodes HTML entities back to original characters
   * This is needed because mermaid code is HTML-escaped when stored in data attributes
   */
  function unescapeHtml(text: string): string {
    const div = document.createElement('div')
    div.innerHTML = text
    return div.textContent || ''
  }

  // Initialize on component mount
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
