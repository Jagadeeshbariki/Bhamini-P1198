const fs = require('fs');
let path = 'components/ODKDashboardSection.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace the main return with a flex layout
const oldReturn = `    return (
        <div className="space-y-6">`;
const newReturn = `    return (
        <div className="h-[calc(100vh-140px)] flex flex-col gap-4 overflow-hidden">`;
content = content.replace(oldReturn, newReturn);

// Update Filters container: make it compact
const oldFilters = `<div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">`;
const newFilters = `<div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-3 items-center shrink-0">`;
content = content.replace(oldFilters, newFilters);

// Update filter labels and selects to be more compact
content = content.replace(/p-2\.5/g, 'p-1.5 text-xs');
content = content.replace(/text-\[10px\] font-black uppercase tracking-widest/g, 'text-[9px] font-bold uppercase tracking-wider');

// Update Top Cards container
const oldCards = `<div className="grid grid-cols-1 md:grid-cols-3 gap-4">`;
const newCards = `<div className="grid grid-cols-3 gap-4 shrink-0">`;
content = content.replace(oldCards, newCards);

// Compact cards styling
content = content.replace(/p-5 rounded-2xl/g, 'p-3 rounded-xl');
content = content.replace(/text-2xl/g, 'text-xl');
content = content.replace(/w-12 h-12/g, 'w-8 h-8');
content = content.replace(/w-6 h-6/g, 'w-4 h-4');
content = content.replace(/mb-1/g, 'mb-0.5');

// Update Grid for Charts and Table
const oldGrid = `<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">`;
const newGrid = `<div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
                <div className="flex-1 flex gap-4 min-h-0">`;
content = content.replace(oldGrid, newGrid);

// Update Charts containers
content = content.replace(/min-h-\[350px\]/g, 'flex-1 min-h-0');
content = content.replace(/h-\[250px\]/g, 'h-full');
content = content.replace(/mb-6/g, 'mb-2');

// We need to carefully wrap the charts and table in the new layout.
// Let's use a simpler node script to just replace the whole JSX.
fs.writeFileSync('temp.cjs', '');
