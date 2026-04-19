export const CANDIDATES = [
  { id: 1, name:'Anna Kováčová', student_name:'Anna Kováčová', initials:'AK', color:'#8B5CF6', student_profile: { school:'STU Bratislava', field:'Marketing', badges: [{id: 'verified', label: 'Overený', color: '#10B981'}, {id: 'responsive', label: 'Rýchla odozva', color: '#3B82F6'}] }, match:96, skills:['Komunikatívna','Kreatívna','Tímová hráčka'] },
  { id: 2, name:'Tomáš Horváth', student_name:'Tomáš Horváth', initials:'TH', color:'#3B82F6', student_profile: { school:'UK Bratislava', field:'Ekonómia', badges: [{id: 'verified', label: 'Overený', color: '#10B981'}] }, match:91, skills:['Analytický','Spoľahlivý','Detailista'] },
  { id: 3, name:'Lucia Szabóová', student_name:'Lucia Szabóová', initials:'LS', color:'#10B981', student_profile: { school:'TUKE Košice', field:'IT', badges: [{id: 'top_match', label: 'Top 10%', color: '#FF5C00'}, {id: 'verified', label: 'Overený', color: '#10B981'}] }, match:89, skills:['Rýchlo sa učí','Tímová hráčka','Riešiteľka'] },
  { id: 4, name:'Martin Novák', student_name:'Martin Novák', initials:'MN', color:'#F59E0B', student_profile: { school:'ŽU Žilina', field:'Manažment', badges: [] }, match:87, skills:['Líder','Komunikatívny','Spoľahlivý'] },
  { id: 5, name:'Petra Miklošová', student_name:'Petra Miklošová', initials:'PM', color:'#EF4444', student_profile: { school:'UMB B. Bystrica', field:'Psychológia', badges: [{id: 'responsive', label: 'Rýchla odozva', color: '#3B82F6'}] }, match:84, skills:['Empatická','Komunikatívna','Kreatívna'] },
  { id: 6, name:'Jakub Kučera', student_name:'Jakub Kučera', initials:'JK', color:'#FF5C00', student_profile: { school:'FIIT STU', field:'Informatika', badges: [{id: 'verified', label: 'Overený', color: '#10B981'}, {id: 'top_match', label: 'Top 10%', color: '#FF5C00'}, {id: 'responsive', label: 'Rýchla odozva', color: '#3B82F6'}] }, match:93, skills:['Analytický','Rýchlo sa učí','Detailista'] }
];

export const AI_MATCHES = [
  { id: 1, name:'Anna Kováčová', initials:'AK', color:'#8B5CF6', position:'Marketing Intern', score:96, reason_sk:'Študuje marketing na STU, má skúsenosti s obsahovým marketingom a sociálnymi sieťami.', reason_en:'Studies marketing at STU, experienced in content marketing and social media.', student_profile: { school:'STU Bratislava', field:'Marketing', badges: [{id: 'verified', label: 'Overený', color: '#10B981'}] } },
  { id: 6, name:'Jakub Kučera', initials:'JK', color:'#FF5C00', position:'Junior Developer', score:93, reason_sk:'Študent FIIT so skúsenosťami v React a Node.js. Silné analytické zručnosti.', reason_en:'FIIT student experienced in React and Node.js. Strong analytical skills.', student_profile: { school:'FIIT STU', field:'Informatika', badges: [{id: 'verified', label: 'Overený', color: '#10B981'}, {id: 'top_match', label: 'Top 10%', color: '#FF5C00'}] } },
  { id: 2, name:'Tomáš Horváth', initials:'TH', color:'#3B82F6', position:'Data Analyst Intern', score:91, reason_sk:'Ekonóm so zameraním na dáta. Ovláda Excel, SQL a základy Pythonu.', reason_en:'Economics student with data focus. Proficient in Excel, SQL and Python basics.', student_profile: { school:'UK Bratislava', field:'Ekonómia', badges: [{id: 'verified', label: 'Overený', color: '#10B981'}] } },
  { id: 3, name:'Lucia Szabóová', initials:'LS', color:'#10B981', position:'QA Tester', score:89, reason_sk:'IT študentka so zmyslom pre detail. Skúsenosti s automatizovaným testovaním.', reason_en:'IT student with attention to detail. Experience with automated testing.', student_profile: { school:'TUKE Košice', field:'IT', badges: [] } }
];

export const INITIAL_LISTINGS = [
  { id: 1, title: 'Marketingový stážista', title_en: 'Marketing Intern', type: 'internship', location: 'Bratislava', status: 'Active', views: 342, applications: 18, date: '2023-10-15' },
  { id: 2, title: 'Junior Data Analyst', title_en: 'Junior Data Analyst', type: 'full-time', location: 'Košice', status: 'Active', views: 185, applications: 12, date: '2023-10-18' },
  { id: 3, title: 'Barista (Víkendy)', title_en: 'Weekend Barista', type: 'part-time', location: 'Bratislava', status: 'Draft', views: 0, applications: 0, date: '2023-10-22' }
];

export const CHART_DATA = [12, 18, 9, 24, 31, 22, 16];
