const email = process.env.ODK_EMAIL;
const password = process.env.ODK_PASSWORD;

async function test() {
  const res = await fetch('https://central.wassan.org/v1/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  const token = data.token;
  
  const formRes = await fetch('https://central.wassan.org/v1/projects/3/forms', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const forms = await formRes.json();
  
  const appUsersRes = await fetch('https://central.wassan.org/v1/projects/3/app-users', {
       headers: { 'Authorization': `Bearer ${token}` }
  });
  const appUsers = await appUsersRes.json();
  const usersMap = {};
  appUsers.forEach(u => usersMap[u.id] = u.displayName);

  const submissionsData = [];
  for (let form of forms) {
      const subRes = await fetch(`https://central.wassan.org/v1/projects/3/forms/${encodeURIComponent(form.xmlFormId)}/submissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const subs = await subRes.json();
      submissionsData.push({ formId: form.xmlFormId, formName: form.name, submissions: subs });
  }

  const aggregatedForms = [];
  const userStats = {};
  const timeline = {};

  submissionsData.forEach(formItem => {
      const formSubs = Array.isArray(formItem.submissions) ? formItem.submissions : [];
      let latestSubmission = null;
      
      formSubs.forEach(sub => {
          const date = new Date(sub.createdAt);
          const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
          
          if (!latestSubmission || date > new Date(latestSubmission)) {
              latestSubmission = sub.createdAt;
          }

          const submitterId = sub.submitterId;
          const submitterName = usersMap[submitterId] || `User ${submitterId}`;
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
  
  console.log('Forms:', aggregatedForms.length);
  console.log('Top Users:', usersArray.slice(0, 3));
  console.log('Timeline latest:', timelineArray.slice(-3));
}
test();
