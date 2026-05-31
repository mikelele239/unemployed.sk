// Reparse existing CVs using GPT-4o-mini (with rule-based fallback)
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { PDFParse } = require('pdf-parse');
const { parseWithAI } = require('../lib/ai-cv-parser');
const { calculateProfileCompletion } = require('../lib/matching-engine');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Production Safety Guard ──────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production' || process.env.NETLIFY) {
  console.error('\n❌ FATAL: This script must NOT run in production!');
  console.error('Set NODE_ENV=development to proceed.\n');
  process.exit(1);
}

async function parsePdfBuffer(buf) {
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  return (result?.text || '').trim();
}

async function reparseAll() {
  console.log('Fetching profiles with CVs...');
  console.log('API key:', process.env.OPENAI_API_KEY ? '✓ present' : '✗ missing (will use rule-based fallback)');
  
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('user_id, cv_id, first_name, last_name, location, skills')
    .not('cv_id', 'is', null);

  if (error) { console.error('Error fetching profiles:', error.message); return; }
  if (!profiles?.length) { console.log('No profiles with CVs found.'); return; }

  console.log(`Found ${profiles.length} profile(s) with CVs.\n`);

  for (const profile of profiles) {
    console.log(`Processing ${profile.first_name} ${profile.last_name} (${profile.user_id})...`);

    try {
      // Download CV from storage
      const { data: fileData, error: dlErr } = await supabase.storage
        .from('cvs').download(profile.cv_id);
      
      if (dlErr || !fileData) {
        console.log(`  ❌ Download failed: ${dlErr?.message || 'no data'}`);
        continue;
      }

      const buf = Buffer.from(await fileData.arrayBuffer());
      console.log(`  📄 Downloaded ${buf.length} bytes`);

      // Parse PDF text
      const rawText = await parsePdfBuffer(buf);
      console.log(`  📝 Extracted ${rawText.length} chars of text`);

      if (rawText.length < 50) {
        console.log('  ⚠️ Too little text — skipping');
        continue;
      }

      // Parse with GPT-4o-mini (auto-fallback to rule-based)
      const existingData = {
        full_name: `${profile.first_name||''} ${profile.last_name||''}`.trim() || null,
        location: profile.location,
        skills: profile.skills,
      };

      const parsed = await parseWithAI(rawText, existingData);

      console.log(`  🔍 Source: ${parsed._source} | Confidence: ${parsed.confidence_score}`);
      console.log(`  Skills: ${parsed.hard_skills?.length || 0} hard, ${parsed.soft_skills?.length || 0} soft`);
      console.log(`  Languages: ${parsed.languages?.length || 0}`);
      console.log(`  Education: ${parsed.education_level} / ${parsed.education_field}`);
      console.log(`  Experience: ${parsed.experience_years} years`);
      console.log(`  Name: ${parsed.full_name || 'not detected'}`);
      console.log(`  🤖 Headline: ${parsed.ai_headline}`);

      const parseStatus = parsed.confidence_score >= 0.5 ? 'ready' : 'needs_review';

      const aiData = {
        user_id: profile.user_id,
        full_name: parsed.full_name,
        email: parsed.email,
        phone: parsed.phone,
        location: parsed.location,
        hard_skills: parsed.hard_skills?.length > 0 ? parsed.hard_skills : (profile.skills || []),
        soft_skills: parsed.soft_skills,
        languages: parsed.languages,
        experience_years: parsed.experience_years,
        education_level: parsed.education_level,
        education_field: parsed.education_field,
        education_school: parsed.education_school,
        certifications: parsed.certifications || [],
        preferred_locations: parsed.location ? [parsed.location] : [],
        parse_status: parseStatus,
        extraction_source: parsed._source === 'openai' ? 'ai_llm' : 'cv_parse',
        extraction_version: '3.0',
        raw_cv_text: rawText.substring(0, 50000),
        confidence_score: parsed.confidence_score,
        ai_headline: parsed.ai_headline,
        ai_summary: parsed.ai_summary,
        ai_portfolio_intro: parsed.ai_portfolio_intro,
        ai_strengths: parsed.ai_strengths,
        ai_development_areas: parsed.ai_development_areas,
        ai_suggested_roles: parsed.ai_suggested_roles,
        ai_suggested_categories: parsed.ai_suggested_categories,
        ai_missing_fields: parsed.ai_missing_fields || [],
        ai_profile_quality_notes: parsed.ai_profile_quality_notes || [],
        ai_normalized_skills: parsed.ai_normalized_skills || parsed.hard_skills,
        experience_level: ({ entry: 'beginner', junior: 'junior', mid: 'experienced', senior: 'experienced' })[parsed.experience_level] || 'unknown',
        ai_profile_approved: false,
        ai_generated_at: new Date().toISOString(),
        profile_completion_score: 0,
        updated_at: new Date().toISOString(),
      };

      const completion = calculateProfileCompletion(aiData);
      aiData.profile_completion_score = completion.score;
      console.log(`  📊 Completion: ${completion.score}%`);

      // Upsert to database
      const { error: upsertErr } = await supabase.from('ai_profiles')
        .upsert(aiData, { onConflict: 'user_id' });

      if (upsertErr) {
        console.log(`  ❌ Upsert error: ${upsertErr.message}`);
      } else {
        console.log(`  ✅ AI profile saved!`);
        await supabase.from('profiles').update({
          ai_profile_ready: true,
          last_cv_parsed_at: new Date().toISOString(),
        }).eq('user_id', profile.user_id);
      }

    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
    }
  }

  console.log('\n🎉 Done!');
}

reparseAll().catch(console.error);
