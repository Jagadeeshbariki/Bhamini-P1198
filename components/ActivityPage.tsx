
import React, { useState } from 'react';
import Dashboard from './Dashboard';

export interface ActivityType {
    id: string;
    name: string;
    description: string;
}

const ACTIVITIES: ActivityType[] = [
    { id: 'hari', name: 'Hari', description: 'Field Data Tracking: Household Head Name and IDs Details' },
    { id: 'agriculture', name: 'Agriculture & Livelihoods', description: 'Tracking crop yields, farmer training, and income.' },
    { id: 'education', name: 'Education & Skills', description: 'School enrollment, digital literacy, and vocational training.' },
    { id: 'healthcare', name: 'Healthcare & Nutrition', description: 'Maternal health, immunization, and nutrition camps.' },
    { id: 'wash', name: 'Water & Sanitation (WASH)', description: 'Safe drinking water and community sanitation projects.' },
    { id: 'financial', name: 'Financial Inclusion', description: 'Self-help groups, bank linkages, and insurance.' },
    { id: 'infrastructure', name: 'Rural Infrastructure', description: 'Check dams, roads, and community centers.' },
];

const ActivityPage: React.FC = () => {
    const [selectedActivity, setSelectedActivity] = useState<ActivityType>(ACTIVITIES[0]);
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    const handleSelect = (activity: ActivityType) => {
        setSelectedActivity(activity);
        setIsPickerOpen(false);
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
                        <div className="absolute z-50 mt-2 w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[60vh] overflow-y-auto">
                            <nav className="p-2 space-y-1">
                                {ACTIVITIES.map(activity => (
                                    <button
                                        key={activity.id}
                                        onClick={() => handleSelect(activity)}
                                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors group ${
                                            selectedActivity.id === activity.id
                                                ? 'bg-blue-600 text-white'
                                                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        <div className="font-bold">{activity.name}</div>
                                        <div className={`text-xs mt-0.5 ${selectedActivity.id === activity.id ? 'text-blue-100' : 'text-gray-500'}`}>
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
                        <h2 className="text-3xl font-extrabold text-gray-800 dark:text-white">{selectedActivity.name}</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">{selectedActivity.description}</p>
                    </div>
                </div>
                
                <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl p-1 shadow-inner border border-gray-200 dark:border-gray-800">
                    <Dashboard activityId={selectedActivity.id} />
                </div>
            </main>
        </div>
    );
};

export default ActivityPage;
