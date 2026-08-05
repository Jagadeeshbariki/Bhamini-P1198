const fs = require('fs');
const path = 'server.ts';
let code = fs.readFileSync(path, 'utf8');

const routeCode = `
  let dashboardCache = null;
  let dashboardCacheTime = 0;

  app.get("/api/odk/dashboard", async (req, res) => {
    if (dashboardCache && Date.now() - dashboardCacheTime < 300000) {
       return res.json(dashboardCache);
    }

    try {
       const token = await getOdkToken();
       
       const formRes = await fetch('https://central.wassan.org/v1/projects/3/forms', {
         headers: { 'Authorization': \`Bearer \${token}\` }
       });
       const forms = await formRes.json();

       const appUsersRes = await fetch('https://central.wassan.org/v1/projects/3/app-users', {
         headers: { 'Authorization': \`Bearer \${token}\` }
       });
       const appUsers = await appUsersRes.json();
       const usersMap = {};
       appUsers.forEach(u => usersMap[u.id] = u.displayName);

       const submissionsData = await Promise.all(forms.map(async (form) => {
           const subRes = await fetch(\`https://central.wassan.org/v1/projects/3/forms/\${encodeURIComponent(form.xmlFormId)}/submissions\`, {
             headers: { 'Authorization': \`Bearer \${token}\` }
           });
           const subs = await subRes.json();
           return { formId: form.xmlFormId, formName: form.name, submissions: subs };
       }));

       const rawSubmissions = [];
       const formsList = [];

       submissionsData.forEach(formItem => {
           const formSubs = Array.isArray(formItem.submissions) ? formItem.submissions : [];
           formsList.push({ id: formItem.formId, name: formItem.formName });
           
           formSubs.forEach(sub => {
               rawSubmissions.push({
                   formId: formItem.formId,
                   userId: sub.submitterId,
                   date: sub.createdAt
               });
           });
       });

       const usersList = Object.keys(usersMap).map(id => ({ id: Number(id), name: usersMap[id] }));

       dashboardCache = {
           rawSubmissions,
           forms: formsList,
           users: usersList
       };
       dashboardCacheTime = Date.now();

       res.json(dashboardCache);
    } catch(e) {
       console.error("Error fetching ODK dashboard:", e);
       res.status(500).send("Error fetching ODK dashboard data");
    }
  });
`;

code = code.replace(/let dashboardCache = null;[\s\S]*?res\.status\(500\)\.send\("Error fetching ODK dashboard data"\);\n    }\n  }\);/g, routeCode.trim());

fs.writeFileSync(path, code);
console.log("Updated ODK dashboard route to send raw data.");
