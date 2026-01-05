import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { ref } from 'vue'

export interface PdfExportOptions {
    filename?: string
    margin?: number
    /** If true, generate a single continuous page without page breaks (default: true) */
    singlePage?: boolean
}

// Maximum canvas height to avoid browser limitations
// Chrome/Firefox typically support up to 16384px, but using a safer limit
const MAX_CANVAS_HEIGHT = 8000
const CHUNK_OVERLAP = 50 // Small overlap to prevent gaps between chunks

export function usePdfExport() {
    const isExporting = ref(false)
    const exportError = ref<string | null>(null)

    /**
     * Apply print-friendly styles to an element for PDF export
     */
    function applyPrintStyles(element: HTMLElement): void {
        // Apply base styles
        element.style.backgroundColor = '#ffffff'
        element.style.color = '#000000'
        element.style.padding = '20px'
        element.style.width = '800px'
        element.style.maxWidth = 'none'
        element.style.overflow = 'visible'
        element.style.overflowX = 'visible'
        element.style.overflowY = 'visible'

        // Fix SVG rendering issues in Mermaid diagrams
        const svgs = element.querySelectorAll('svg')
        svgs.forEach((svg) => {
            if (!svg.getAttribute('width')) {
                svg.setAttribute('width', '100%')
            }
            svg.style.backgroundColor = '#ffffff'
        })

        // Fix table border rendering for PDF export
        const tables = element.querySelectorAll('table')
        tables.forEach((table) => {
            table.style.borderCollapse = 'collapse'
            table.style.border = '0.5px solid #999999'
            table.style.width = '100%'
        })

        const tableCells = element.querySelectorAll('th, td')
        tableCells.forEach((cell) => {
            const cellElement = cell as HTMLElement
            cellElement.style.border = '0.5px solid #999999'
            cellElement.style.padding = '8px 12px'
        })

        const tableHeaders = element.querySelectorAll('th')
        tableHeaders.forEach((th) => {
            const thElement = th as HTMLElement
            thElement.style.backgroundColor = '#f5f5f5'
            thElement.style.fontWeight = '600'
        })
    }

    /**
     * Validate that canvas data URL is not empty
     * Returns true if valid, false if empty (which indicates canvas exceeded browser limits)
     */
    function isValidDataUrl(dataUrl: string): boolean {
        // Empty or minimal data URL indicates failure
        return Boolean(dataUrl && dataUrl.length > 100 && !dataUrl.endsWith('data:,'))
    }

    /**
     * Render a chunk of content to canvas
     * @param element - The element to render
     * @param yOffset - The vertical offset to start rendering from
     * @param chunkHeight - The height of the chunk to render
     * @param scale - The scale factor for rendering
     */
    async function renderChunk(
        element: HTMLElement,
        yOffset: number,
        chunkHeight: number,
        scale: number
    ): Promise<HTMLCanvasElement> {
        const canvas = await html2canvas(element, {
            scale,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            allowTaint: true,
            scrollX: 0,
            scrollY: -yOffset, // Scroll to the correct position
            windowWidth: 1200,
            height: chunkHeight,
            y: yOffset,
            onclone: (_clonedDoc, clonedElement) => {
                applyPrintStyles(clonedElement)
            }
        })

        // Validate the canvas
        const testDataUrl = canvas.toDataURL('image/jpeg', 0.1)
        if (!isValidDataUrl(testDataUrl)) {
            throw new Error(`Canvas chunk rendering failed at y=${yOffset}. Content may be too large.`)
        }

        return canvas
    }

    /**
     * Generate PDF from HTML element with chunked rendering for large content
     * @param element - The HTML element to convert to PDF
     * @param options - PDF export options
     */
    async function exportToPdf(
        element: HTMLElement,
        options: PdfExportOptions = {}
    ): Promise<void> {
        const {
            filename = 'document.pdf',
            margin = 10,
            singlePage = true
        } = options

        isExporting.value = true
        exportError.value = null

        try {
            // Get the actual content dimensions
            const elementHeight = element.scrollHeight
            const elementWidth = element.scrollWidth || 800
            const scale = 2

            // Calculate scaled dimensions
            const scaledHeight = elementHeight * scale
            const scaledWidth = elementWidth * scale

            // Check if we need chunked rendering
            const needsChunkedRendering = scaledHeight > MAX_CANVAS_HEIGHT * scale

            console.log(`PDF Export: Element size ${elementWidth}x${elementHeight}, scaled: ${scaledWidth}x${scaledHeight}`)
            console.log(`PDF Export: Chunked rendering: ${needsChunkedRendering}`)

            // Wide page format (280mm width, wider than A4)
            const PAGE_WIDTH_MM = 280
            const contentWidthMm = PAGE_WIDTH_MM - margin * 2

            if (!needsChunkedRendering) {
                // Standard rendering for smaller content
                const canvas = await html2canvas(element, {
                    scale,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    allowTaint: true,
                    scrollX: 0,
                    scrollY: 0,
                    windowWidth: 1200,
                    onclone: (_clonedDoc, clonedElement) => {
                        applyPrintStyles(clonedElement)
                    }
                })

                // Validate canvas
                const imgData = canvas.toDataURL('image/jpeg', 0.95)
                if (!isValidDataUrl(imgData)) {
                    throw new Error('Canvas rendering failed. The content may be too large for your browser.')
                }

                const imgWidth = canvas.width
                const imgHeight = canvas.height
                const pxToMm = contentWidthMm / imgWidth
                const contentHeightMm = imgHeight * pxToMm
                const pageHeightMm = contentHeightMm + margin * 2

                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: singlePage ? [PAGE_WIDTH_MM, pageHeightMm] : 'a4'
                })

                if (singlePage) {
                    pdf.addImage(imgData, 'JPEG', margin, margin, contentWidthMm, contentHeightMm)
                } else {
                    await renderMultiPagePdf(pdf, canvas, imgWidth, imgHeight, contentWidthMm, margin)
                }

                pdf.save(filename)
            } else {
                // Chunked rendering for large content
                console.log('PDF Export: Using chunked rendering for large content')

                const chunkHeight = Math.floor(MAX_CANVAS_HEIGHT / scale)
                const numChunks = Math.ceil(elementHeight / chunkHeight)
                const canvasChunks: HTMLCanvasElement[] = []

                console.log(`PDF Export: Rendering ${numChunks} chunks of ${chunkHeight}px each`)

                // Render each chunk
                for (let i = 0; i < numChunks; i++) {
                    const yOffset = i * (chunkHeight - CHUNK_OVERLAP)
                    const actualChunkHeight = Math.min(chunkHeight, elementHeight - yOffset)

                    console.log(`PDF Export: Rendering chunk ${i + 1}/${numChunks} at y=${yOffset}`)

                    const chunkCanvas = await renderChunk(element, yOffset, actualChunkHeight, scale)
                    canvasChunks.push(chunkCanvas)
                }

                // Calculate total dimensions
                const firstChunk = canvasChunks[0]
                const totalWidth = firstChunk.width
                const totalScaledHeight = canvasChunks.reduce((sum, c) => sum + c.height, 0)
                    - (canvasChunks.length - 1) * CHUNK_OVERLAP * scale // Subtract overlaps

                const pxToMm = contentWidthMm / totalWidth
                const totalHeightMm = totalScaledHeight * pxToMm
                const pageHeightMm = totalHeightMm + margin * 2

                // Create PDF
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: singlePage ? [PAGE_WIDTH_MM, pageHeightMm] : 'a4'
                })

                if (singlePage) {
                    // Add all chunks to a single page
                    let yPosition = margin
                    for (let i = 0; i < canvasChunks.length; i++) {
                        const chunk = canvasChunks[i]
                        const imgData = chunk.toDataURL('image/jpeg', 0.95)

                        if (!isValidDataUrl(imgData)) {
                            throw new Error(`Chunk ${i + 1} rendering failed.`)
                        }

                        const chunkHeightMm = chunk.height * pxToMm

                        // Skip overlap for all chunks except the first
                        const overlapMm = i > 0 ? CHUNK_OVERLAP * scale * pxToMm : 0

                        pdf.addImage(imgData, 'JPEG', margin, yPosition - overlapMm, contentWidthMm, chunkHeightMm)
                        yPosition += chunkHeightMm - overlapMm
                    }
                } else {
                    // Multi-page mode with chunks
                    const A4_HEIGHT_MM = 297
                    let yPositionOnPage = margin

                    for (let i = 0; i < canvasChunks.length; i++) {
                        const chunk = canvasChunks[i]
                        const imgData = chunk.toDataURL('image/jpeg', 0.95)

                        if (!isValidDataUrl(imgData)) {
                            throw new Error(`Chunk ${i + 1} rendering failed.`)
                        }

                        const chunkHeightMm = chunk.height * pxToMm

                        // Check if we need a new page
                        if (yPositionOnPage + chunkHeightMm > A4_HEIGHT_MM - margin) {
                            pdf.addPage()
                            yPositionOnPage = margin
                        }

                        pdf.addImage(imgData, 'JPEG', margin, yPositionOnPage, contentWidthMm, chunkHeightMm)
                        yPositionOnPage += chunkHeightMm
                    }
                }

                pdf.save(filename)
                console.log(`PDF Export: Successfully generated ${filename}`)
            }

        } catch (error) {
            console.error('PDF export failed:', error)
            const errorMessage = error instanceof Error ? error.message : 'PDF export failed'
            exportError.value = errorMessage
            throw error
        } finally {
            isExporting.value = false
        }
    }

    /**
     * Helper function to render multi-page PDF from a single canvas
     */
    async function renderMultiPagePdf(
        pdf: jsPDF,
        canvas: HTMLCanvasElement,
        imgWidth: number,
        imgHeight: number,
        contentWidthMm: number,
        margin: number
    ): Promise<void> {
        const A4_HEIGHT_MM = 297
        const pxToMm = contentWidthMm / imgWidth
        const contentHeightMm = imgHeight * pxToMm
        const pageContentHeight = A4_HEIGHT_MM - margin * 2
        let remainingHeight = contentHeightMm
        let yOffset = 0
        let pageNum = 0

        while (remainingHeight > 0) {
            if (pageNum > 0) {
                pdf.addPage()
            }

            const sourceY = (yOffset / contentHeightMm) * imgHeight
            const sourceHeight = Math.min(
                (pageContentHeight / contentHeightMm) * imgHeight,
                imgHeight - sourceY
            )
            const destHeight = Math.min(pageContentHeight, remainingHeight)

            const pageCanvas = document.createElement('canvas')
            pageCanvas.width = imgWidth
            pageCanvas.height = Math.ceil(sourceHeight)
            const ctx = pageCanvas.getContext('2d')!
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
            ctx.drawImage(
                canvas,
                0, sourceY, imgWidth, sourceHeight,
                0, 0, imgWidth, sourceHeight
            )

            const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95)
            if (!isValidDataUrl(pageImgData)) {
                throw new Error(`Page ${pageNum + 1} rendering failed.`)
            }
            pdf.addImage(pageImgData, 'JPEG', margin, margin, contentWidthMm, destHeight)

            yOffset += pageContentHeight
            remainingHeight -= pageContentHeight
            pageNum++
        }
    }

    /**
     * Export current preview content to PDF
     * @param previewSelector - CSS selector for the preview container
     * @param tabName - Name of the current tab (used for filename)
     */
    async function exportPreviewToPdf(
        previewSelector: string = '.preview-content',
        tabName: string = 'document'
    ): Promise<void> {
        const previewElement = document.querySelector(previewSelector) as HTMLElement

        if (!previewElement) {
            exportError.value = 'Preview element not found'
            throw new Error('Preview element not found')
        }

        // Sanitize filename
        const sanitizedName = tabName
            .replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s-_]/g, '')
            .trim()
            .replace(/\s+/g, '_')

        const filename = `${sanitizedName || 'document'}.pdf`

        await exportToPdf(previewElement, { filename })
    }

    return {
        isExporting,
        exportError,
        exportToPdf,
        exportPreviewToPdf
    }
}
