-- Seed realistic test jobs with match criteria
-- Run this in Supabase SQL editor

-- First, get the employer user ID (adjust email if needed)
DO $$
DECLARE
  employer_id UUID;
  job1_id BIGINT;
  job2_id BIGINT;
  job3_id BIGINT;
BEGIN
  -- Get employer from employers table (jobs FK references employers, not auth.users)
  SELECT id INTO employer_id FROM public.employers LIMIT 1;
  
  IF employer_id IS NULL THEN
    RAISE NOTICE 'No employer found in employers table! Create an employer account first.';
    RETURN;
  END IF;

  RAISE NOTICE 'Using employer_id: %', employer_id;

  -- Job 1: Marketing Internship in Bratislava
  INSERT INTO public.jobs (employer_id, company, title, description, location, type, work_model, rate, hours, status)
  VALUES (
    employer_id,
    'Demo Marketing s.r.o.',
    'Marketingový stážista',
    'Hľadáme šikovného stážistu na marketingové oddelenie. Úlohy zahŕňajú správu sociálnych sietí, tvorbu obsahu, analýzu kampaní a podporu marketingového tímu. Ideálny kandidát má skúsenosti s digitálnym marketingom a analytickým myslením.',
    'Bratislava',
    'internship',
    'Hybrid',
    '8.00',
    '20 hod/týždenne',
    'Active'
  ) RETURNING id INTO job1_id;

  INSERT INTO public.job_match_criteria (job_id, required_skills, preferred_skills, min_education_level, preferred_fields, min_experience_years, required_languages, industry, weight_skills, weight_education, weight_experience, weight_location, weight_language)
  VALUES (
    job1_id,
    ARRAY['social media', 'content creation'],
    ARRAY['google analytics', 'canva', 'excel', 'seo', 'copywriting'],
    'bachelors',
    ARRAY['marketing', 'economics', 'business', 'communication'],
    0,
    '[{"lang": "Angličtina", "min_level": "B2"}, {"lang": "Slovenčina", "min_level": "B1"}]'::jsonb,
    'Marketing',
    3, 2, 1, 3, 2
  );

  -- Job 2: Junior Frontend Developer (Remote)
  INSERT INTO public.jobs (employer_id, company, title, description, location, type, work_model, rate, hours, status)
  VALUES (
    employer_id,
    'TechStart s.r.o.',
    'Junior Frontend Developer',
    'Hľadáme junior frontend developera do nášho produktového tímu. Budete pracovať s React, TypeScript a moderným CSS. Požadujeme základné znalosti Git a schopnosť pracovať v agilnom tíme.',
    'Bratislava',
    'full-time',
    'Remote',
    '1400',
    '40 hod/týždenne',
    'Active'
  ) RETURNING id INTO job2_id;

  INSERT INTO public.job_match_criteria (job_id, required_skills, preferred_skills, min_education_level, preferred_fields, min_experience_years, required_languages, industry, weight_skills, weight_education, weight_experience, weight_location, weight_language)
  VALUES (
    job2_id,
    ARRAY['javascript', 'react', 'html', 'css'],
    ARRAY['typescript', 'git', 'node.js', 'figma', 'tailwindcss'],
    'high_school',
    ARRAY['computer science', 'software engineering', 'informatics'],
    0,
    '[{"lang": "Angličtina", "min_level": "B2"}]'::jsonb,
    'IT',
    4, 1, 2, 1, 2
  );

  -- Job 3: Business Development Intern (Košice, on-site)
  INSERT INTO public.jobs (employer_id, company, title, description, location, type, work_model, rate, hours, status)
  VALUES (
    employer_id,
    'BizGrow a.s.',
    'Obchodný stážista',
    'Pridajte sa k nášmu obchodnému tímu v Košiciach. Budete pomáhať s prieskumom trhu, prípravou prezentácií, komunikáciou s klientmi a správou CRM systému. Výborná príležitosť pre ambicióznych študentov ekonomiky.',
    'Košice',
    'internship',
    'On-site',
    '7.50',
    '20 hod/týždenne',
    'Active'
  ) RETURNING id INTO job3_id;

  INSERT INTO public.job_match_criteria (job_id, required_skills, preferred_skills, min_education_level, preferred_fields, min_experience_years, required_languages, industry, weight_skills, weight_education, weight_experience, weight_location, weight_language)
  VALUES (
    job3_id,
    ARRAY['communication', 'excel'],
    ARRAY['powerpoint', 'crm', 'market research', 'negotiation', 'sales'],
    'high_school',
    ARRAY['economics', 'business', 'management', 'international relations'],
    0,
    '[{"lang": "Slovenčina", "min_level": "C1"}, {"lang": "Angličtina", "min_level": "B1"}]'::jsonb,
    'Obchod',
    3, 2, 1, 3, 2
  );

  RAISE NOTICE 'Created 3 test jobs with criteria: IDs %, %, %', job1_id, job2_id, job3_id;
END $$;
