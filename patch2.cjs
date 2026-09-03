const fs = require('fs');
let content = fs.readFileSync('components/ODKDashboardSection.tsx', 'utf8');

const oldFilter = `            const matchYear = selectedDate !== 'All' ? true : (selectedYear === 'All' || subYear === selectedYear);

            return matchForm && matchUser && matchMonth && matchYear && matchDate;
        });`;

const newFilter = `            const matchYear = selectedDate !== 'All' ? true : (selectedYear === 'All' || subYear === selectedYear);
            
            let matchProject = true;
            if (selectedProject !== 'All') {
                const subUserName = usersMap.get(sub.userId) || '';
                const projects = getProjectsForUser(subUserName);
                if (!projects.includes(selectedProject)) matchProject = false;
            }

            return matchForm && matchUser && matchMonth && matchYear && matchDate && matchProject;
        });`;

content = content.replace(oldFilter, newFilter);
fs.writeFileSync('components/ODKDashboardSection.tsx', content);
