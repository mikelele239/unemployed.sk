// Seed 3 job listings WITH lat/lng coordinates so the map hero renders
// Usage: node scripts/seed-3-map-jobs.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Production Safety Guard ──────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production' || process.env.NETLIFY) {
  console.error('\n❌ FATAL: This script must NOT run in production!');
  console.error('Set NODE_ENV=development to proceed.\n');
  process.exit(1);
}

const JOBS = [
  {
    title: 'Marketing Coordinator',
    company: 'Tatra banka',
    description: 'Join the marketing team at one of Slovakia\'s leading banks. You will coordinate digital campaigns across social media, email, and web channels. Collaborate with creative agencies, track campaign performance with analytics dashboards, and help shape our brand voice for the Gen Z audience. A dynamic role with room to grow into a senior marketing position.',
    requirements: 'Degree in Marketing, Communication or related field. Experience with Google Analytics, Meta Business Suite, and email marketing platforms. Strong copywriting skills in Slovak and English. Creativity and attention to detail.',
    location: 'Bratislava',
    type: 'full-time',
    work_model: 'Hybrid',
    rate: '1500',
    rate_unit: '€/mes',
    hours: '40 hod/týždenne',
    tags: ['Marketing', 'Digital', 'Analytics', 'Social Media'],
    status: 'Active',
    duration: 'Trvalý',
    start_date: '2026-06-01',
    lat: 48.1486,
    lng: 17.1077,
  },
  {
    title: 'QA Tester – Stáž',
    company: 'ESET',
    description: 'Staň sa súčasťou QA tímu jednej z najväčších slovenských technologických firiem. Budeš testovať bezpečnostné produkty, písať test cases, reportovať bugy v Jira a spolupracovať s vývojármi na zlepšovaní kvality softvéru. Ideálna príležitosť pre študentov IT, ktorí chcú získať reálne skúsenosti v oblasti kybernetickej bezpečnosti.',
    requirements: 'Základy softvérového testovania (manuálne), logické myslenie, znalosť anglického jazyka (B2+), záujem o kybernetickú bezpečnosť. Výhodou: skúsenosť s Jira, Selenium alebo Postman.',
    location: 'Košice',
    type: 'internship',
    work_model: 'On-site',
    rate: '8.50',
    rate_unit: '€/hod',
    hours: '20 hod/týždenne',
    tags: ['QA Testing', 'Cybersecurity', 'Jira', 'IT'],
    status: 'Active',
    duration: '6 mesiacov',
    start_date: '2026-09-01',
    lat: 48.7164,
    lng: 21.2611,
  },
  {
    title: 'Warehouse Associate – Víkendy',
    company: 'Lidl Slovensko',
    description: 'Hľadáme brigádnikov na víkendové zmeny do nášho distribučného centra. Náplňou práce je príjem a výdaj tovaru, skenovanie produktov, udržiavanie poriadku v sklade a spolupráca s logistickým tímom. Žiadne predchádzajúce skúsenosti nie sú potrebné — poskytneme ti kompletné zaškolenie.',
    requirements: 'Fyzická zdatnosť, spoľahlivosť a dochvíľnosť, ochota pracovať cez víkendy (sobota + nedeľa), vek min. 16 rokov. Skúsenosti so skladovou prácou výhodou, nie podmienkou.',
    location: 'Nitra',
    type: 'part-time',
    work_model: 'On-site',
    rate: '8.00',
    rate_unit: '€/hod',
    hours: '16 hod/týždenne',
    tags: ['Warehouse', 'Logistics', 'Weekend', 'No Experience'],
    status: 'Active',
    duration: 'Trvalý',
    start_date: '2026-05-20',
    lat: 48.3069,
    lng: 18.0864,
  },
];

async function seed() {
  console.log('🌱 Seeding 3 job listings WITH map coordinates...\n');

  // 1. Get first employer to attach jobs to
  const { data: employers, error: empErr } = await sb
    .from('employers')
    .select('id, name')
    .limit(5);

  if (empErr) {
    console.error('❌ Failed to fetch employers:', empErr.message);
    process.exit(1);
  }

  if (!employers || employers.length === 0) {
    console.error('❌ No employers found in the database. Create an employer account first.');
    process.exit(1);
  }

  console.log(`Found ${employers.length} employer(s):`, employers.map(e => `${e.name} (${e.id})`).join(', '));
  const employerId = employers[0].id;
  console.log(`Using employer: ${employers[0].name} (${employerId})\n`);

  // 2. Insert jobs
  let inserted = 0;
  for (const job of JOBS) {
    const row = {
      employer_id: employerId,
      title: job.title,
      company: job.company,
      description: job.description,
      requirements: job.requirements,
      location: job.location,
      type: job.type,
      work_model: job.work_model,
      rate: job.rate,
      rate_unit: job.rate_unit,
      hours: job.hours,
      tags: job.tags,
      status: job.status,
      duration: job.duration,
      start_date: job.start_date,
      lat: job.lat,
      lng: job.lng,
    };

    const { data, error } = await sb.from('jobs').insert(row).select('id, title, lat, lng');
    if (error) {
      console.error(`  ❌ "${job.title}" — ${error.message}`);
    } else {
      inserted++;
      console.log(`  ✅ #${data[0].id}  ${data[0].title}  📍 (${data[0].lat}, ${data[0].lng})`);
    }
  }

  console.log(`\n🎉 Done! Inserted ${inserted}/${JOBS.length} jobs with map coordinates.`);
  process.exit(0);
}

seed();
