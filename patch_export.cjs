const fs = require('fs');
let content = fs.readFileSync('components/ODKAssetDistribution.tsx', 'utf8');

const exportFunc = `    const exportToCSV = () => {
        if (!tableData || tableData.length === 0) {
            alert('No data to export.');
            return;
        }

        const headers = ['Cluster', 'Activity', 'Material Name', 'Material Code', 'Target', 'Distributed', 'Pending', 'Achieved %'];
        const csvRows = [];
        csvRows.push(headers.map(h => \`"\${h}"\`).join(','));

        tableData.forEach((row: any) => {
            const csvRow = [
                \`"\${row.cluster || ''}"\`,
                \`"\${row.activity || ''}"\`,
                \`"\${row.material || ''}"\`,
                \`"\${row.code || ''}"\`,
                \`"\${row.target || 0}"\`,
                \`"\${row.dist || 0}"\`,
                \`"\${row.pending || 0}"\`,
                \`"\${row.achv ? row.achv.toFixed(2) : 0}%"\`
            ];
            csvRows.push(csvRow.join(','));
        });

        const csvString = csvRows.join('\\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', \`ODK_Asset_Distribution_\${new Date().toISOString().split('T')[0]}.csv\`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const paginatedTable = tableData.slice((page - 1) * rowsPerPage, page * rowsPerPage);`;

content = content.replace(
    `    const paginatedTable = tableData.slice((page - 1) * rowsPerPage, page * rowsPerPage);`,
    exportFunc
);

content = content.replace(
    `<button className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-md text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors shrink-0">`,
    `<button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-md text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors shrink-0">`
);

fs.writeFileSync('components/ODKAssetDistribution.tsx', content);
