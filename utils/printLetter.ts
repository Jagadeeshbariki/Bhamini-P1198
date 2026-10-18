
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
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
        window.print();
        return;
    }

    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Acknowledgement Letter</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 0mm;
        }
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            width: 210mm !important;
            height: 297mm !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #111827;
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
        }
        .a4-content-area {
            padding: 2mm 14mm 1mm 14mm !important;
            display: flex !important;
            flex-direction: column !important;
            flex: 1 !important;
            justify-content: space-between !important;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            border: 1px solid #9ca3af;
            padding: 2.5px 8px;
            font-size: 8.5pt;
        }
        th {
            background-color: #f3f4f6;
            font-weight: bold;
        }
    </style>
</head>
<body>
    ${el.outerHTML}
</body>
</html>`);
    doc.close();

    setTimeout(() => {
        try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
        } catch (e) {
            console.warn("Iframe print failed, falling back to window.print():", e);
            window.print();
        }
    }, 300);
}
