declare module 'html2pdf.js' {
    interface Html2PdfOptions {
        margin?: number | [number, number, number, number]
        filename?: string
        image?: {
            type?: string
            quality?: number
        }
        html2canvas?: {
            scale?: number
            useCORS?: boolean
            logging?: boolean
            backgroundColor?: string
            [key: string]: unknown
        }
        jsPDF?: {
            unit?: string
            format?: string
            orientation?: string
            [key: string]: unknown
        }
        pagebreak?: {
            mode?: string | string[]
            before?: string | string[]
            after?: string | string[]
            avoid?: string | string[]
        }
        [key: string]: unknown
    }

    interface Html2PdfWorker {
        set(options: Html2PdfOptions): Html2PdfWorker
        from(element: HTMLElement | string): Html2PdfWorker
        save(): Promise<void>
        output(type: string, options?: unknown): Promise<unknown>
        then(callback: (pdf: unknown) => void): Html2PdfWorker
    }

    function html2pdf(): Html2PdfWorker
    function html2pdf(element: HTMLElement | string, options?: Html2PdfOptions): Promise<void>

    export = html2pdf
}
