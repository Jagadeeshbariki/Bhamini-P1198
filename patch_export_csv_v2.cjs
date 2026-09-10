const fs = require('fs');
let content = fs.readFileSync('components/ODKDashboardSection.tsx', 'utf8');

const oldExportCSV = `        const exportToCSV = () => {
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

const newExportCSV = `        const exportToCSV = () => {
        let csvRows = [];
        let filename = '';

        if (activeTab === 'frp-report') {
            if (!pivotData || pivotData.length === 0) {
                alert('No data to export for the selected filters.');
                return;
            }
            
            // Header row
            const headers = ['Form Name', ...frpColumns, 'Grand Total'];
            csvRows.push(headers.map(h => \`"\${String(h).replace(/"/g, '""')}"\`).join(','));
            
            // Data rows
            pivotData.forEach((row: any) => {
                const csvRow = [
                    \`"\${String(row.formName).replace(/"/g, '""')}"\`,
                    ...frpColumns.map((frp: any) => \`"\${row[frp] || 0}"\`),
                    \`"\${row.total}"\`
                ];
                csvRows.push(csvRow.join(','));
            });
            
            // Footer row
            const footerRow = [
                '"Grand Total"',
                ...frpColumns.map((frp: any) => \`"\${frpTotals[frp] || 0}"\`),
                \`"\${frpTotals.total}"\`
            ];
            csvRows.push(footerRow.join(','));
            filename = \`ODK_FRP_Report_\${new Date().toISOString().split('T')[0]}.csv\`;
        } else {
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
            filename = \`ODK_Filtered_Data_\${new Date().toISOString().split('T')[0]}.csv\`;
        }

        const csvString = csvRows.join('\\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };`;

content = content.replace(oldExportCSV, newExportCSV);
fs.writeFileSync('components/ODKDashboardSection.tsx', content);
