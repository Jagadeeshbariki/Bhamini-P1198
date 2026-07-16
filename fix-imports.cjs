const fs = require('fs');
let code = fs.readFileSync('components/BeneficiaryExplorer.tsx', 'utf8');

code = code.replace(
    /import \{[\s\S]*?\} from 'recharts';/,
    `import { 
    BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, 
    XAxis, YAxis, Tooltip, LineChart, Line, AreaChart, Area, Legend, ComposedChart, CartesianGrid
} from 'recharts';`
);

code = code.replace(
    /import \{[\s\S]*?\} from 'lucide-react';/,
    `import { 
    Users, MapPin, Filter, Search, 
    Download, X, ArrowUpDown, ArrowUp,
    Activity as ActivityIcon, UserCheck,
    ChevronDown, ChevronUp, ArrowLeft,
    TrendingUp, TrendingDown, Target, Package, CheckCircle, AlertTriangle, Lightbulb, Calendar, Map, Heart, Star, LayoutDashboard, Database
} from 'lucide-react';`
);

fs.writeFileSync('components/BeneficiaryExplorer.tsx', code);
