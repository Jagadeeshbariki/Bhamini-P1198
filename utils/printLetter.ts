// Utility to print the official A4 Letterhead with guaranteed CSS styles and images
export function printA4Letter(elementId: string) {
    const el = document.getElementById(elementId);
    if (!el) {
        window.print();
        return;
    }

    // Remove any previous print iframe
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

    // Collect all stylesheets from main document
    const headStyles = Array.from(document.querySelectorAll("link[rel='stylesheet'], style"))
        .map(tag => tag.outerHTML)
        .join("\n");

    const html = `<!DOCTYPE html>
<html lang="te">
<head>
    <meta charset="utf-8" />
    <title>Acknowledgement Letter - Project Bhamini</title>
    ${headStyles}
    <style>
        @page {
            size: A4 portrait;
            margin: 0mm;
        }
        *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            width: 210mm !important;
            height: 297mm !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            color: #111827 !important;
            overflow: hidden !important;
        }
        .a4-print-sheet {
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            overflow: hidden !important;
            background: #ffffff !important;
            border: none !important;
            box-shadow: none !important;
        }
        .a4-print-sheet img {
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            display: block !important;
        }
        .a4-content-area {
            padding: 1.5mm 12mm 1mm 12mm !important;
            display: flex !important;
            flex-direction: column !important;
            flex: 1 !important;
            justify-content: space-between !important;
        }
        /* Grid 2-column fallback */
        .a4-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 1.5mm 4mm !important;
            background: #f9fafb !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 6px !important;
            padding: 2.5mm 3.5mm !important;
            font-size: 8.5pt !important;
            line-height: 1.3 !important;
        }
        /* Table fallback */
        table.a4-table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 1.5mm 0 !important;
            background: #ffffff !important;
        }
        table.a4-table th, table.a4-table td {
            border: 1px solid #9ca3af !important;
            padding: 1.8mm 2.5mm !important;
            font-size: 8.5pt !important;
            line-height: 1.25 !important;
        }
        table.a4-table th {
            background-color: #f3f4f6 !important;
            font-weight: 700 !important;
        }
        table.a4-table span.block {
            display: block !important;
        }
        /* Declarations box fallback */
        .a4-decl {
            background: #f9fafb !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 6px !important;
            padding: 2mm 3.5mm !important;
            font-size: 8pt !important;
            line-height: 1.3 !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 1.5mm !important;
        }
        .a4-decl-highlight {
            background: #eef2ff !important;
            border: 1px solid #c7d2fe !important;
            border-radius: 5px !important;
            padding: 1.5mm 2.5mm !important;
        }
        /* Signatures fallback */
        .a4-sig {
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-end !important;
            padding-top: 3mm !important;
            padding-bottom: 1mm !important;
            font-size: 8.5pt !important;
            font-weight: 700 !important;
        }
        .a4-sig-line {
            height: 8mm !important;
            width: 44mm !important;
            border-bottom: 1px dashed #6b7280 !important;
            margin-bottom: 1.5mm !important;
        }
    </style>
</head>
<body>
    ${el.outerHTML}
</body>
</html>`;

    doc.open();
    doc.write(html);
    doc.close();

    // Give iframe time to parse styles and images, then trigger print
    setTimeout(() => {
        try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
        } catch (e) {
            console.warn("Iframe print error:", e);
            window.print();
        }
    }, 350);
}
