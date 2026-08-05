const fs = require('fs');
const path = 'components/HomePage.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add import
if (!content.includes('ODKDashboardSection')) {
    content = content.replace(
        "import PhotoGallery from './PhotoGallery';",
        "import PhotoGallery from './PhotoGallery';\nimport ODKDashboardSection from './ODKDashboardSection';"
    );

    // Insert section before Project Highlights
    const sectionStart = `            <section className="animate-fade-in mt-12">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Project Highlights</h2>`;
    
    const newSection = `            <section className="animate-fade-in mt-12 px-4">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Data Submission Hub</h2>
                    <div className="h-1 w-12 bg-indigo-500 mt-2 mx-auto rounded-full"></div>
                </div>
                <ODKDashboardSection />
            </section>

            <section className="animate-fade-in mt-12">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Project Highlights</h2>`;
    
    content = content.replace(sectionStart, newSection);
    
    fs.writeFileSync(path, content);
    console.log("HomePage updated.");
} else {
    console.log("Already updated.");
}
