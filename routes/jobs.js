'use strict';
// ── Jobs Routes ──────────────────────────────────────────────────────────────
module.exports = function jobsRouter(app, supabase) {

  // GET /api/jobs — list all jobs
  app.get('/api/jobs', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const parsedJobs = data.map(j => ({
        ...j,
        match: j.match_score,
        rateUnit: j.rate_unit,
        startDate: j.start_date,
        workModel: j.work_model
      }));

      res.json(parsedJobs);
    } catch (err) {
      console.error('Fetch jobs error:', err);
      res.status(500).json({ error: 'Chyba pri načítaní ponúk.' });
    }
  });

  // POST /api/jobs — create a job
  app.post('/api/jobs', async (req, res) => {
    const { 
      title, company, logo, color, location, rate, rateUnit, hours, type, 
      tags, schedule, description, requirements, lat, lng,
      duration, startDate, workModel 
    } = req.body;

    if (!title || !company) {
      return res.status(400).json({ error: 'Názov pozície a firma sú povinné.' });
    }

    try {
      const { data, error } = await supabase
        .from('jobs')
        .insert([{ 
          title, company, logo, color, location, 
          rate, rate_unit: rateUnit, hours, type, 
          tags: tags || [], schedule, match_score: 95, 
          reason: 'Pridané online.', description, requirements,
          lat, lng,
          duration, start_date: startDate, work_model: workModel
        }])
        .select();

      if (error) throw error;
      res.json({ success: true, id: data[0].id });
    } catch (err) {
      console.error('Create job error:', err);
      res.status(500).json({ error: 'Chyba pri ukladaní ponuky.' });
    }
  });

  // DELETE /api/jobs/:id
  app.delete('/api/jobs/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error('Delete job error:', err);
      res.status(500).json({ error: 'Chyba pri mazaní ponuky.' });
    }
  });

  // POST /api/jobs/:id/view — increment view count (non-fatal)
  app.post('/api/jobs/:id/view', async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase.rpc('increment_job_views', { job_id_input: id });
      if (error) console.warn('View tracking RPC error (non-fatal):', error.message);
      res.json({ success: true });
    } catch (err) {
      console.error('View tracking error:', err);
      res.json({ success: true }); // Non-fatal
    }
  });

  // NOTE: POST/GET/PATCH /api/applications routes are defined in server.js
  // with proper auth token handling. Do NOT add them here.
};
