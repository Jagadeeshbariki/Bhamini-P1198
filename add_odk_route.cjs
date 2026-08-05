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

       const aggregatedForms = [];
       const userStats = {};
       const timeline = {};

       submissionsData.forEach(formItem => {
           const formSubs = Array.isArray(formItem.submissions) ? formItem.submissions : [];
           let latestSubmission = null;
           
           formSubs.forEach(sub => {
               const date = new Date(sub.createdAt);
               const dateStr = date.toISOString().split('T')[0];
               
               if (!latestSubmission || date > new Date(latestSubmission)) {
                   latestSubmission = sub.createdAt;
               }

               const submitterId = sub.submitterId;
               const submitterName = usersMap[submitterId] || \`User \${submitterId}\`;
               if (!userStats[submitterId]) {
                   userStats[submitterId] = { id: submitterId, name: submitterName, total: 0 };
               }
               userStats[submitterId].total += 1;

               if (!timeline[dateStr]) timeline[dateStr] = 0;
               timeline[dateStr] += 1;
           });

           aggregatedForms.push({
               id: formItem.formId,
               name: formItem.formName,
               totalSubmissions: formSubs.length,
               latestSubmission
           });
       });

       const timelineArray = Object.keys(timeline).sort().map(date => ({
           date,
           count: timeline[date]
       }));

       const usersArray = Object.values(userStats).sort((a, b) => b.total - a.total);

       dashboardCache = {
           forms: aggregatedForms.sort((a, b) => b.totalSubmissions - a.totalSubmissions),
           users: usersArray,
           timeline: timelineArray
       };
       dashboardCacheTime = Date.now();

       res.json(dashboardCache);
    } catch(e) {
       console.error("Error fetching ODK dashboard:", e);
       res.status(500).send("Error fetching ODK dashboard data");
    }
  });
`;

code = code.replace('// Generic Proxy Route (for Sheets CSVs, etc.)', routeCode + '\n  // Generic Proxy Route (for Sheets CSVs, etc.)');

fs.writeFileSync(path, code);
console.log("Added ODK dashboard route.");
