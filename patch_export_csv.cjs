const fs = require('fs');
let content = fs.readFileSync('components/ODKDashboardSection.tsx', 'utf8');

const exportCSVFunction = `    const exportToCSV = () => {
        if (!filteredSubmissions || filteredSubmissions.length === 0) {
            alert('No data to export for the selected filters.');
            return;
        }

        // Get all unique keys from all submissions to use as headers
        const headersSet = new Set<string>();
        filteredSubmissions.forEach((sub: any) => {
            Object.keys(sub).forEach(key => headersSet.add(key));
        });
        const headers = Array.from(headersSet);

        // Build CSV content
        const csvRows = [];
        csvRows.push(headers.join(',')); // Header row

        filteredSubmissions.forEach((sub: any) => {
            const row = headers.map(header => {
                let val = sub[header];
                if (val === null || val === undefined) val = '';
                // Escape quotes and wrap in quotes to handle commas in values
                const strVal = String(val).replace(/"/g, '""');
                return \`"\${strVal}"\`;
            });
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', \`ODK_Filtered_Data_\${new Date().toISOString().split('T')[0]}.csv\`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };`;

content = content.replace(
    "const exportAsImage = async () => {",
    exportCSVFunction + "\n\n    const exportAsImage = async () => {"
);

fs.writeFileSync('components/ODKDashboardSection.tsx', content);
