import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfCell {
  text: string;
  x: number;
  width: number;
}

export interface PdfSourcePage {
  page: number;
  lines: PdfCell[][];
}

export const MAX_INDEXED_PDF_PAGES = 50;

function openPdf(bytes: Uint8Array<ArrayBuffer>) {
  return getDocument({
    data: bytes.slice(),
    isEvalSupported: false,
    enableXfa: false,
    useSystemFonts: true,
  });
}

export async function readPdfSource(bytes: Uint8Array<ArrayBuffer>): Promise<PdfSourcePage[]> {
  const loading = openPdf(bytes);
  try {
    const pdf = await loading.promise;
    const pages: PdfSourcePage[] = [];
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, MAX_INDEXED_PDF_PAGES); pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const text = await page.getTextContent();
      const items = text.items.flatMap((item) => {
        if (!('str' in item) || !item.str.trim()) return [];
        const [, , , , x, y] = item.transform;
        if (typeof x !== 'number' || typeof y !== 'number') return [];
        return [{ text: item.str.trim(), x, y, width: item.width }];
      }).sort((a, b) => b.y - a.y);
      const rows: Array<{ y: number; cells: PdfCell[] }> = [];
      for (const { y, ...cell } of items) {
        const line = rows[rows.length - 1];
        if (line && Math.abs(y - line.y) <= 2.5) line.cells.push(cell);
        else rows.push({ y, cells: [cell] });
      }
      pages.push({ page: pageNumber, lines: rows.map(({ cells }) => cells.sort((a, b) => a.x - b.x)) });
      page.cleanup();
    }
    return pages;
  } finally {
    await loading.destroy();
  }
}

export function openPdfPreview(bytes: Uint8Array<ArrayBuffer>) {
  return openPdf(bytes);
}
