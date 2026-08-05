const fs = require('fs');
const path = 'components/HomePage.tsx';
let content = fs.readFileSync(path, 'utf8');

const startStr = `            <section className="animate-fade-in mt-12 px-4">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Data Submission Hub</h2>
                    <div className="h-1 w-12 bg-indigo-500 mt-2 mx-auto rounded-full"></div>
                </div>
                <ODKDashboardSection />
            </section>`;

if (content.includes(startStr)) {
    content = content.replace(startStr, "");
}

// Remove import
content = content.replace("import ODKDashboardSection from './ODKDashboardSection';", "");

fs.writeFileSync(path, content);
console.log("Fixed homepage");
