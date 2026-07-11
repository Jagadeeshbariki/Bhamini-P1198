const fs = require('fs');

let content = fs.readFileSync('components/ContributionPage.tsx', 'utf8');

// Add LabelList to imports
content = content.replace('  Legend,\n} from "recharts";', '  Legend,\n  LabelList,\n} from "recharts";');

// Remove the vs last period lines
content = content.replace(/<div className="text-xs font-bold text-\[#10B981\]">\+12\.4% <span className="text-gray-500 font-normal">vs last period<\/span><\/div>/g, '');
content = content.replace(/<div className="text-xs font-bold text-\[#8B5CF6\]">\+8\.7% <span className="text-gray-500 font-normal">vs last period<\/span><\/div>/g, '');
content = content.replace(/<div className="text-xs font-bold text-\[#10B981\]">\+3\.7% <span className="text-gray-500 font-normal">vs last period<\/span><\/div>/g, '');
content = content.replace(/<div className="text-xs font-bold text-\[#EF4444\]">-2\.1% <span className="text-gray-500 font-normal">vs last period<\/span><\/div>/g, '');

// Remove Avg Collection Size block
content = content.replace(/<div className="bg-\[#1e2333\] p-4 rounded-xl border border-gray-800 flex items-center gap-4">\s*<div className="p-2 bg-amber-500\/10 text-amber-400 rounded-lg">[\s\S]*?<p className="text-\[10px\] text-gray-400">Avg\. Collection Size<\/p>\s*<\/div>\s*<\/div>/g, '');

// Remove Active Staff block
content = content.replace(/<div className="bg-\[#1e2333\] p-4 rounded-xl border border-gray-800 flex items-center gap-4">\s*<div className="p-2 bg-cyan-500\/10 text-cyan-400 rounded-lg">[\s\S]*?<p className="text-\[10px\] text-gray-400">Active Staff<\/p>\s*<\/div>\s*<\/div>/g, '');

// Add LabelList to Cluster Target vs Achievement Bar
const clusterBarRegex = /<Bar dataKey="target" fill="#F59E0B" radius={\[4, 4, 0, 0\]} barSize=\{12\} \/>/;
content = content.replace(clusterBarRegex, `<Bar dataKey="target" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={12}><LabelList dataKey="target" position="top" fill="#9CA3AF" fontSize={10} formatter={(value) => \`₹\${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}\`} /></Bar>`);

const clusterBar2Regex = /<Bar dataKey="val" fill="#3B82F6" radius={\[4, 4, 0, 0\]} barSize=\{12\} \/>/;
content = content.replace(clusterBar2Regex, `<Bar dataKey="val" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={12}><LabelList dataKey="val" position="top" fill="#9CA3AF" fontSize={10} formatter={(value) => \`₹\${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}\`} /></Bar>`);


// Add LabelList to Activity Bar
const activityBarRegex = /<Bar dataKey="val" fill="#8B5CF6" radius={\[0, 4, 4, 0\]} barSize=\{12\} \/>/;
content = content.replace(activityBarRegex, `<Bar dataKey="val" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={12}><LabelList dataKey="val" position="right" fill="#9CA3AF" fontSize={10} formatter={(value) => \`₹\${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}\`} /></Bar>`);


fs.writeFileSync('components/ContributionPage.tsx', content);
console.log('Fixed stuff');
