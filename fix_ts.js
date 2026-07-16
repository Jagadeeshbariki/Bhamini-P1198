const fs = require('fs');

const path = 'components/ODKAssetDistribution.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/clusterStats = useMemo\(\(\) => \{/g, 'clusterStats: any[] = useMemo(() => {');
content = content.replace(/actStats = useMemo\(\(\) => \{/g, 'actStats: any[] = useMemo(() => {');
content = content.replace(/matStats = useMemo\(\(\) => \{/g, 'matStats: any[] = useMemo(() => {');

// Fix string indexing
content = content.replace(/\[c\.name\]/g, '[String(c.name)]');
content = content.replace(/\[a\.name\]/g, '[String(a.name)]');
content = content.replace(/\[m\.name\]/g, '[String(m.name)]');

// Fix other `map[k]` if k is unknown
content = content.replace(/map\[k\]/g, 'map[String(k)]');
content = content.replace(/map\[date\]/g, 'map[String(date)]');

fs.writeFileSync(path, content);
