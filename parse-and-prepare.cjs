const fs = require('fs');
let code = fs.readFileSync('components/BeneficiaryExplorer.tsx', 'utf8');

// 1. Add registrationDate
code = code.replace(
    /financialYear\?: string;\n}/,
    'financialYear?: string;\n    registrationDate?: string;\n}'
);

// 2. Add materialTarget to ActivityTarget
code = code.replace(
    /contributionTarget: number;\n    financialYear: string;\n}/,
    'contributionTarget: number;\n    financialYear: string;\n    materialTarget: number;\n}'
);

// 3. Update parsedTargets to parse materialTarget
code = code.replace(
    /financialYear: r\['Financial Year'\].*/,
    `financialYear: r['Financial Year'] || r['Financial year'] || r['financial_year'] || r['FY'] || r['financial_year '] || '',
                    materialTarget: parseFloat(r['Material Target'] || r['material_target'] || '0') || 0`
);

// 4. Update beneficiaryMap to parse registrationDate
code = code.replace(
    /financialYear: getVal\(row, \['financial_year', 'financial year', 'fy', 'year'\]\)\n                \}\);/,
    `financialYear: getVal(row, ['financial_year', 'financial year', 'fy', 'year']),
                    registrationDate: getVal(row, ['Date of Registration', 'Registration Date', 'date', 'Timestamp', 'timestamp', 'submission_time', 'time'])
                });`
);

// Add Recharts imports if missing
if (!code.includes('LineChart')) {
    code = code.replace(
        /import \{ \n    BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, \n    XAxis, YAxis, Tooltip\n\} from 'recharts';/,
        `import { 
    BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, 
    XAxis, YAxis, Tooltip, LineChart, Line, AreaChart, Area, Legend, ComposedChart, CartesianGrid
} from 'recharts';`
    );
}

// Add lucide icons
code = code.replace(
    /Activity as ActivityIcon, UserCheck, /,
    `Activity as ActivityIcon, UserCheck, TrendingUp, TrendingDown, Target, Package, CheckCircle, AlertTriangle, Lightbulb, Calendar, Map, Heart, Star, LayoutDashboard, Database, `
);

fs.writeFileSync('components/BeneficiaryExplorer.tsx', code);
