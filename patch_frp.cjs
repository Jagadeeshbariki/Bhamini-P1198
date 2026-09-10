const fs = require('fs');
let content = fs.readFileSync('components/ODKDashboardSection.tsx', 'utf8');

const pivotGenCode = `        // Pivot Generation
        const pivotMap = new Map(); // Form Name -> Map of FRP Name -> Count
        const frpNamesSet = new Set();
        
        filtered.forEach((sub: any) => {
            const formName = formsMap.get(sub.formId) || sub.formId;
            const frpName = usersMap.get(sub.userId) || \`User \${sub.userId}\`;
            
            frpNamesSet.add(frpName);
            
            if (!pivotMap.has(formName)) {
                pivotMap.set(formName, new Map());
            }
            const fMap = pivotMap.get(formName);
            fMap.set(frpName, (fMap.get(frpName) || 0) + 1);
        });

        const frpColumns = Array.from(frpNamesSet).sort((a: any, b: any) => a.localeCompare(b));`;

const newPivotGenCode = `        // Pivot Generation
        const pivotMap = new Map(); // Form Name -> Map of FRP Name -> Count
        const frpNamesSet = new Set();
        
        // Add ALL valid users to frpNamesSet based on current user/project filters
        users.forEach((u: any) => {
            const matchUser = selectedUser === 'All' || String(u.id) === selectedUser;
            let matchProject = true;
            if (selectedProject !== 'All') {
                const projects = getProjectsForUser(u.name);
                if (!projects.includes(selectedProject)) matchProject = false;
            }
            if (matchUser && matchProject) {
                frpNamesSet.add(u.name);
            }
        });

        filtered.forEach((sub: any) => {
            const formName = formsMap.get(sub.formId) || sub.formId;
            const frpName = usersMap.get(sub.userId) || \`User \${sub.userId}\`;
            
            // Just in case a submission has a user not in the users array
            frpNamesSet.add(frpName);
            
            if (!pivotMap.has(formName)) {
                pivotMap.set(formName, new Map());
            }
            const fMap = pivotMap.get(formName);
            fMap.set(frpName, (fMap.get(frpName) || 0) + 1);
        });

        const frpColumns = Array.from(frpNamesSet).sort((a: any, b: any) => a.localeCompare(b));`;

content = content.replace(pivotGenCode, newPivotGenCode);
fs.writeFileSync('components/ODKDashboardSection.tsx', content);
