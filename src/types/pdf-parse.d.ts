// pdf-parse v1 (pdfjs 1.10) ships without type declarations. Only the
// text-extraction entry point is used, so declare exactly that.
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    text: string;
    numpages?: number;
    info?: Record<string, unknown>;
  }
  function pdfParse(data: Buffer): Promise<PdfParseResult>;
  export = pdfParse;
}
