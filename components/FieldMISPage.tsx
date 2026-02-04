
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { MIS_TARGETS_URL, MIS_ACHIEVEMENTS_URL } from '../config';

interface ComponentDefinition {
    id: string;
    name: string;
    category: string;
    uom: string;
    outcome: string;
    csrGoal: string;
    target: number;
    achieved: number;
}

const FieldMISPage: React.FC = () => {
    const [components, setComponents] = useState<ComponentDefinition[]>([]);
    const [selectedId, setSelectedId] = useState<string>('');
    const [activeTab, setActiveTab] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const parseCSV = (csv: string) => {
        const lines = csv.trim().split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 1) return [];
        const parseLine = (line: string) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
                else current += char;
            }
            result.push(current.trim().replace(/^"|"$/g, ''));
            return result;
        };
        const headers = parseLine(lines[0]).map(h => h.toUpperCase().replace(/\s+/g, ''));
        return lines.slice(1).map(line => {
            const vals = parseLine(line);
            const obj: any = {};
            headers.forEach((h, i) => { if (h) obj[h] = vals[i] || ''; });
            return obj;
        });
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [targetsRes, achievementsRes] = await Promise.all([
                fetch(`${MIS_TARGETS_URL}&t=${Date.now()}`),
                fetch(`${MIS_ACHIEVEMENTS_URL}&t=${Date.now()}`)
            ]);

            if (!targetsRes.ok || !achievementsRes.ok) throw new Error("Could not sync MIS data");

            const targetsCsv = await targetsRes.text();
            const achievementsCsv = await achievementsRes.text();

            const targetsRaw = parseCSV(targetsCsv);
            const achievementsRaw = parseCSV(achievementsCsv);

            // Calculate Achievements Sum by ID
            const achievementMap = new Map<string, number>();
            achievementsRaw.forEach(row => {
                const id = row['ID'];
                const value = parseFloat(row['VALUE']) || 0;
                if (id) {
                    achievementMap.set(id, (achievementMap.get(id) || 0) + value);
                }
            });

            // Map to ComponentDefinition
            const mapped: ComponentDefinition[] = targetsRaw.map(row => ({
                id: row['ID'] || '',
                name: row['NAME'] || 'Unknown Component',
                category: row['CATEGORY'] || 'General',
                uom: row['UOM'] || 'Units',
                outcome: row['OUTCOME'] || 'N/A',
                csrGoal: row['CSRGOAL'] || row['CSR_GOAL'] || 'N/A',
                target: parseFloat(row['TARGET']) || 0,
                achieved: achievementMap.get(row['ID']) || 0
            })).filter(c => c.id);

            setComponents(mapped);
            if (mapped.length > 0 && !selectedId) {
                setSelectedId(mapped[0].id);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const activeComp = useMemo(() => 
        components.find(c => c.id === selectedId) || components[0]
    , [components, selectedId]);

    const progressPercent = useMemo(() => {
        if (!activeComp || activeComp.target === 0) return 0;
        const calc = (activeComp.achieved / activeComp.target) * 100;
        return Math.min(calc, 100);
    }, [activeComp]);

    const tabs = [
        { id: 0, label: 'Overview', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
        { id: 1, label: 'Asset Management', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
        { id: 2, label: 'Distribution', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
        { id: 3, label: 'Beneficiaries', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
        { id: 4, label: 'Evidence', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' }
    ];

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-[10px]">Processing Master Registry...</p>
        </div>
    );

    if (error) return (
        <div className="p-10 text-center bg-red-50 dark:bg-red-900/10 rounded-[2rem] border border-red-200">
            <p className="text-red-500 font-bold mb-4">Sync Error: {error}</p>
            <button onClick={fetchData} className="px-6 py-2 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase">Retry Sync</button>
        </div>
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
            {/* Header with Selection */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="space-y-1">
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Target vs Achievements</h1>
                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em]">
                        {activeComp?.id || '---'} - {activeComp?.category || 'General'} Master
                    </p>
                </div>
                <div className="w-full md:w-80">
                    <select 
                        value={selectedId}
                        onChange={(e) => setSelectedId(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-900 p-3 rounded-2xl border-none ring-1 ring-gray-200 dark:ring-gray-700 font-black text-xs uppercase shadow-sm focus:ring-2 focus:ring-indigo-600 transition-all"
                    >
                        {components.map(c => <option key={c.id} value={c.id}>{c.id} - {c.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Component Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-indigo-600 text-white p-5 rounded-3xl shadow-lg">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-70">UoM</p>
                    <p className="text-xl font-black">{activeComp?.uom || '---'}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">CSR Link</p>
                    <p className="text-xl font-black text-gray-800 dark:text-white">{activeComp?.csrGoal || '---'}</p>
                </div>
                <div className="bg-emerald-500 text-white p-5 rounded-3xl shadow-lg">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-70">Achievement</p>
                    <p className="text-xl font-black">{progressPercent.toFixed(1)}%</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Indicator</p>
                    <p className="text-xs font-bold text-gray-800 dark:text-white mt-1 leading-tight line-clamp-2">{activeComp?.outcome || '---'}</p>
                </div>
            </div>

            {/* 5-Tab Navigation */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="flex border-b border-gray-100 dark:border-gray-700 overflow-x-auto no-scrollbar">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-5 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 ${
                                activeTab === tab.id 
                                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' 
                                : 'border-transparent text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={tab.icon}/></svg>
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-8 min-h-[400px]">
                    {activeTab === 0 && activeComp && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-6">
                                    <h3 className="text-lg font-black uppercase tracking-tight text-gray-800 dark:text-white">Project Progress Summary</h3>
                                    <div className="relative pt-1">
                                        <div className="flex mb-2 items-center justify-between">
                                            <div>
                                                <span className="text-xs font-black inline-block py-1 px-2 uppercase rounded-full text-indigo-600 bg-indigo-200">
                                                    Overall Achievement
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs font-black inline-block text-indigo-600">
                                                    {progressPercent.toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="overflow-hidden h-4 mb-4 text-xs flex rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                                            <div style={{ width: `${progressPercent}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-600 transition-all duration-1000"></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mt-8">
                                            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-700">
                                                <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Total Target</p>
                                                <p className="text-3xl font-black text-gray-900 dark:text-white">{activeComp.target} <span className="text-xs text-gray-400">{activeComp.uom}</span></p>
                                            </div>
                                            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-700">
                                                <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Achieved</p>
                                                <p className="text-3xl font-black text-emerald-600">{activeComp.achieved} <span className="text-xs text-gray-400">{activeComp.uom}</span></p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-900 text-white p-8 rounded-[2rem] shadow-xl">
                                    <h4 className="text-sm font-black uppercase tracking-widest text-indigo-400 mb-4">Outcome Pulse</h4>
                                    <p className="text-lg font-bold leading-tight mb-6">"{activeComp.outcome} reached for {activeComp.achieved} {activeComp.uom} across project GPs."</p>
                                    <div className="space-y-4">
                                        {['Palavalasa', 'Bhamini', 'Battili', 'Neradi'].map((loc, i) => (
                                            <div key={i} className="flex justify-between items-center text-[10px] font-black uppercase border-b border-white/10 pb-2">
                                                <span>{loc} GP</span>
                                                <span className="text-emerald-400">Syncing...</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ... other tabs remain the same with dynamic ID usage ... */}
                    {(activeTab !== 0) && (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900/50 rounded-3xl flex items-center justify-center text-gray-300 mb-4">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            </div>
                            <h4 className="text-sm font-black uppercase text-gray-400 tracking-widest">Section Updating</h4>
                            <p className="text-xs text-gray-400 mt-1">Live data feed for {activeComp?.id} is being synchronized.</p>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>
        </div>
    );
};

export default FieldMISPage;
