const fs = require('fs');

let content = fs.readFileSync('components/ContributionPage.tsx', 'utf8');

// Find the return of useMemo for stats
const returnIndex = content.indexOf('return {\n      totalAmount,');
if (returnIndex === -1) {
    console.error('Could not find stats return');
    process.exit(1);
}

const newStatsCalculations = `    // Top Contributors
    const topContributorsMap = new Map<string, { name: string, cluster: string, amount: number, count: number }>();
    filteredData.forEach(d => {
        if (!topContributorsMap.has(d.farmerId)) {
            topContributorsMap.set(d.farmerId, { name: d.name, cluster: d.cluster, amount: 0, count: 0 });
        }
        const entry = topContributorsMap.get(d.farmerId)!;
        entry.amount += d.amount;
        entry.count += 1;
    });
    const topContributors = Array.from(topContributorsMap.values())
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

    // Monthly Trend
    const monthlyMap = new Map<string, { year: number, monthNum: number, label: string, val: number }>();
    filteredData.forEach(d => {
        if (d.date && d.date !== 'N/A') {
            const parsedDate = new Date(d.date);
            if (!isNaN(parsedDate.getTime())) {
                const year = parsedDate.getFullYear();
                const monthNum = parsedDate.getMonth();
                const label = parsedDate.toLocaleString('default', { month: 'short' }) + ' ' + year;
                const sortKey = \`\${year}-\${monthNum.toString().padStart(2, '0')}\`;
                
                if (!monthlyMap.has(sortKey)) {
                    monthlyMap.set(sortKey, { year, monthNum, label, val: 0 });
                }
                monthlyMap.get(sortKey)!.val += d.amount;
            }
        }
    });
    
    let cumulative = 0;
    const monthlyTrend = Array.from(monthlyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(e => {
            cumulative += e[1].val;
            return {
                month: e[1].label,
                val: cumulative,
                target: totalTarget // use the computed totalTarget
            };
        });

    return {
      totalAmount,
      totalTarget,
      count: filteredData.length,
      uniqueFIDs,
      clusterShare,
      activityShare,
      topContributors,
      monthlyTrend,
    };
  }, [filteredData, targets, selectedCluster, selectedActivity, selectedFinancialYear]);
`;

const afterReturnEnd = content.indexOf('  }, [filteredData, targets, selectedCluster, selectedActivity, selectedFinancialYear]);') + 86;

content = content.slice(0, returnIndex) + newStatsCalculations + content.slice(afterReturnEnd);

// Now update the UI to use these stats.
// First, Monthly Trend:
const trendDataIndex = content.indexOf('<LineChart data={[');
const trendDataEnd = content.indexOf(']} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>') + 2;

if (trendDataIndex !== -1 && trendDataEnd !== -1) {
    content = content.slice(0, trendDataIndex) + '<LineChart data={stats.monthlyTrend}' + content.slice(trendDataEnd);
} else {
    console.error('Could not find trend chart data');
}

// Next, Top Contributors:
const topContrDataIndex = content.indexOf('{[\\n                  { name: "Ramesh Babu"');
const topContrDataEnd = content.indexOf('].map((c, i) => (\\n                  <tr key={i}');

if (topContrDataIndex === -1) {
    // maybe it is single line or slightly different formatting
    const match = content.match(/{\[\s*{ name: "Ramesh Babu"[^\]]*\]\.map\(\(c, i\) => \(/);
    if (match) {
        content = content.replace(match[0], '{stats.topContributors.map((c, i) => (');
    } else {
        console.error('Could not find top contributors mock data');
    }
}

fs.writeFileSync('components/ContributionPage.tsx', content);
console.log('Update applied');
