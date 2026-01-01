
import React from 'react';

interface DashboardProps {
    activityId: string;
}

const Dashboard: React.FC<DashboardProps> = ({ activityId }) => {
    // This mapping allows you to show completely different reports or different pages of the same report.
    // Replace these URLs with your actual Looker Studio embed URLs for each category.
    const getEmbedUrl = (id: string) => {
        const baseReport = "https://lookerstudio.google.com/embed/reporting/c0a112e0-1985-4160-9580-34ee38ab9c36/page/";
        
        const pageMapping: Record<string, string> = {
            'hari': 'l5bjF',           // Page ID for Hari (Summary)
            'agriculture': 'p_abc123', // Replace with actual Page ID for Agriculture
            'education': 'p_def456',   // Replace with actual Page ID for Education
            'healthcare': 'p_ghi789',  // Replace with actual Page ID for Health
            'wash': 'p_jkl012',        // Replace with actual Page ID for WASH
            'financial': 'p_mno345',   // Replace with actual Page ID for Financial
            'infrastructure': 'p_pqr678' // Replace with actual Page ID for Infrastructure
        };

        const pageId = pageMapping[id] || 'l5bjF'; // Default to Hari
        
        // You can also append global filters via parameters if your report is configured for it
        // e.g., ?params={"ds0.category_id":"${id}"}
        return `${baseReport}${pageId}`;
    };

    const embedUrl = getEmbedUrl(activityId);

    return (
        <div className="w-full h-[70vh] bg-white dark:bg-gray-800 rounded-xl overflow-hidden relative">
            {/* Loading state indicator for the iframe */}
            <div className="absolute inset-0 flex items-center justify-center -z-10 bg-gray-50 dark:bg-gray-900">
                 <div className="animate-pulse flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-sm text-gray-500">Loading Dashboard...</p>
                 </div>
            </div>
            
            <iframe
                title={`Dashboard for ${activityId}`}
                width="100%"
                height="100%"
                src={embedUrl}
                frameBorder="0"
                style={{ border: 0 }}
                allowFullScreen
                sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-forms allow-popups"
            ></iframe>
        </div>
    );
};

export default Dashboard;
