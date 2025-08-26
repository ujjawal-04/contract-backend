declare module 'pdfkit' {
    interface PDFDocumentOptions {
        landscape?: boolean;
        size?: string | [number, number];
        margin?: number;
        margins?: {
            top?: number;
            bottom?: number;
            left?: number;
            right?: number;
        };
        info?: {
            Title?: string;
            Author?: string;
            Subject?: string;
            Creator?: string;
            Keywords?: string;
            CreationDate?: Date;
        };
        bufferPages?: boolean;
        autoFirstPage?: boolean;
        font?: string;
        layout?: 'portrait' | 'landscape';
    }
}