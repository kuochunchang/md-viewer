import html2pdf from 'html2pdf.js'
import { ref } from 'vue'

export interface PdfExportOptions {
    filename?: string
    margin?: number | [number, number, number, number]
    pageSize?: 'a4' | 'letter' | 'legal'
    orientation?: 'portrait' | 'landscape'
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
            pageSize = 'a4',
            orientation = 'portrait'
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
            clonedElement.style.width = '100%'
            clonedElement.style.maxWidth = 'none'

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
            }

            // Generate and download PDF
            await html2pdf()
                .set(pdfOptions)
                .from(clonedElement)
                .save()

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
