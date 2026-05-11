'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LIDL_USER_ID = 'f17af892-2e9b-4526-830a-2724ea0dfd3f';

const JOBS = [
  {
    title: 'Pokladník/Pokladníčka',
    company: 'Lidl',
    description: 'Hľadáme spoľahlivých a komunikatívnych pokladníkov/pokladníčky do našej predajne. Budete zodpovedný/á za obsluhu zákazníkov pri pokladni, skenovanie tovaru, manipuláciu s hotovosťou a kartovými platbami, ako aj za udržiavanie čistoty a poriadku v priestoroch pokladne. Práca v dynamickom tíme s pravidelnými zmenami.',
    requirements: 'Komunikatívnosť a ochota pracovať so zákazníkmi. Zodpovednosť a spoľahlivosť. Základné počítačové zručnosti. Flexibilita pre prácu na zmeny (ranné aj poobedné). Skúsenosti s pokladňou výhodou, nie podmienkou — plne vás zaučíme.',
    location: 'Bratislava - Petržalka',
    lat: 48.1322,
    lng: 17.1073,
    rate: '7.50€',
    rate_unit: '/hod',
    hours: '20-30 hod/týždenne',
    type: 'part-time',
    work_model: 'On-site',
    start_date: '2026-06-01',
    duration: '6 mesiacov',
    tags: ['part-time', 'Retail', 'Zákaznícky servis'],
    status: 'Active',
  },
  {
    title: 'Skladník / Príjem tovaru',
    company: 'Lidl',
    description: 'Zabezpečenie plynulého príjmu tovaru v predajni Lidl. Zodpovednosť za vykladanie dodávok, triedenie a uskladnenie tovaru do regálov podľa interných štandardov. Kontrola množstva a kvality dodaného tovaru. Práca v tíme za dodržiavania hygienických a bezpečnostných predpisov.',
    requirements: 'Fyzická zdatnosť a ochota pracovať manuálne. Zodpovednosť a presnosť. Schopnosť pracovať v chladenom prostredí (sklad mrazených potravín). Tímový hráč. Prax v sklade výhodou.',
    location: 'Košice - Staré Mesto',
    lat: 48.7164,
    lng: 21.2611,
    rate: '8.00€',
    rate_unit: '/hod',
    hours: '25 hod/týždenne',
    type: 'part-time',
    work_model: 'On-site',
    start_date: '2026-06-01',
    duration: '12 mesiacov',
    tags: ['part-time', 'Sklad', 'Logistika'],
    status: 'Active',
  },
  {
    title: 'Brigádnik na predajnú plochu',
    company: 'Lidl',
    description: 'Ideálna brigáda pre študentov! Pomáhaj nášmu tímu s dopĺňaním tovaru na predajnú plochu, kontrolou čerstvosti výrobkov a údržbou regálov. Zabezpečíš, aby zákazníci vždy našli plné police a čistú predajňu. Flexibilný rozvrh prispôsobený tvojmu štúdiu.',
    requirements: 'Vek minimálne 16 rokov. Ochota učiť sa a pracovať v tíme. Flexibilita — možnosť pracovať aj cez víkendy. Pozitívny prístup a zákaznícka orientácia. Žiadne predchádzajúce skúsenosti nie sú potrebné.',
    location: 'Žilina - Vlčince',
    lat: 49.2194,
    lng: 18.7408,
    rate: '7.00€',
    rate_unit: '/hod',
    hours: '15-20 hod/týždenne',
    type: 'part-time',
    work_model: 'On-site',
    start_date: '2026-06-15',
    duration: '3 mesiace (letná brigáda)',
    tags: ['part-time', 'Retail', 'Študenti'],
    status: 'Active',
  },
  {
    title: 'Stážista/ka v oblasti marketingu',
    company: 'Lidl',
    description: 'Získaj reálnu prax v marketingovom oddelení jedného z najväčších retailerov v Európe! Budeš sa podieľať na príprave kampaní pre sociálne médiá, tvorbe obsahu pre interné a externé kanály, analýze zákazníckych dát a podpore pri organizácii eventov. Príležitosť naučiť sa pracovať s nástrojmi ako Meta Business Suite, Canva a Google Analytics.',
    requirements: 'Študent/ka VŠ — odbor marketing, komunikácia alebo príbuzný. Kreatívne myslenie a záujem o digitálny marketing. Znalosť slovenčiny na úrovni C1+ a angličtiny B2+. Základné skúsenosti so sociálnymi sieťami (Instagram, TikTok, LinkedIn). Znalosť grafických nástrojov (Canva, Figma) je výhodou.',
    location: 'Bratislava - Ružinov (Centrála)',
    lat: 48.1486,
    lng: 17.1678,
    rate: '8.50€',
    rate_unit: '/hod',
    hours: '20 hod/týždenne',
    type: 'internship',
    work_model: 'Hybrid',
    start_date: '2026-07-01',
    duration: '6 mesiacov',
    tags: ['internship', 'Marketing', 'Hybrid'],
    status: 'Active',
  },
  {
    title: 'IT Support Intern',
    company: 'Lidl',
    description: 'Staň sa súčasťou IT tímu Lidl Slovensko! Budeš pomáhať s riešením IT požiadaviek zamestnancov (helpdesk), správou hardvéru v predajniach, nastavovaním pracovných staníc a základnou diagnostikou sieťových problémov. Ideálna príležitosť pre IT študentov, ktorí chcú získať prax v korporátnom prostredí.',
    requirements: 'Študent/ka informatiky, IT alebo príbuzného odboru. Základné znalosti Windows, sietí a hardvéru. Komunikatívnosť a trpezlivosť pri riešení problémov. Vodičský preukaz skupiny B výhodou (návštevy predajní). Angličtina na úrovni B1+.',
    location: 'Bratislava - Ružinov (Centrála)',
    lat: 48.1486,
    lng: 17.1678,
    rate: '9.00€',
    rate_unit: '/hod',
    hours: '20 hod/týždenne',
    type: 'internship',
    work_model: 'Hybrid',
    start_date: '2026-06-15',
    duration: '6 mesiacov',
    tags: ['internship', 'IT & Tech', 'Hybrid'],
    status: 'Active',
  },
  {
    title: 'Pomocník v pekárni',
    company: 'Lidl',
    description: 'Pridaj sa k nášmu tímu v pekárskej sekcii! Tvoja úloha bude pripravovať čerstvé pečivo pre zákazníkov — od pečenia zamrazených polotovarov, cez balenie a označovanie, až po dopĺňanie pečiva do výkladov. Práca v príjemnom prostredí s vôňou čerstvého chleba každý deň.',
    requirements: 'Zmysel pre čistotu a hygienu. Ochota pracovať v ranných hodinách (od 5:00). Fyzická zdatnosť. Spoľahlivosť a samostatnosť. Zdravotný preukaz (pomôžeme s vybavením).',
    location: 'Banská Bystrica - centrum',
    lat: 48.7395,
    lng: 19.1530,
    rate: '7.80€',
    rate_unit: '/hod',
    hours: '20-25 hod/týždenne',
    type: 'part-time',
    work_model: 'On-site',
    start_date: '2026-06-01',
    duration: 'Dlhodobo',
    tags: ['part-time', 'Gastro', 'Pekáreň'],
    status: 'Active',
  },
  {
    title: 'Stážista/ka — Supply Chain & Logistika',
    company: 'Lidl',
    description: 'Jedinečná stáž v logistickom centre Lidl! Získaš prehľad o celom dodávateľskom reťazci — od objednávania tovaru, cez plánovanie distribúcie, až po analýzu efektivity. Budeš pracovať s modernými WMS systémami, spracovávať reporty a podieľať sa na optimalizačných projektoch. Reálna skúsenosť v jednom z najefektívnejších supply chain v Európe.',
    requirements: 'Študent/ka logistiky, ekonómie, priemyselného inžinierstva alebo príbuzného odboru. Analytické myslenie a práca s Excelom na pokročilej úrovni. Angličtina alebo nemčina na úrovni B2+. Záujem o retail a logistické procesy. Proaktivita a schopnosť pracovať samostatne.',
    location: 'Sereď (Logistické centrum)',
    lat: 48.2847,
    lng: 17.7311,
    rate: '9.50€',
    rate_unit: '/hod',
    hours: '30 hod/týždenne',
    type: 'internship',
    work_model: 'On-site',
    start_date: '2026-07-01',
    duration: '6 mesiacov',
    tags: ['internship', 'Logistika', 'Supply Chain'],
    status: 'Active',
  },
  {
    title: 'Promotér/ka pri otvorení novej predajne',
    company: 'Lidl',
    description: 'Hľadáme energických promotérov na podporu grand openingu novej predajne Lidl v Nitre! Budeš rozdávať letáky, navigovať zákazníkov, pomáhať s organizáciou otváracieho eventu a reprezentovať značku Lidl. Krátkodobá, ale intenzívna a dobre zaplatená príležitosť s bonusmi.',
    requirements: 'Výborné komunikačné schopnosti a pozitívna energia. Reprezentatívny vzhľad. Dostupnosť počas celého otvárania (3 dni). Skúsenosti s promo akciami výhodou. Vek minimálne 18 rokov.',
    location: 'Nitra - Čermáň',
    lat: 48.3069,
    lng: 18.0935,
    rate: '10.00€',
    rate_unit: '/hod',
    hours: '8 hod/deň (3 dni)',
    type: 'gig',
    work_model: 'On-site',
    start_date: '2026-06-20',
    duration: '3 dni',
    tags: ['gig', 'Promo', 'Event'],
    status: 'Active',
  },
];

(async () => {
  try {
    // 1. Fix Lidl employer profile
    console.log('1. Updating Lidl employer profile...');
    await sb.from('employers').upsert({
      id: LIDL_USER_ID,
      name: 'Lidl',
      description: 'Lidl je medzinárodný diskontný reťazec s potravinami, pôsobiaci vo viac ako 30 krajinách Európy. Na Slovensku prevádzkujeme vyše 160 predajní a 3 logistické centrá. Ponúkame stabilné zamestnanie, férové podmienky a príležitosti pre študentov aj absolventov.',
      website: 'https://www.lidl.sk',
      location: 'Bratislava, Slovensko',
    }, { onConflict: 'id' });

    // Ensure role
    await sb.from('user_roles').upsert({ user_id: LIDL_USER_ID, role: 'employer' }, { onConflict: 'user_id' });
    console.log('   ✅ Lidl profile and role set');

    // 2. Delete ALL existing jobs
    console.log('2. Deleting all existing jobs...');
    const { data: existingJobs } = await sb.from('jobs').select('id');
    if (existingJobs && existingJobs.length > 0) {
      const ids = existingJobs.map(j => j.id);
      // Delete related data first
      await sb.from('match_scores').delete().in('job_id', ids);
      await sb.from('job_match_criteria').delete().in('job_id', ids);
      await sb.from('applications').delete().in('job_id', ids);
      await sb.from('jobs').delete().in('id', ids);
      console.log(`   ✅ Deleted ${ids.length} jobs and related data`);
    } else {
      console.log('   ℹ️  No existing jobs to delete');
    }

    // 3. Insert Lidl jobs
    console.log('3. Creating 8 Lidl job listings...');
    for (const job of JOBS) {
      const { data, error } = await sb.from('jobs').insert({
        ...job,
        employer_id: LIDL_USER_ID,
      }).select().single();

      if (error) {
        console.error(`   ❌ Failed: ${job.title} — ${error.message}`);
      } else {
        console.log(`   ✅ ${job.title} (ID: ${data.id}) — ${job.location}`);
      }
    }

    // 4. Trigger match recalculation for all students
    console.log('4. Recalculating match scores...');
    const { data: profiles } = await sb.from('ai_profiles').select('user_id');
    const { data: allJobs } = await sb.from('jobs').select('*').eq('status', 'Active');

    if (profiles && profiles.length > 0 && allJobs && allJobs.length > 0) {
      const { calculateCandidateJobMatch } = require('./lib/matching-engine');
      let count = 0;
      for (const p of profiles) {
        const { data: aiProfile } = await sb.from('ai_profiles').select('*').eq('user_id', p.user_id).maybeSingle();
        if (!aiProfile) continue;

        for (const job of allJobs) {
          try {
            const result = calculateCandidateJobMatch(aiProfile, job);
            await sb.from('match_scores').upsert({
              user_id: p.user_id,
              job_id: job.id,
              overall_score: result.overall_score,
              dimension_scores: result.dimension_scores,
              top_reasons: result.top_reasons || [],
              gaps: result.gaps || [],
              insights: result.insights || [],
              eligible: result.eligible !== false,
              matched_at: new Date().toISOString(),
            }, { onConflict: 'user_id,job_id' });
            count++;
          } catch (e) {}
        }
      }
      console.log(`   ✅ Recalculated ${count} match scores`);
    }

    console.log('\n🎉 Done! 8 Lidl jobs created. Ready for demo.');

  } catch (err) {
    console.error('Error:', err);
  }
})();
