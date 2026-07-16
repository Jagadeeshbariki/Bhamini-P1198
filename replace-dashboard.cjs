const fs = require('fs');
let code = fs.readFileSync('components/BeneficiaryExplorer.tsx', 'utf8');

const importStatement = "import { ExecutiveDashboard } from './ExecutiveDashboard';\n";
if (!code.includes("import { ExecutiveDashboard }")) {
    code = importStatement + code;
}

const startString = "{/* 3. ANALYTICS GRID */}";
const endString = "{/* 4. DETAILED TABLE */}";

const startIndex = code.indexOf(startString);
const endIndex = code.indexOf(endString);

if (startIndex !== -1 && endIndex !== -1) {
    const dashboardComponent = `
            {/* 3. EXECUTIVE DASHBOARD */}
            <ExecutiveDashboard 
                stats={stats} 
                filteredData={filteredData} 
                targets={targets} 
                filterCluster={filterCluster} 
                filterGP={filterGP} 
                filterVillage={filterVillage} 
                filterActivity={filterActivity} 
                filterFinancialYear={filterFinancialYear} 
            />

            `;
    code = code.substring(0, startIndex) + dashboardComponent + code.substring(endIndex);
    fs.writeFileSync('components/BeneficiaryExplorer.tsx', code);
    console.log("Replaced successfully!");
} else {
    console.log("Could not find delimiters.");
}
