const fs = require('fs');
let content = fs.readFileSync('components/BeneficiaryExplorer.tsx', 'utf8');

const regex = /<div className="bg-emerald-600 p-3 rounded-2xl text-white shadow-xl shadow-emerald-100 dark:shadow-none flex flex-col justify-between relative overflow-hidden group min-h-\[120px\]">.*?<span className="text-\[6px\] font-black uppercase opacity-60">Financial<\/span>\s*<\/div>\s*<\/div>/s;

content = content.replace(regex, '');

// Update clusterTarget achievement chart to not use money formatting
// Search for "tickFormatter={(value) => `₹${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}"
content = content.replace(
    /tickFormatter=\{\(value\) => `₹\$\{value >= 1000 \? \(value \/ 1000\)\.toFixed\(0\) \+ 'k' : value\}`\}/g,
    `tickFormatter={(value) => value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`
);

// We need to change the Tooltip to not use MoneyTooltip for clusterData.
// Search for "<Tooltip content={<MoneyTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />" inside the Cluster Target vs Achievement chart.
// Let's just use regular Tooltip content={<CustomTooltip />} 
content = content.replace(
    /<h3 className="text-\[8px\] font-black uppercase text-gray-400 tracking-widest">Cluster Target vs Achievement<\/h3>(.*?)<Tooltip content=\{<MoneyTooltip \/>\}/s,
    `<h3 className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Cluster Target vs Achievement</h3>$1<Tooltip content={<CustomTooltip />}`
);

fs.writeFileSync('components/BeneficiaryExplorer.tsx', content);
