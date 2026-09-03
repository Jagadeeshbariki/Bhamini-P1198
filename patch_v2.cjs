const fs = require('fs');
let content = fs.readFileSync('components/ODKDashboardSection.tsx', 'utf8');

// 1. Update Internal Members to include "vinod kumar" (with space)
content = content.replace(
    "const INTERNAL_MEMBERS = ['minna rao', 'govindu rao', 'vinodkumar', 'sugreevulu', 'lokesh', 'meenaka_ganapathi', 'meenak_ganapthi', 'adinarayana', 'santhi'];",
    "const INTERNAL_MEMBERS = ['minna rao', 'govindu rao', 'vinodkumar', 'vinod kumar', 'sugreevulu', 'lokesh', 'meenaka_ganapathi', 'meenak_ganapthi', 'adinarayana', 'santhi'];"
);

// 2. Change empty dashes to 0
content = content.replace(
    `<span className="text-gray-300 text-xs">-</span>`,
    `<span className="text-gray-400 font-bold text-[10px]">0</span>`
);

// 3. Update exportAsImage to copy to clipboard instead of download
const oldExportImage = `    const exportAsImage = async () => {
        if (!pivotRef.current) return;
        try {
            setIsExporting(true);
            const canvas = await toCanvas(pivotRef.current, { backgroundColor: '#ffffff', pixelRatio: 2, skipFonts: false });
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = \`FRP_Report_\${new Date().toISOString().split('T')[0]}.png\`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Error exporting image:', err);
        } finally {
            setIsExporting(false);
        }
    };`;

const newExportImage = `    const exportAsImage = async () => {
        if (!pivotRef.current) return;
        try {
            setIsExporting(true);
            const canvas = await toCanvas(pivotRef.current, { backgroundColor: '#ffffff', pixelRatio: 2, skipFonts: false });
            canvas.toBlob((blob) => {
                if (blob) {
                    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                        .then(() => alert('Image copied to clipboard successfully!'))
                        .catch((err) => {
                            console.error('Failed to copy to clipboard:', err);
                            alert('Failed to copy image. Your browser might not support this feature or requires a secure context (HTTPS).');
                        });
                }
            });
        } catch (err) {
            console.error('Error exporting image:', err);
        } finally {
            setIsExporting(false);
        }
    };`;

content = content.replace(oldExportImage, newExportImage);

fs.writeFileSync('components/ODKDashboardSection.tsx', content);
