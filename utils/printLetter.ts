import { toJpeg, toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import JSZip from 'jszip';

// Helper to render an A4 DOM element into a crisp, compressed JPEG data URL (< 400KB per page)
async function captureOptimizedA4DataUrl(el: HTMLElement): Promise<string> {
    try {
        // PixelRatio 1.5 gives ~1191x1685 px resolution (crisp 150 DPI)
        // JPEG quality 0.82 with white background provides clear Telugu text while keeping file size ~250KB-450KB
        return await toJpeg(el, {
            quality: 0.82,
            pixelRatio: 1.5,
            backgroundColor: '#ffffff',
            cacheBust: true
        });
    } catch (err) {
        console.warn("JPEG capture fallback to PNG:", err);
        return await toPng(el, {
            quality: 0.80,
            pixelRatio: 1.5,
            backgroundColor: '#ffffff'
        });
    }
}

// Utility to directly download a single A4 Letterhead as an optimized PDF (guaranteed well under 2MB)
export async function downloadA4LetterPdf(elementId: string, filename: string = 'acknowledgement_letter.pdf'): Promise<boolean> {
    const el = document.getElementById(elementId);
    if (!el) {
        printA4Letter(elementId);
        return false;
    }
    try {
        const dataUrl = await captureOptimizedA4DataUrl(el);
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4',
            compress: true
        });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
        const safeName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
        pdf.save(safeName);
        return true;
    } catch (err) {
        console.warn("Direct PDF generation fallback to print:", err);
        printA4Letter(elementId);
        return false;
    }
}

// Utility to batch download multiple letters as a single combined multi-page A4 PDF (compact & fast)
export async function downloadCombinedA4LettersPdf(
    elementIds: string[],
    filename: string = 'combined_acknowledgements.pdf',
    onProgress?: (current: number, total: number) => void
): Promise<boolean> {
    if (!elementIds || elementIds.length === 0) return false;
    try {
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4',
            compress: true
        });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        let addedPages = 0;
        for (let i = 0; i < elementIds.length; i++) {
            const id = elementIds[i];
            const el = document.getElementById(id);
            if (!el) continue;

            const dataUrl = await captureOptimizedA4DataUrl(el);
            if (addedPages > 0) {
                pdf.addPage('a4', 'p');
            }
            pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
            addedPages++;
            if (onProgress) {
                onProgress(i + 1, elementIds.length);
            }
        }

        if (addedPages === 0) return false;
        const safeName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
        pdf.save(safeName);
        return true;
    } catch (err) {
        console.error("Failed to generate combined PDF:", err);
        return false;
    }
}

// Utility to batch download multiple letters as individual PDFs inside a ZIP archive (each max ~400KB)
export async function downloadZipA4LettersPdf(
    items: { id: string; filename: string }[],
    zipFilename: string = 'acknowledgement_letters.zip',
    onProgress?: (current: number, total: number) => void
): Promise<boolean> {
    if (!items || items.length === 0) return false;
    try {
        const zip = new JSZip();
        let addedCount = 0;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const el = document.getElementById(item.id);
            if (!el) continue;

            const dataUrl = await captureOptimizedA4DataUrl(el);
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4',
                compress: true
            });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
            const pdfBlob = pdf.output('blob');

            const safeFilename = item.filename.endsWith('.pdf') ? item.filename : `${item.filename}.pdf`;
            zip.file(safeFilename, pdfBlob);
            addedCount++;

            if (onProgress) {
                onProgress(i + 1, items.length);
            }
        }

        if (addedCount === 0) return false;

        const zipBlob = await zip.generateAsync({ 
            type: 'blob', 
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        const safeZipName = zipFilename.endsWith('.zip') ? zipFilename : `${zipFilename}.zip`;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = safeZipName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 5000);
        return true;
    } catch (err) {
        console.error("Failed to generate zip archive:", err);
        return false;
    }
}

// Utility to print multiple A4 Letterheads in one print job with page breaks
export function printMultipleA4Letters(elementIds: string[]) {
    if (!elementIds || elementIds.length === 0) return;

    const oldIframe = document.getElementById("letterhead-print-iframe");
    if (oldIframe) {
        oldIframe.remove();
    }

    const iframe = document.createElement("iframe");
    iframe.id = "letterhead-print-iframe";
    iframe.style.position = "fixed";
    iframe.style.top = "-9999px";
    iframe.style.left = "-9999px";
    iframe.style.width = "210mm";
    iframe.style.height = "297mm";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
        window.print();
        return;
    }

    const headStyles = Array.from(document.querySelectorAll("link[rel='stylesheet'], style"))
        .map(tag => tag.outerHTML)
        .join("\n");

    const sheetsHtml = elementIds.map(id => {
        const el = document.getElementById(id);
        if (!el) return '';
        return `
            <div class="a4-print-page" style="page-break-after: always; break-after: page; width: 210mm; min-height: 297mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; background: white; margin: 0 auto;">
                ${el.innerHTML}
            </div>
        `;
    }).join("\n");

    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8" />
            <title>Batch Official Telugu Acknowledgement Letters</title>
            ${headStyles}
            <style>
                @page {
                    size: A4 portrait;
                    margin: 0mm;
                }
                @media print {
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        width: 210mm !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .a4-print-page {
                        page-break-after: always !important;
                        break-after: page !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        min-height: 297mm !important;
                        max-height: 297mm !important;
                        overflow: hidden !important;
                        box-sizing: border-box !important;
                    }
                    .a4-print-page:last-child {
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                    }
                }
            </style>
        </head>
        <body>
            ${sheetsHtml}
        </body>
        </html>
    `);
    doc.close();

    setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
    }, 400);
}

// Utility to print the official A4 Letterhead with guaranteed CSS styles and images
export function printA4Letter(elementId: string) {
    const el = document.getElementById(elementId);
    if (!el) {
        window.print();
        return;
    }

    const oldIframe = document.getElementById("letterhead-print-iframe");
    if (oldIframe) {
        oldIframe.remove();
    }

    const iframe = document.createElement("iframe");
    iframe.id = "letterhead-print-iframe";
    iframe.style.position = "fixed";
    iframe.style.top = "-9999px";
    iframe.style.left = "-9999px";
    iframe.style.width = "210mm";
    iframe.style.height = "297mm";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
        window.print();
        return;
    }

    const headStyles = Array.from(document.querySelectorAll("link[rel='stylesheet'], style"))
        .map(tag => tag.outerHTML)
        .join("\n");

    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8" />
            <title>Official Telugu Acknowledgement Letterhead</title>
            ${headStyles}
            <style>
                @page {
                    size: A4 portrait;
                    margin: 0mm;
                }
                @media print {
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        width: 210mm !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .a4-print-page {
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        min-height: 297mm !important;
                        max-height: 297mm !important;
                        overflow: hidden !important;
                        box-sizing: border-box !important;
                    }
                }
            </style>
        </head>
        <body style="margin: 0; padding: 0; background: white;">
            <div class="a4-print-page" style="width: 210mm; min-height: 297mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; background: white; margin: 0 auto;">
                ${el.innerHTML}
            </div>
        </body>
        </html>
    `);
    doc.close();

    setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
    }, 350);
}
