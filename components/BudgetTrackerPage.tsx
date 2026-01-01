
import React from 'react';

const BudgetTrackerPage: React.FC = () => {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 dark:text-white">Budget Tracker</h1>
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1">Administrative Financial Overview</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-xl">
                    <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                    <span className="text-xs font-bold text-yellow-700 dark:text-yellow-400">Admin Restricted Access</span>
                </div>
            </div>

            <div className="w-full h-[75vh] bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-xl border border-gray-100 dark:border-gray-700 relative">
                {/* Loading state indicator */}
                <div className="absolute inset-0 flex items-center justify-center -z-10 bg-gray-50 dark:bg-gray-900">
                     <div className="animate-pulse flex flex-col items-center">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-4 text-sm text-gray-500">Syncing Budget Data...</p>
                     </div>
                </div>
                
                <iframe
                    title="Budget Tracker Dashboard"
                    width="100%"
                    height="100%"
                    src="https://lookerstudio.google.com/embed/reporting/577addd7-a959-4c68-bd3a-5795e7362a47/page/Kp6jF"
                    frameBorder="0"
                    style={{ border: 0 }}
                    allowFullScreen
                    sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-forms allow-popups"
                ></iframe>
            </div>
        </div>
    );
};

export default BudgetTrackerPage;
