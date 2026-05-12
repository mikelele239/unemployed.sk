require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: jobs } = await supabase.from('jobs').select('id, title, location, lat, lng, work_model, type, rate, rate_unit, hours, start_date, duration, status, company').or('status.eq.Active,status.is.null');
  (jobs || []).forEach(j => {
    console.log(`Job ${j.id} "${j.title}": location="${j.location}" lat=${j.lat} lng=${j.lng} work_model="${j.work_model}" type="${j.type}" rate="${j.rate}" rate_unit="${j.rate_unit}" hours="${j.hours}" start_date="${j.start_date}" duration="${j.duration}"`);
  });
}
main().catch(console.error);
