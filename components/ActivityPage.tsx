import React, { useState } from 'react';
import Dashboard from './Dashboard';

const ActivityPage: React.FC = () => {
    const [selectedSection, setSelectedSection] = useState<number>(1);
    const [isSectionPickerOpen, setIsSectionPickerOpen] = useState(false);
    const sections = Array.from({ length: 7 }, (_, i) => i + 1);

    const handleSectionSelect = (section: number) => {
        setSelectedSection(section);
        setIsSectionPickerOpen(false); // Hide menu on selection
    };

    return (
        <div className="flex flex-col gap-8 h-full">
            <div className="relative md:w-64">
                <h2 className="text-2xl font-bold mb-4 text-gray-700 dark:text-gray-300">Sections</h2>
                <button
                    onClick={() => setIsSectionPickerOpen(!isSectionPickerOpen)}
                    className="w-full flex justify-between items-center text-left px-4 py-2 rounded-lg transition-colors text-sm font-medium bg-white dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 shadow"
                    aria-haspopup="true"
                    aria-expanded={isSectionPickerOpen}
                >
                    <span>Section {selectedSection}</span>
                    <svg className={`w-5 h-5 transition-transform ${isSectionPickerOpen ? 'transform rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>

                {isSectionPickerOpen && (
                    <div className="absolute z-10 mt-2 w-full bg-white dark:bg-gray-800 rounded-md shadow-lg border dark:border-gray-700">
                        <nav className="flex flex-col p-1">
                            {sections.map(section => (
                                <button
                                    key={section}
                                    onClick={() => handleSectionSelect(section)}
                                    className={`w-full text-left px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                                        selectedSection === section
                                            ? 'bg-blue-600 text-white'
                                            : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                    Section {section}
                                </button>
                            ))}
                        </nav>
                    </div>
                )}
            </div>
            
            <main className="flex-grow w-full">
                <h2 className="text-2xl font-bold mb-4 text-gray-700 dark:text-gray-300">Dashboard: Section {selectedSection}</h2>
                <Dashboard sectionId={selectedSection} />
            </main>
        </div>
    );
};

export default ActivityPage;