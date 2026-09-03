const fs = require('fs');
let content = fs.readFileSync('components/ODKAssetDistribution.tsx', 'utf8');

content = content.replace(
    "const [filterMaterial, setFilterMaterial] = useState('All');",
    "const [filterMaterial, setFilterMaterial] = useState<string[]>([]);"
);

content = content.replace(
    "return ['All', ...Array.from(new Set([...t.map(x => x.Asset_Name), ...d.map(x => x.Asset_Name)].filter(Boolean))).sort()];",
    "return Array.from(new Set([...t.map(x => x.Asset_Name), ...d.map(x => x.Asset_Name)].filter(Boolean))).sort();"
);

content = content.replace(
    "if (filterMaterial !== 'All' && !matOptions.includes(filterMaterial)) {\n            setFilterMaterial('All');\n        }",
    "if (filterMaterial.length > 0) {\n            const valid = filterMaterial.filter(m => matOptions.includes(m));\n            if (valid.length !== filterMaterial.length) {\n                setFilterMaterial(valid);\n            }\n        }"
);

content = content.replace(
    "if (filterMaterial !== 'All' && t.Asset_Name !== filterMaterial) return false;",
    "if (filterMaterial.length > 0 && !filterMaterial.includes(t.Asset_Name)) return false;"
);

content = content.replace(
    "if (filterMaterial !== 'All' && d.Asset_Name !== filterMaterial) return false;",
    "if (filterMaterial.length > 0 && !filterMaterial.includes(d.Asset_Name)) return false;"
);

content = content.replace(
    "<select className=\"w-full bg-gray-50 border border-gray-200 text-gray-700 rounded-md p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none\" value={filterMaterial} onChange={e => setFilterMaterial(e.target.value)}>\n                                {matOptions.map(o => <option key={o} value={o}>{o}</option>)}\n                            </select>",
    `<select multiple className="w-full h-32 bg-gray-50 border border-gray-200 text-gray-700 rounded-md p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none custom-scrollbar" value={filterMaterial} onChange={e => setFilterMaterial(Array.from(e.target.selectedOptions, option => option.value))}>\n                                {matOptions.map(o => <option key={o} value={o}>{o}</option>)}\n                            </select>\n                            <p className="text-[9px] text-gray-400 mt-1">Hold Ctrl/Cmd to select multiple</p>`
);

content = content.replace(
    "onClick={() => { setFilterFY('All'); setFilterCluster('All'); setFilterActivity('All'); setFilterMaterial('All'); }}",
    "onClick={() => { setFilterFY('All'); setFilterCluster('Globally'); setFilterActivity('All'); setFilterMaterial([]); }}"
);

fs.writeFileSync('components/ODKAssetDistribution.tsx', content);
console.log('Update multi select done');
