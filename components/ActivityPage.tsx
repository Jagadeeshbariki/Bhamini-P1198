
import React, { useState } from 'react';
import Dashboard from './Dashboard';

const ActivityPage: React.FC = () => {
    const [selectedSection, setSelectedSection] = useState<number>(1);
    const sections = Array.from({ length: 7 }, (_, i) => i + 1);

    return (
        <div className="flex flex-col md:flex-row gap-8 h-full">
            <aside className="md:w-64 flex-shrink-0">
                <h2 className="text-2xl font-bold mb-4 text-gray-700 dark:text-gray-300">Sections</h2>
                <nav className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 -mx-2 md:mx-0">
                    {sections.map(section => (
                        <button
                            key={section}
                            onClick={() => setSelectedSection(section)}
                            className={`w-full text-left px-4 py-2 rounded-lg transition-colors text-sm font-medium whitespace-nowrap mx-2 md:mx-0 my-1 ${
                                selectedSection === section
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'bg-white dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                        >
                            Section {section}
                        </button>
                    ))}
                </nav>
            </aside>
            <main className="flex-grow w-full">
                <h2 className="text-2xl font-bold mb-4 text-gray-700 dark:text-gray-300">Dashboard: Section {selectedSection}</h2>
                <Dashboard sectionId={selectedSection} />
            </main>
        </div>
    );
};

export default ActivityPage;
