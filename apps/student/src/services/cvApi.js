import { supabase, getAccessToken, getAccessTokenAsync } from '../supabase';

export const cvApi = {
    /**
     * Upload a CV via the server-side endpoint which handles:
     * - Storage upload
     * - PDF/DOCX text extraction
     * - AI profile creation/update
     * - Match score recalculation
     * Returns { cv, ai_profile, parse_status, warnings }
     */
    async uploadCV(file) {
        // Use async token retrieval — critical for brand-new signups where
        // localStorage may not have the session yet
        let token = await getAccessTokenAsync();
        if (!token) {
            // Fallback to sync method if async fails
            token = getAccessToken();
        }
        if (!token) throw new Error('Not authenticated');

        // Validate client-side before sending
        const name = file.name.toLowerCase();
        if (!name.endsWith('.pdf') && !name.endsWith('.doc') && !name.endsWith('.docx')) {
            throw new Error('Only PDF and DOC/DOCX files are accepted');
        }
        if (file.size > 10 * 1024 * 1024) {
            throw new Error('File too large (max 10 MB)');
        }

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/cvs/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Upload failed (${res.status})`);
        }

        const data = await res.json();
        return {
            id: data.cv?.id,
            path: data.cv?.id,
            original_filename: data.cv?.original_filename,
            ai_profile: data.ai_profile || null,
            parse_status: data.parse_status || 'unknown',
            warnings: data.warnings || [],
        };
    },

    async fetchMyCVs() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');
        const uid = session.user.id;

        const { data: files, error } = await supabase.storage
            .from('cvs')
            .list(uid, { limit: 20, sortBy: { column: 'created_at', order: 'desc' } });

        if (error) throw new Error(error.message || 'Failed to fetch CVs');

        return (files || []).filter(f => {
            const name = f.name.toLowerCase();
            return !name.startsWith('avatar.') && !name.startsWith('logo.');
        }).map(f => ({
            id: `${uid}/${f.name}`,
            path: `${uid}/${f.name}`,
            original_filename: f.name,
            created_at: f.created_at,
            size: f.metadata?.size || 0,
        }));
    },

    async downloadCV(path) {
        const { data, error } = await supabase.storage
            .from('cvs')
            .createSignedUrl(path, 3600);

        if (error) throw new Error(error.message || 'Failed to generate download link');
        return data.signedUrl;
    },

    async deleteCV(path) {
        const { error } = await supabase.storage
            .from('cvs')
            .remove([path]);

        if (error) throw new Error(error.message || 'Failed to delete CV');

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('cv_id')
                .eq('user_id', session.user.id)
                .maybeSingle();

            if (profile?.cv_id === path) {
                await supabase
                    .from('profiles')
                    .update({ cv_id: null, original_filename: null })
                    .eq('user_id', session.user.id);
            }
        }

        return true;
    }
};
