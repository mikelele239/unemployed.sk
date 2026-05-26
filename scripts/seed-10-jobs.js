// Seed 10 random job listings into Supabase
// Usage: node scripts/seed-10-jobs.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const JOBS = [
  {
    title: 'Social Media Manager',
    company: 'Pixel Studio',
    description: 'We are looking for a creative Social Media Manager to join our growing digital agency. You will plan and execute social media campaigns across Instagram, TikTok, and LinkedIn. The ideal candidate has a passion for storytelling, excellent copywriting skills, and experience with analytics tools like Meta Business Suite.',
    requirements: 'Experience with social media scheduling tools, basic graphic design skills (Canva/Figma), strong written communication in English and Slovak, portfolio of previous campaigns.',
    location: 'Bratislava',
    type: 'full-time',
    work_model: 'Hybrid',
    rate: '1200',
    rate_unit: '€/mes',
    hours: '40 hod/týždenne',
    tags: ['Social Media', 'Marketing', 'Content Creation', 'Analytics'],
    status: 'Active',
    duration: '12 mesiacov',
    start_date: '2026-05-15',
  },
  {
    title: 'Junior Backend Developer',
    company: 'CodeNest s.r.o.',
    description: 'Join our engineering team and help build scalable APIs and microservices using Node.js and PostgreSQL. You will work in an agile environment with experienced mentors who will guide your growth. We value clean code, thorough testing, and continuous learning.',
    requirements: 'JavaScript/TypeScript, Node.js basics, SQL fundamentals, Git version control, REST API concepts. Bonus: Docker, AWS, CI/CD pipelines.',
    location: 'Košice',
    type: 'full-time',
    work_model: 'Remote',
    rate: '1600',
    rate_unit: '€/mes',
    hours: '40 hod/týždenne',
    tags: ['Node.js', 'Backend', 'PostgreSQL', 'API Development'],
    status: 'Active',
    duration: 'Trvalý',
    start_date: '2026-07-01',
  },
  {
    title: 'Grafický dizajnér – stáž',
    company: 'BrandForge',
    description: 'Kreatívna stáž pre študentov dizajnu. Budete spolupracovať na brandingových projektoch, vytvárať vizuálne identity, sociálne grafiky a tlačové materiály. Ideálna príležitosť získať reálne skúsenosti v agentúrnom prostredí.',
    requirements: 'Adobe Creative Suite (Photoshop, Illustrator), základy typografie a kompozície, kreativita a ochota učiť sa, portfólio (aj školské práce).',
    location: 'Bratislava',
    type: 'internship',
    work_model: 'On-site',
    rate: '7.50',
    rate_unit: '€/hod',
    hours: '20 hod/týždenne',
    tags: ['Design', 'Adobe', 'Branding', 'Creative'],
    status: 'Active',
    duration: '6 mesiacov',
    start_date: '2026-09-01',
  },
  {
    title: 'Customer Support Specialist',
    company: 'HelpDesk Pro',
    description: 'Be the first point of contact for our SaaS customers. Handle inbound queries via chat, email, and video calls. You will troubleshoot issues, escalate bugs, and contribute to our knowledge base. We offer flexible hours and a supportive, remote-first culture.',
    requirements: 'Excellent communication in English (C1+), empathy and patience, basic tech literacy, experience with ticketing systems (Zendesk, Freshdesk) is a plus.',
    location: 'Žilina',
    type: 'part-time',
    work_model: 'Remote',
    rate: '9.00',
    rate_unit: '€/hod',
    hours: '25 hod/týždenne',
    tags: ['Customer Support', 'SaaS', 'Remote', 'English'],
    status: 'Active',
    duration: 'Trvalý',
    start_date: '2026-05-20',
  },
  {
    title: 'Data Analyst Intern',
    company: 'InsightLab',
    description: 'Dive into real-world datasets and help our team uncover actionable business insights. You will clean and transform data, build dashboards in Looker Studio, and present findings to stakeholders. A strong foundation in statistics and curiosity for patterns is essential.',
    requirements: 'Python or R basics, SQL queries, Google Sheets/Excel proficiency, familiarity with data visualization tools, enrolled in a relevant university program.',
    location: 'Banská Bystrica',
    type: 'internship',
    work_model: 'Hybrid',
    rate: '8.00',
    rate_unit: '€/hod',
    hours: '20 hod/týždenne',
    tags: ['Data Analysis', 'Python', 'SQL', 'Dashboards'],
    status: 'Active',
    duration: '4 mesiace',
    start_date: '2026-10-01',
  },
  {
    title: 'UX/UI Designer',
    company: 'Apptive Digital',
    description: 'Design beautiful, user-centered interfaces for mobile and web applications. You will conduct user research, create wireframes and prototypes in Figma, and collaborate closely with developers to ship pixel-perfect designs. We believe in iterative design and data-driven decisions.',
    requirements: 'Strong Figma skills, understanding of UX principles and accessibility, ability to create design systems, portfolio showcasing mobile and web projects.',
    location: 'Bratislava',
    type: 'full-time',
    work_model: 'Hybrid',
    rate: '1800',
    rate_unit: '€/mes',
    hours: '40 hod/týždenne',
    tags: ['UX', 'UI Design', 'Figma', 'Prototyping'],
    status: 'Active',
    duration: 'Trvalý',
    start_date: '2026-08-01',
  },
  {
    title: 'Účtovný asistent',
    company: 'FinServe Group',
    description: 'Hľadáme spoľahlivého asistenta do účtovného oddelenia. Budete pomáhať s evidenciou faktúr, účtovných dokladov, prípravou podkladov pre daňové priznania a komunikáciou s klientmi. Vhodné pre absolventov ekonomických škôl.',
    requirements: 'Základy podvojného účtovníctva, MS Excel (pokročilý), spoľahlivosť a presnosť, znalosť slovenskej legislatívy výhodou.',
    location: 'Nitra',
    type: 'full-time',
    work_model: 'On-site',
    rate: '1100',
    rate_unit: '€/mes',
    hours: '40 hod/týždenne',
    tags: ['Účtovníctvo', 'Finance', 'Excel', 'Administratíva'],
    status: 'Active',
    duration: 'Trvalý',
    start_date: '2026-06-01',
  },
  {
    title: 'Content Writer (EN/SK)',
    company: 'MediaVox',
    description: 'Write compelling blog posts, case studies, and website copy for our diverse portfolio of B2B clients. You will research industry topics, optimize content for SEO, and maintain a consistent brand voice. Bilingual fluency in English and Slovak is required.',
    requirements: 'Native or C2 English, strong Slovak writing, SEO fundamentals, experience with WordPress or CMS platforms, ability to meet deadlines consistently.',
    location: 'Trnava',
    type: 'part-time',
    work_model: 'Remote',
    rate: '10.00',
    rate_unit: '€/hod',
    hours: '20 hod/týždenne',
    tags: ['Writing', 'SEO', 'Content', 'Bilingual'],
    status: 'Active',
    duration: '6 mesiacov',
    start_date: '2026-07-15',
  },
  {
    title: 'Project Coordinator',
    company: 'BuildRight Engineering',
    description: 'Coordinate cross-functional teams on construction and infrastructure projects. You will manage timelines, track deliverables in project management tools, prepare status reports, and facilitate client meetings. A great stepping stone into project management.',
    requirements: 'Organizational skills, MS Project or Asana experience, basic understanding of construction processes, strong communication, driving license B.',
    location: 'Prešov',
    type: 'full-time',
    work_model: 'On-site',
    rate: '1400',
    rate_unit: '€/mes',
    hours: '40 hod/týždenne',
    tags: ['Project Management', 'Construction', 'Planning', 'Communication'],
    status: 'Active',
    duration: 'Trvalý',
    start_date: '2026-09-15',
  },
  {
    title: 'Mobile App Developer (React Native)',
    company: 'Appify Studios',
    description: 'Build cross-platform mobile apps using React Native and Expo. You will ship features end-to-end — from UI implementation to API integration and App Store deployment. We are a small, fast-moving startup where your work has immediate impact.',
    requirements: 'React Native experience, JavaScript/TypeScript, familiarity with REST/GraphQL APIs, App Store/Google Play publishing basics, Redux or Zustand state management.',
    location: 'Bratislava',
    type: 'full-time',
    work_model: 'Remote',
    rate: '2200',
    rate_unit: '€/mes',
    hours: '40 hod/týždenne',
    tags: ['React Native', 'Mobile', 'JavaScript', 'Startup'],
    status: 'Active',
    duration: 'Trvalý',
    start_date: '2026-05-19',
  },
];

async function seed() {
  console.log('🌱 Seeding 10 job listings...\n');

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
    };

    const { data, error } = await sb.from('jobs').insert(row).select('id, title');
    if (error) {
      console.error(`  ❌ "${job.title}" — ${error.message}`);
    } else {
      inserted++;
      console.log(`  ✅ #${data[0].id}  ${data[0].title}`);
    }
  }

  console.log(`\n🎉 Done! Inserted ${inserted}/${JOBS.length} jobs.`);
  process.exit(0);
}

seed();
