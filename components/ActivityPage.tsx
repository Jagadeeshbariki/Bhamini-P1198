
import React, { useState } from 'react';
import Dashboard from './Dashboard';
import AssetTrackingDashboard from './AssetTrackingDashboard';
import BeneficiaryExplorer from './BeneficiaryExplorer';
import EcoFarmpondPage from './EcoFarmpondPage';
import BYPPage from './BYPPage';
import ElevatedGoatShedPage from './ElevatedGoatShedPage';

export interface ActivityType {
    id: string;
    name: string;
    description: string;
}

const ACTIVITIES: ActivityType[] = [
    { id: 'dashboard', name: 'Dashboard', description: 'General Looker Studio dashboards for various activities.' },
    { id: 'byp-poultry-ls', name: 'BYP Poultry Dashboard', description: 'Looker Studio monitoring for BYP Poultry.' },
    { id: 'elevated-goat-shed-ls', name: 'Elevated Goat Shed Dashboard', description: 'Looker Studio monitoring for Elevated Goat Shed.' },
    { id: 'assets', name: 'Asset Tracking System', description: 'Interactive inventory, procurement ledger, and stock point monitoring.' },
    { id: 'beneficiary', name: 'Beneficiary Explorer', description: 'Detailed explorer for project beneficiaries and demographics.' },
    { id: 'eco-farmpond', name: 'Eco-farmpond', description: 'Project monitoring and contribution analysis for farmpond beneficiaries.' },
    { id: 'byp-poultry', name: 'BYP Poultry Explorer', description: 'Backyard Poultry project monitoring and tracking.' },
    { id: 'elevated-goat-shed', name: 'Elevated Goat Shed Explorer', description: 'Monitoring and tracking for elevated goat shed beneficiaries.' },
];

const ActivityPage: React.FC = () => {
    const [selectedActivity, setSelectedActivity] = useState<ActivityType>(ACTIVITIES[0]);
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    const handleSelect = (activity: ActivityType) => {
        setSelectedActivity(activity);
        setIsPickerOpen(false);
    };

    const renderContent = () => {
        if (selectedActivity.id === 'assets') {
            return <AssetTrackingDashboard />;
        }
        if (selectedActivity.id === 'beneficiary') {
            return <BeneficiaryExplorer />;
        }
        if (selectedActivity.id === 'eco-farmpond') {
            return <EcoFarmpondPage />;
        }
        if (selectedActivity.id === 'byp-poultry') {
            return <BYPPage />;
        }
        if (selectedActivity.id === 'elevated-goat-shed') {
            return <ElevatedGoatShedPage />;
        }
        return <Dashboard activityId={selectedActivity.id} />;
    };

    return (
        <div className="flex flex-col gap-8 h-full">
            <div className="relative md:w-80">
                <h2 className="text-2xl font-bold mb-4 text-gray-700 dark:text-gray-300">Activity Categories</h2>
                
                <div className="relative">
                    <button
                        onClick={() => setIsPickerOpen(!isPickerOpen)}
                        className="w-full flex justify-between items-center text-left px-4 py-3 rounded-xl transition-all text-sm font-semibold bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 shadow-sm"
                        aria-haspopup="true"
                        aria-expanded={isPickerOpen}
                    >
                        <div className="flex flex-col">
                            <span className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-0.5">Selected Activity</span>
                            <span className="text-base">{selectedActivity.name}</span>
                        </div>
                        <svg className={`w-6 h-6 transition-transform duration-200 ${isPickerOpen ? 'transform rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>

                    {isPickerOpen && (
                        <div className="absolute z-[100] mt-2 w-full md:w-[400px] bg-white dark:bg-gray-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-200 dark:border-gray-700 max-h-[70vh] overflow-y-auto ring-1 ring-black/5">
                            <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Select Dashboard</p>
                            </div>
                            <nav className="p-2 space-y-1">
                                {ACTIVITIES.map(activity => (
                                    <button
                                        key={activity.id}
                                        onClick={() => handleSelect(activity)}
                                        className={`w-full text-left px-4 py-4 rounded-xl transition-all group ${
                                            selectedActivity.id === activity.id
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none'
                                                : 'hover:bg-blue-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'
                                        }`}
                                    >
                                        <div className="font-black text-sm uppercase tracking-tight">{activity.name}</div>
                                        <div className={`text-[10px] mt-1 font-medium leading-relaxed ${selectedActivity.id === activity.id ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                                            {activity.description}
                                        </div>
                                    </button>
                                ))}
                            </nav>
                        </div>
                    )}
                </div>
            </div>
            
            <main className="flex-grow w-full space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-extrabold text-gray-800 dark:text-white uppercase tracking-tight">{selectedActivity.name}</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm font-medium">{selectedActivity.description}</p>
                    </div>
                </div>
                
                <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl p-1 shadow-inner border border-gray-200 dark:border-gray-800">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

export default ActivityPage;
