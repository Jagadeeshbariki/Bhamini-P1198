const fs = require('fs');
let content = fs.readFileSync('components/ODKDashboardSection.tsx', 'utf8');

const HDFC_MEMBERS = ['jadeskung', 'mani', 'sampanth', 'praveen', 'sugreevulu', 'lokesh', 'meenaka_ganapathi', 'meenak_ganapthi'];
const INTERNAL_MEMBERS = ['minna rao', 'govindu rao', 'vinodkumar', 'sugreevulu', 'lokesh', 'meenaka_ganapathi', 'meenak_ganapthi', 'adinarayana', 'santhi'];

const getProjectsForUserCode = `
const HDFC_MEMBERS = ['jadeskung', 'mani', 'sampanth', 'praveen', 'sugreevulu', 'lokesh', 'meenaka_ganapathi', 'meenak_ganapthi'];
const INTERNAL_MEMBERS = ['minna rao', 'govindu rao', 'vinodkumar', 'sugreevulu', 'lokesh', 'meenaka_ganapathi', 'meenak_ganapthi', 'adinarayana', 'santhi'];

const getProjectsForUser = (userName: string) => {
    if (!userName) return ['HDFC', 'Internal'];
    const normalized = userName.toLowerCase().trim();
    const inHDFC = HDFC_MEMBERS.some(m => normalized.includes(m));
    const inInternal = INTERNAL_MEMBERS.some(m => normalized.includes(m));
    
    if (!inHDFC && !inInternal) return ['HDFC', 'Internal'];
    
    const projects: string[] = [];
    if (inHDFC) projects.push('HDFC');
    if (inInternal) projects.push('Internal');
    return projects;
};
`;

content = content.replace("export const ODKDashboardSection: React.FC = () => {", getProjectsForUserCode + "\nexport const ODKDashboardSection: React.FC = () => {");

content = content.replace(
    "const [selectedDate, setSelectedDate] = useState<string>('All');",
    "const [selectedDate, setSelectedDate] = useState<string>('All');\n    const [selectedProject, setSelectedProject] = useState<string>('All');"
);

fs.writeFileSync('components/ODKDashboardSection.tsx', content);
