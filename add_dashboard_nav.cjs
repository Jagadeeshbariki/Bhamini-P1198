const fs = require('fs');
let path = 'App.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add import
content = content.replace("import ODKAssetDistribution from './components/ODKAssetDistribution';", "import ODKAssetDistribution from './components/ODKAssetDistribution';\nimport ODKDashboardSection from './components/ODKDashboardSection';");

// Add to validPages
content = content.replace(/odk-asset-distribution', 'staff-attendance'/g, "odk-asset-distribution', 'odk-dashboard', 'staff-attendance'");
content = content.replace(/odk-asset-distribution' \| 'staff-attendance'/g, "odk-asset-distribution' | 'odk-dashboard' | 'staff-attendance'");

// Add render case
content = content.replace(
    "case 'odk-asset-distribution':",
    "case 'odk-dashboard':\n                return <ODKDashboardSection />;\n            case 'odk-asset-distribution':"
);

fs.writeFileSync(path, content);
console.log("Updated App.tsx");

path = 'components/Header.tsx';
content = fs.readFileSync(path, 'utf8');

// We have 2 instances of {canAccessAdmin && <NavLink {...navLinkProps} page="admin">Admin Console</NavLink>}
// We can insert our link right before it.

content = content.replace(
    /\{canAccessAdmin && <NavLink \{\.\.\.navLinkProps\} page="admin">Admin Panel<\/NavLink>\}/,
    "{canAccessAdmin && <NavLink {...navLinkProps} page=\"odk-dashboard\">Data Submission Hub</NavLink>}\n                            {canAccessAdmin && <NavLink {...navLinkProps} page=\"admin\">Admin Panel</NavLink>}"
);

content = content.replace(
    /\{canAccessAdmin && <NavLink \{\.\.\.navLinkProps\} page="admin">Admin Console<\/NavLink>\}/,
    "{canAccessAdmin && <NavLink {...navLinkProps} page=\"odk-dashboard\">Data Submission Hub</NavLink>}\n                        {canAccessAdmin && <NavLink {...navLinkProps} page=\"admin\">Admin Console</NavLink>}"
);

fs.writeFileSync(path, content);
console.log("Updated Header.tsx");
