
import React from 'react';

interface DashboardProps {
    sectionId: number;
}

const Dashboard: React.FC<DashboardProps> = ({ sectionId }) => {
    // IMPORTANT: Replace this with your actual Looker Studio report URL.
    // The sectionId is appended as a parameter to show how you might filter the report.
    // You'll need to configure your Looker Studio report to accept this parameter.
    const dashboardBaseUrl = "https://lookerstudio.google.com/embed/reporting/0b55850a-e374-4685-9cea-f7b2c0b02b54/page/p_3g5l4i1jwc";
    
    // This is a simple way to pass the section ID. Your report might need a different format.
    const embedUrl = `${dashboardBaseUrl}?params={"ds0.section_id":"${sectionId}"}`;

    return (
        <div className="w-full h-[70vh] bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <iframe
                title={`Dashboard Section ${sectionId}`}
                width="100%"
                height="100%"
                src={embedUrl}
                frameBorder="0"
                allowFullScreen
                sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-forms allow-popups"
            ></iframe>
        </div>
    );
};

export default Dashboard;
