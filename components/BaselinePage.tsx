
import React, { useState, useEffect, useMemo } from 'react';
import { BASELINE_DATA_URL } from '../config';

interface HouseholdData {
    farmerId: string;
    submissionDate: string;
    district: string;
    block: string;
    cluster: string;
    gp: string;
    village: string;
    hhHeadName: string;
    spouseName: string;
    age: string;
    gender: string;
    category: string;
    tribeName: string;
    phoneNumber: string;
}

const BaselinePage: React.FC = () => {
    const [allData, setAllData] = useState<HouseholdData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedBeneficiary, setSelectedBeneficiary] = useState<HouseholdData | null>(null);

    // Filters
    const [selectedCluster, setSelectedCluster] = useState('All');
    const [selectedGP, setSelectedGP] = useState('All');
    const [selectedVillage, setSelectedVillage] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    const parseCSV = (csv: string): HouseholdData[] => {
        const lines = csv.trim().split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 1) return [];
        
        const parseLine = (line: string): string[] => {
            const values = [];
            let inQuote = false, val = '';
            for (let j = 0; j < line.length; j++) {
                if (line[j] === '"') inQuote = !inQuote;
                else if (line[j] === ',' && !inQuote) { values.push(val.trim()); val = ''; }
                else val += line[j];
            }
            values.push(val.trim().replace(/^"|"$/g, ''));
            return values;
        };

        const rawHeaders = parseLine(lines[0]);
        const headersMap: Record<string, string> = {
            'FARMERID': 'farmerId',
            'SUBMISSIONDATE': 'submissionDate',
            'DISTRICT': 'district',
            'BLOCK': 'block',
            'CLUSTER': 'cluster',
            'GP': 'gp',
            'VILLAGE': 'village',
            'HHHEADNAME': 'hhHeadName',
            'FATHER/HUSBANDNAME': 'spouseName',
            'AGE': 'age',
            'GENDER': 'gender',
            'CATEGORY': 'category',
            'TRIBE_NAME': 'tribeName',
            'PHONENUMBER': 'phoneNumber'
        };

        const cleanHeaders = rawHeaders.map(h => h.toUpperCase().replace(/\s+/g, ''));

        return lines.slice(1).map(line => {
            const vals = parseLine(line);
            const row: any = {};
            cleanHeaders.forEach((h, i) => {
                const key = headersMap[h];
                if (key) row[key] = vals[i] || '';
            });
            return row as HouseholdData;
        });
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await fetch(`${BASELINE_DATA_URL}&cb=${Date.now()}`);
                if (!response.ok) throw new Error("Failed to fetch baseline spreadsheet.");
                const csvText = await response.text();
                const parsed = parseCSV(csvText);
                setAllData(parsed);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const clusters = useMemo(() => ['All', ...Array.from(new Set(allData.map(d => d.cluster).filter(Boolean))).sort()], [allData]);
    
    const gps = useMemo(() => {
        const filtered = selectedCluster === 'All' ? allData : allData.filter(d => d.cluster === selectedCluster);
        return ['All', ...Array.from(new Set(filtered.map(d => d.gp).filter(Boolean))).sort()];
    }, [allData, selectedCluster]);

    const villages = useMemo(() => {
        const filtered = selectedGP === 'All' 
            ? (selectedCluster === 'All' ? allData : allData.filter(d => d.cluster === selectedCluster))
            : allData.filter(d => d.gp === selectedGP);
        return ['All', ...Array.from(new Set(filtered.map(d => d.village).filter(Boolean))).sort()];
    }, [allData, selectedCluster, selectedGP]);

    const filteredData = useMemo(() => {
        return allData.filter(d => {
            const matchesCluster = selectedCluster === 'All' || d.cluster === selectedCluster;
            const matchesGP = selectedGP === 'All' || d.gp === selectedGP;
            const matchesVillage = selectedVillage === 'All' || d.village === selectedVillage;
            const matchesSearch = !searchQuery || 
                (d.hhHeadName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                (d.farmerId || '').toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCluster && matchesGP && matchesVillage && matchesSearch;
        });
    }, [allData, selectedCluster, selectedGP, selectedVillage, searchQuery]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">Loading Household Registry...</p>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in max-w-full pb-10">
            {/* Control Panel */}
            <div className="bg-white dark:bg-gray-800 p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Baseline Explorer</h1>
                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em] mt-1">Household Registry</p>
                    </div>
                    <div className="w-full md:w-80 relative group">
                        <input 
                            type="text" 
                            placeholder="Search Name or Farmer ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-2xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-bold focus:ring-2 focus:ring-indigo-600 shadow-inner text-sm transition-all"
                        />
                        <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-gray-400 px-1 tracking-widest">Cluster</label>
                        <select 
                            value={selectedCluster} 
                            onChange={(e) => { setSelectedCluster(e.target.value); setSelectedGP('All'); setSelectedVillage('All'); }}
                            className="w-full bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-bold text-xs appearance-none"
                        >
                            {clusters.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-gray-400 px-1 tracking-widest">Gram Panchayat</label>
                        <select 
                            value={selectedGP} 
                            onChange={(e) => { setSelectedGP(e.target.value); setSelectedVillage('All'); }}
                            className="w-full bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-bold text-xs appearance-none"
                        >
                            {gps.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-gray-400 px-1 tracking-widest">Village</label>
                        <select 
                            value={selectedVillage} 
                            onChange={(e) => setSelectedVillage(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-bold text-xs appearance-none"
                        >
                            {villages.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Content View: Desktop Table / Mobile Cards */}
            <div className="space-y-4">
                {/* Desktop Hidden Table */}
                <div className="hidden md:block bg-white dark:bg-gray-800 rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-xl">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-400">Farmer Details</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-400">Guardian</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-400">Demographics</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-400">Location</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-400 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {filteredData.slice(0, 300).map((row, i) => (
                                <tr key={i} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="font-black text-gray-900 dark:text-white text-sm group-hover:text-indigo-600 transition-colors">{row.hhHeadName}</div>
                                        <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight">{row.farmerId}</div>
                                    </td>
                                    <td className="px-6 py-5 text-sm font-bold text-gray-500">{row.spouseName || '---'}</td>
                                    <td className="px-6 py-5">
                                        <div className="text-xs font-bold text-gray-700 dark:text-gray-300">{row.age}Y • {row.gender}</div>
                                        <div className="text-[9px] font-black uppercase text-gray-400">{row.category}</div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-xs font-bold">{row.village}</div>
                                        <div className="text-[9px] font-black uppercase text-gray-400">{row.gp}</div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <button 
                                            onClick={() => setSelectedBeneficiary(row)}
                                            className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View Card Grid */}
                <div className="md:hidden grid grid-cols-1 gap-4">
                    {filteredData.slice(0, 100).map((row, i) => (
                        <div 
                            key={i} 
                            onClick={() => setSelectedBeneficiary(row)}
                            className="bg-white dark:bg-gray-800 p-5 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-md active:scale-[0.98] transition-all"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">{row.hhHeadName}</h3>
                                    <span className="text-[10px] font-black text-indigo-500 uppercase">{row.farmerId}</span>
                                </div>
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-xl text-indigo-600">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black uppercase text-gray-400">Village</p>
                                    <p className="text-xs font-bold truncate">{row.village}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black uppercase text-gray-400">Category</p>
                                    <p className="text-xs font-bold truncate">{row.category}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {filteredData.length === 0 && (
                    <div className="p-20 text-center bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 text-gray-400 font-bold italic">
                        No records match the filters.
                    </div>
                )}
            </div>

            {/* Detail Modal Overlay */}
            {selectedBeneficiary && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={() => setSelectedBeneficiary(null)}>
                    <div 
                        className="bg-white dark:bg-gray-900 w-full max-w-xl rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl p-6 sm:p-10 max-h-[90vh] overflow-y-auto transform transition-all animate-slide-up"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-start mb-8">
                            <div className="space-y-1">
                                <div className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest inline-block mb-2">Household Profile</div>
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white leading-tight uppercase">{selectedBeneficiary.hhHeadName}</h2>
                                <p className="text-sm font-bold text-indigo-500">ID: {selectedBeneficiary.farmerId}</p>
                            </div>
                            <button 
                                onClick={() => setSelectedBeneficiary(null)}
                                className="p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl hover:bg-gray-100 transition-colors"
                            >
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        </div>

                        {/* Detailed Data Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
                            <DetailItem label="Father / Husband Name" value={selectedBeneficiary.spouseName} />
                            <DetailItem label="Age & Gender" value={`${selectedBeneficiary.age} Years • ${selectedBeneficiary.gender}`} />
                            <DetailItem label="Category" value={selectedBeneficiary.category} />
                            <DetailItem label="Tribe Name" value={selectedBeneficiary.tribeName} />
                            <DetailItem label="Village" value={selectedBeneficiary.village} />
                            <DetailItem label="Gram Panchayat" value={selectedBeneficiary.gp} />
                            <DetailItem label="Cluster" value={selectedBeneficiary.cluster} />
                            <DetailItem label="Block & District" value={`${selectedBeneficiary.block}, ${selectedBeneficiary.district}`} />
                            <DetailItem label="Phone Number" value={selectedBeneficiary.phoneNumber || 'Not Provided'} isContact />
                            <DetailItem label="Baseline Date" value={selectedBeneficiary.submissionDate} />
                        </div>

                        {/* Footer Action */}
                        <button 
                            onClick={() => setSelectedBeneficiary(null)}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-none transition-all active:scale-[0.98] uppercase tracking-widest text-xs"
                        >
                            Close Explorer
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                @media (min-width: 640px) {
                    .animate-slide-up { animation: fade-in 0.4s ease-out forwards; }
                }
            `}</style>
        </div>
    );
};

const DetailItem: React.FC<{ label: string; value: string; isContact?: boolean }> = ({ label, value, isContact }) => (
    <div className="space-y-1.5 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 transition-colors hover:border-indigo-200">
        <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">{label}</p>
        <p className={`text-sm font-bold ${isContact ? 'text-emerald-600' : 'text-gray-800 dark:text-gray-200'}`}>
            {value || '---'}
        </p>
    </div>
);

export default BaselinePage;
