
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
    aadharNumber: string;
    totalFamilyMembers: string;
    annualIncome: string;
    incomeSource: string;
    livestockIncome: string;
    otherIncome: string;
}

const BaselinePage: React.FC = () => {
    const [allData, setAllData] = useState<HouseholdData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBeneficiary, setSelectedBeneficiary] = useState<HouseholdData | null>(null);

    // Filters
    const [selectedCluster, setSelectedCluster] = useState('All');
    const [selectedGP, setSelectedGP] = useState('All');
    const [selectedVillage, setSelectedVillage] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    const parseCSV = (csv: string): HouseholdData[] => {
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentVal = '';
        let inQuotes = false;

        for (let i = 0; i < csv.length; i++) {
            const char = csv[i];
            const nextChar = csv[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentVal += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                currentRow.push(currentVal.trim());
                currentVal = '';
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
                if (currentVal || currentRow.length > 0) {
                    currentRow.push(currentVal.trim());
                    rows.push(currentRow);
                    currentVal = '';
                    currentRow = [];
                }
                if (char === '\r' && nextChar === '\n') i++;
            } else {
                currentVal += char;
            }
        }
        if (currentVal || currentRow.length > 0) {
            currentRow.push(currentVal.trim());
            rows.push(currentRow);
        }

        if (rows.length < 2) return [];

        const rawHeaders = rows[0];
        
        const headersMap: Record<string, string> = {
            'FARMERID': 'farmerId',
            'FID': 'farmerId',
            'FARMER_ID': 'farmerId',
            'FARMER ID': 'farmerId',
            'SUBMISSIONDATE': 'submissionDate',
            'DATE': 'submissionDate',
            'SUBMISSION_DATE': 'submissionDate',
            'SUBMISSION_TIME': 'submissionDate',
            'DISTRICT': 'district',
            'DIST': 'district',
            'BLOCK': 'block',
            'CLUSTER': 'cluster',
            'GP': 'gp',
            'GRAMPANCHAYAT': 'gp',
            'GRAM_PANCHAYAT': 'gp',
            'GRAM PANCHAYAT': 'gp',
            'VILLAGE': 'village',
            'HHHEADNAME': 'hhHeadName',
            'FARMERNAME': 'hhHeadName',
            'FARMER_NAME': 'hhHeadName',
            'FARMER NAME': 'hhHeadName',
            'NAME': 'hhHeadName',
            'HH_HEAD_NAME': 'hhHeadName',
            'HH HEAD NAME': 'hhHeadName',
            'FATHER/HUSBANDNAME': 'spouseName',
            'FATHER_HUSBAND_NAME': 'spouseName',
            'FATHER HUSBAND NAME': 'spouseName',
            'GUARDIANNAME': 'spouseName',
            'GUARDIAN_NAME': 'spouseName',
            'GUARDIAN NAME': 'spouseName',
            'SPOUSENAME': 'spouseName',
            'SPOUSE_NAME': 'spouseName',
            'SPOUSE NAME': 'spouseName',
            'FATHERNAME': 'spouseName',
            'FATHER NAME': 'spouseName',
            'HUSBANDNAME': 'spouseName',
            'HUSBAND NAME': 'spouseName',
            'AGE': 'age',
            'GENDER': 'gender',
            'SEX': 'gender',
            'CATEGORY': 'category',
            'CASTE': 'category',
            'SOCIAL_CATEGORY': 'category',
            'SOCIAL CATEGORY': 'category',
            'TRIBE_NAME': 'tribeName',
            'TRIBE': 'tribeName',
            'TRIBE NAME': 'tribeName',
            'PHONENUMBER': 'phoneNumber',
            'PHONE_NUMBER': 'phoneNumber',
            'PHONE NUMBER': 'phoneNumber',
            'MOBILE': 'phoneNumber',
            'MOBILENUMBER': 'phoneNumber',
            'MOBILE_NUMBER': 'phoneNumber',
            'CONTACT': 'phoneNumber',
            'AADHARNUMBER': 'aadharNumber',
            'AADHAR_NUMBER': 'aadharNumber',
            'AADHAR NUMBER': 'aadharNumber',
            'AADHAR': 'aadharNumber',
            'AADHARNO': 'aadharNumber',
            'AADHAR_NO': 'aadharNumber',
            'ADHAR': 'aadharNumber',
            'ADHARNO': 'aadharNumber',
            'ADHAR_NO': 'aadharNumber',
            'ADHARNUMBER': 'aadharNumber',
            'ADHAR_NUMBER': 'aadharNumber',
            'UID': 'aadharNumber',
            'UIDNO': 'aadharNumber',
            'UID_NO': 'aadharNumber',
            'TOTALFAMILYMEMBERS': 'totalFamilyMembers',
            'TOTAL_FAMILY_MEMBERS': 'totalFamilyMembers',
            'TOTAL FAMILY MEMBERS': 'totalFamilyMembers',
            'FAMILYMEMBERS': 'totalFamilyMembers',
            'FAMILY_MEMBERS': 'totalFamilyMembers',
            'FAMILY MEMBERS': 'totalFamilyMembers',
            'FAMILYSIZE': 'totalFamilyMembers',
            'FAMILY_SIZE': 'totalFamilyMembers',
            'FAMILY SIZE': 'totalFamilyMembers',
            'HHSIZE': 'totalFamilyMembers',
            'HH_SIZE': 'totalFamilyMembers',
            'HH SIZE': 'totalFamilyMembers',
            'TOTALMEMBERS': 'totalFamilyMembers',
            'TOTAL_MEMBERS': 'totalFamilyMembers',
            'TOTAL MEMBERS': 'totalFamilyMembers',
            'TOTALMEMBERSINHH': 'totalFamilyMembers',
            'TOTAL_MEMBERS_IN_HH': 'totalFamilyMembers',
            'TOTAL MEMBERS IN HH': 'totalFamilyMembers',
            'TOTALMEMBERS': 'totalFamilyMembers',
            'TOTAL MEMBERS': 'totalFamilyMembers',
            'TOTAL_MEMBERS': 'totalFamilyMembers',
            'HH_TOTAL_MEMBERS': 'totalFamilyMembers',
            'HH TOTAL MEMBERS': 'totalFamilyMembers',
            'ANNUALINCOME': 'annualIncome',
            'ANNUAL_INCOME': 'annualIncome',
            'ANNUAL INCOME': 'annualIncome',
            'INCOME': 'annualIncome',
            'HOUSEHOLDINCOME': 'annualIncome',
            'HOUSEHOLD_INCOME': 'annualIncome',
            'HOUSEHOLD INCOME': 'annualIncome',
            'YEARLYINCOME': 'annualIncome',
            'YEARLY_INCOME': 'annualIncome',
            'YEARLY INCOME': 'annualIncome',
            'TOTALINCOME': 'annualIncome',
            'TOTAL_INCOME': 'annualIncome',
            'TOTAL INCOME': 'annualIncome',
            'HHINCOMESOURCE': 'incomeSource',
            'HH_INCOME_SOURCE': 'incomeSource',
            'HH INCOME SOURCE': 'incomeSource',
            'LIVESTOCKINCOME': 'livestockIncome',
            'LIVESTOCK_INCOME': 'livestockIncome',
            'LIVESTOCK INCOME': 'livestockIncome',
            'HHINCOMEOTHERS': 'otherIncome',
            'HH_INCOME_OTHERS': 'otherIncome',
            'HH INCOME OTHERS': 'otherIncome'
        };

        const clean = (s: string) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const normalizedMap: Record<string, string> = {};
        Object.keys(headersMap).forEach(k => {
            normalizedMap[clean(k)] = headersMap[k];
        });

        const cleanHeaders = rawHeaders.map(h => clean(h));

        const parsedData = rows.slice(1).map(vals => {
            const row: any = {};
            cleanHeaders.forEach((h, i) => {
                const key = normalizedMap[h];
                if (key) row[key] = (vals[i] || '').toString().trim();
            });
            return row as HouseholdData;
        });

        return parsedData;
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
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const clusters = useMemo(() => ['All', ...Array.from(new Set(allData.map(d => (d.cluster || '').trim()))).filter(Boolean).sort()], [allData]);
    
    const gps = useMemo(() => {
        const filtered = selectedCluster === 'All' ? allData : allData.filter(d => (d.cluster || '').trim() === selectedCluster);
        return ['All', ...Array.from(new Set(filtered.map(d => (d.gp || '').trim()))).filter(Boolean).sort()];
    }, [allData, selectedCluster]);

    const villages = useMemo(() => {
        const filtered = allData.filter(d => 
            (selectedCluster === 'All' || (d.cluster || '').trim() === selectedCluster) &&
            (selectedGP === 'All' || (d.gp || '').trim() === selectedGP)
        );
        return ['All', ...Array.from(new Set(filtered.map(d => (d.village || '').trim()))).filter(Boolean).sort()];
    }, [allData, selectedCluster, selectedGP]);

    const filteredData = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return allData.filter(d => {
            const matchesCluster = selectedCluster === 'All' || (d.cluster || '').trim() === selectedCluster;
            const matchesGP = selectedGP === 'All' || (d.gp || '').trim() === selectedGP;
            const matchesVillage = selectedVillage === 'All' || (d.village || '').trim() === selectedVillage;
            
            const matchesSearch = !query || 
                (d.hhHeadName || '').toLowerCase().includes(query) || 
                (d.farmerId || '').toLowerCase().includes(query) ||
                (d.aadharNumber || '').toLowerCase().includes(query);
                
            return matchesCluster && matchesGP && matchesVillage && matchesSearch;
        });
    }, [allData, selectedCluster, selectedGP, selectedVillage, searchQuery]);

    if (loading && allData.length === 0) return (
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
                        <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight text-indigo-600">Baseline Explorer</h1>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Household Registry</p>
                    </div>
                    <div className="w-full md:w-80 relative group">
                        <input 
                            type="text" 
                            placeholder="Name, ID or Aadhar Number..."
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

            {/* List View */}
            <div className="space-y-4">
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
                            {filteredData.slice(0, 1000).map((row, i) => (
                                <tr key={i} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="font-black text-gray-900 dark:text-white text-sm group-hover:text-indigo-600 transition-colors">{row.hhHeadName}</div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight">FID: {row.farmerId || 'N/A'}</span>
                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">UID: {row.aadharNumber || 'MISSING'}</span>
                                        </div>
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

                <div className="md:hidden grid grid-cols-1 gap-4">
                    {filteredData.slice(0, 500).map((row, i) => (
                        <div 
                            key={i} 
                            onClick={() => setSelectedBeneficiary(row)}
                            className="bg-white dark:bg-gray-800 p-5 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-md active:scale-[0.98] transition-all"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">{row.hhHeadName}</h3>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-indigo-500 uppercase">{row.farmerId || 'No FID'}</span>
                                        <span className="text-[9px] font-black text-gray-400 uppercase">UID: {row.aadharNumber || '---'}</span>
                                    </div>
                                </div>
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-xl text-indigo-600">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {filteredData.length === 0 && (
                    <div className="p-20 text-center bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 text-gray-400 font-bold italic">
                        No records match your search criteria.
                    </div>
                )}
            </div>

            {/* Redesigned Detail Modal Overlay */}
            {selectedBeneficiary && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fade-in" 
                        onClick={() => setSelectedBeneficiary(null)}
                    />
                    
                    {/* Modal Content */}
                    <div 
                        className="relative bg-white dark:bg-gray-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-scale-in z-[101]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Static Header */}
                        <div className="px-6 py-5 sm:px-10 sm:py-8 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start bg-white dark:bg-gray-900">
                            <div className="space-y-1.5">
                                <div className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest inline-block mb-1">Household Profile</div>
                                <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white leading-tight uppercase pr-4">
                                    {selectedBeneficiary.hhHeadName || 'Unknown Beneficiary'}
                                </h2>
                                <div className="flex flex-col gap-0.5">
                                    <p className="text-[11px] font-bold text-indigo-500 tracking-tighter uppercase">Farmer ID: {selectedBeneficiary.farmerId || '---'}</p>
                                    <p className="text-[10px] font-black text-gray-400 uppercase">Aadhar (UID): {selectedBeneficiary.aadharNumber || 'NOT FOUND'}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedBeneficiary(null)}
                                className="p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                            >
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        </div>

                        {/* Scrollable Content Area */}
                        <div className="flex-grow overflow-y-auto px-6 py-6 sm:px-10 sm:py-8 space-y-8 bg-gray-50/50 dark:bg-gray-950/20">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <DetailItem label="Full Name" value={selectedBeneficiary.hhHeadName} highlight />
                                <DetailItem label="Aadhar / UID" value={selectedBeneficiary.aadharNumber} highlight />
                                <DetailItem label="Father / Husband Name" value={selectedBeneficiary.spouseName} />
                                <DetailItem label="Age & Gender" value={`${selectedBeneficiary.age} Years • ${selectedBeneficiary.gender}`} />
                                <DetailItem label="Total Family Members" value={selectedBeneficiary.totalFamilyMembers || '---'} highlight />
                                <DetailItem label="Annual Income" value={selectedBeneficiary.annualIncome ? `₹${selectedBeneficiary.annualIncome}` : '---'} highlight />
                                <DetailItem label="Income Source" value={selectedBeneficiary.incomeSource || '---'} />
                                <DetailItem label="Livestock Income" value={selectedBeneficiary.livestockIncome ? `₹${selectedBeneficiary.livestockIncome}` : '---'} />
                                <DetailItem label="Other Income" value={selectedBeneficiary.otherIncome ? `₹${selectedBeneficiary.otherIncome}` : '---'} />
                                <DetailItem label="Category" value={selectedBeneficiary.category} />
                                <DetailItem label="Tribe Name" value={selectedBeneficiary.tribeName} />
                                <DetailItem label="Village" value={selectedBeneficiary.village} />
                                <DetailItem label="Gram Panchayat" value={selectedBeneficiary.gp} />
                                <DetailItem label="Cluster" value={selectedBeneficiary.cluster} />
                                <DetailItem label="Block & District" value={`${selectedBeneficiary.block}, ${selectedBeneficiary.district}`} />
                                <DetailItem label="Phone Number" value={selectedBeneficiary.phoneNumber || 'Not Provided'} isContact />
                                <DetailItem label="Baseline Date" value={selectedBeneficiary.submissionDate} />
                            </div>

                            {/* Sticky Footer Action inside content */}
                            <button 
                                onClick={() => setSelectedBeneficiary(null)}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-none transition-all active:scale-[0.98] uppercase tracking-widest text-xs"
                            >
                                Close Explorer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                .animate-scale-in { animation: scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scale-in {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

const DetailItem: React.FC<{ label: string; value: string; isContact?: boolean; highlight?: boolean }> = ({ label, value, isContact, highlight }) => (
    <div className={`space-y-1.5 p-4 rounded-2xl border transition-colors ${highlight ? 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-white dark:bg-gray-800/80 border-gray-100 dark:border-gray-700 hover:border-indigo-200 shadow-sm'}`}>
        <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">{label}</p>
        <p className={`text-sm font-bold break-all ${isContact ? 'text-emerald-600' : highlight ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-800 dark:text-gray-200'}`}>
            {value || '---'}
        </p>
    </div>
);

export default BaselinePage;
