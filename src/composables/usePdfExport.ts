import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { ref } from 'vue'

export interface PdfExportOptions {
    filename?: string
    margin?: number
    /** If true, generate a single continuous page without page breaks (default: true) */
    singlePage?: boolean
}

export function usePdfExport() {
    const isExporting = ref(false)
    const exportError = ref<string | null>(null)

    /**
     * Generate PDF from HTML element
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
            // Clone the element to avoid modifying the original
            const clonedElement = element.cloneNode(true) as HTMLElement

            // Apply print-friendly styles to the clone
            clonedElement.style.backgroundColor = '#ffffff'
            clonedElement.style.color = '#000000'
            clonedElement.style.padding = '20px'
            clonedElement.style.width = '900px'  // Fixed width for consistent rendering
            clonedElement.style.maxWidth = 'none'
            clonedElement.style.position = 'absolute'
            clonedElement.style.left = '-9999px'
            clonedElement.style.top = '0'

            // Fix SVG rendering issues in Mermaid diagrams
            const svgs = clonedElement.querySelectorAll('svg')
            svgs.forEach((svg) => {
                // Ensure SVG has explicit dimensions
                if (!svg.getAttribute('width')) {
                    svg.setAttribute('width', '100%')
                }
                // Add white background to SVG diagrams
                svg.style.backgroundColor = '#ffffff'
            })

<<<<<<< Updated upstream
            // Fix table borders for PDF export
            const tableContainers = clonedElement.querySelectorAll('.table-container')
            tableContainers.forEach((container) => {
                (container as HTMLElement).style.border = 'none'
            })

            const tables = clonedElement.querySelectorAll('table')
            tables.forEach((table) => {
                table.style.borderCollapse = 'collapse'
                table.style.width = '100%'
                table.style.marginBottom = '20px'
                table.style.border = '0.5px solid rgba(0, 0, 0, 0.08)'

                const ths = table.querySelectorAll('th')
                ths.forEach((th) => {
                    th.style.border = '0.5px solid rgba(0, 0, 0, 0.08)'
                    th.style.padding = '8px 12px'
                    th.style.backgroundColor = 'rgba(0, 0, 0, 0.02)'
                    th.style.fontWeight = '600'
                })

                const tds = table.querySelectorAll('td')
                tds.forEach((td) => {
                    td.style.border = '0.5px solid rgba(0, 0, 0, 0.08)'
                    td.style.padding = '8px 12px'
                })
            })

            // Configure html2pdf options
            const pdfOptions = {
                margin,
                filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 3,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                },
                jsPDF: {
                    unit: 'mm',
                    format: pageSize,
                    orientation
                },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
=======
            // Append to document for rendering
            document.body.appendChild(clonedElement)

            // Wait for images and SVG to render
            await new Promise(resolve => setTimeout(resolve, 200))

            // Capture the element as canvas
            const canvas = await html2canvas(clonedElement, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                allowTaint: true
            })

            // Remove the cloned element
            document.body.removeChild(clonedElement)

            // Get canvas dimensions
            const imgWidth = canvas.width
            const imgHeight = canvas.height

            // Wide page format (280mm width, wider than A4)
            const PAGE_WIDTH_MM = 280
            const contentWidthMm = PAGE_WIDTH_MM - margin * 2

            // Calculate PDF dimensions
            const pxToMm = contentWidthMm / imgWidth
            const contentHeightMm = imgHeight * pxToMm
            const pageHeightMm = contentHeightMm + margin * 2

            // Create PDF
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: singlePage ? [PAGE_WIDTH_MM, pageHeightMm] : 'a4'
            })

            // Convert canvas to image data
            const imgData = canvas.toDataURL('image/jpeg', 0.95)

            if (singlePage) {
                // Single page mode: add entire image to one page
                pdf.addImage(imgData, 'JPEG', margin, margin, contentWidthMm, contentHeightMm)
            } else {
                // Multi-page mode: split across A4 pages
                const A4_HEIGHT_MM = 297
                const pageContentHeight = A4_HEIGHT_MM - margin * 2
                let remainingHeight = contentHeightMm
                let yOffset = 0
                let pageNum = 0

                while (remainingHeight > 0) {
                    if (pageNum > 0) {
                        pdf.addPage()
                    }

                    // Calculate source region from canvas
                    const sourceY = (yOffset / contentHeightMm) * imgHeight
                    const sourceHeight = Math.min(
                        (pageContentHeight / contentHeightMm) * imgHeight,
                        imgHeight - sourceY
                    )
                    const destHeight = Math.min(pageContentHeight, remainingHeight)

                    // Create a temporary canvas for this page section
                    const pageCanvas = document.createElement('canvas')
                    pageCanvas.width = imgWidth
                    pageCanvas.height = sourceHeight
                    const ctx = pageCanvas.getContext('2d')!
                    ctx.fillStyle = '#ffffff'
                    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
                    ctx.drawImage(
                        canvas,
                        0, sourceY, imgWidth, sourceHeight,
                        0, 0, imgWidth, sourceHeight
                    )

                    const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95)
                    pdf.addImage(pageImgData, 'JPEG', margin, margin, contentWidthMm, destHeight)

                    yOffset += pageContentHeight
                    remainingHeight -= pageContentHeight
                    pageNum++
                }
>>>>>>> Stashed changes
            }

            // Save the PDF
            pdf.save(filename)

        } catch (error) {
            console.error('PDF export failed:', error)
            exportError.value = error instanceof Error ? error.message : 'PDF export failed'
            throw error
        } finally {
            isExporting.value = false
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
