const fs = require('fs');
let path = 'components/ODKDashboardSection.tsx';
let content = fs.readFileSync(path, 'utf8');

const replacementStr = `    if (loading) {
            return (
        <div className="h-[calc(100vh-160px)] flex flex-col gap-3 overflow-hidden">`;

const fixedStr = `    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[300px]">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs animate-pulse">Loading ODK Data...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-red-500">
                <p className="font-bold">Error loading ODK data</p>
                <p className="text-sm">{error}</p>
            </div>
        );
    }

    const top10Users = topUsers.slice(0, 10);
    const totalSubmissions = aggregatedForms.reduce((acc: any, f: any) => acc + f.total, 0);

    return (
        <div className="h-[calc(100vh-160px)] flex flex-col gap-3 overflow-hidden">`;

content = content.replace(replacementStr, fixedStr);

fs.writeFileSync(path, content);
console.log("Fixed missing blocks");
