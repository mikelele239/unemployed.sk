const fs = require('fs');
let content = fs.readFileSync('lib/ai-cv-parser.js', 'utf8');

// Find the ai_profile block and replace it
const startMarker = "  '  \"ai_profile\": {',";
const endMarker = "  '  \"profile_completion\": {',";

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find markers!', { startIdx, endIdx });
  process.exit(1);
}

const newBlock = [
  "  '  \"ai_profile\": {',",
  "  '    \"headline\": { \"sk\": \"profesionálny nadpis max 60 znakov — popisuje kým kandidát JE (napr. Študent ekonómie | Bratislava), NIE pozíciu ktorú hľadá\", \"en\": \"professional headline max 60 chars — describes who they ARE now (e.g. Economics Student | City), NOT a job title they are seeking\" },',",
  "  '    \"short_summary\": { \"sk\": \"1 vetný pitch kandidáta po slovensky\", \"en\": \"1 sentence candidate pitch in English\" },',",
  "  '    \"portfolio_intro\": { \"sk\": \"profesionálne portfólio intro po slovensky alebo null\", \"en\": \"professional portfolio intro paragraph in English or null\" },',",
  "  '    \"employer_summary\": { \"sk\": \"3-5 vetný executive summary v tretej osobe po slovensky. Pokryte: kto je kandidát, vzdelanie, zručnosti, skúsenosti a typ pozície pre ktorú sa hodí.\", \"en\": \"3-5 sentence executive summary in third person in English. Cover: who they are, education, key skills, experience, and role fit.\" },',",
  "  '    \"strengths\": [{ \"sk\": \"silná stránka po slovensky\", \"en\": \"strength in English\" }],',",
  "  '    \"development_areas\": [{ \"sk\": \"oblasť rozvoja po slovensky\", \"en\": \"development area in English\" }],',",
  "  '    \"career_direction\": { \"sk\": \"1 veta o kariérnom smerovaní po slovensky\", \"en\": \"1 sentence about career trajectory in English\" },',",
  "  '    \"profile_quality_notes\": [\"any notes about profile completeness or quality\"]',",
  "  '  },',",
].join('\n');

content = content.substring(0, startIdx) + newBlock + '\n' + content.substring(endIdx);
fs.writeFileSync('lib/ai-cv-parser.js', content, 'utf8');
console.log('✅ ai_profile section updated to bilingual output');
console.log('Lines replaced:', startIdx, '->', endIdx);
