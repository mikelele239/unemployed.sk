import { supabase } from '../supabase';

export const cvApi = {
    async uploadCV(file) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');
        const uid = session.user.id;

        // Generate a unique filename
        const ext = file.name.split('.').pop() || 'pdf';
        const fileName = `${uid}/${Date.now()}_${file.name}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('cvs')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type || 'application/pdf',
            });

        if (error) throw new Error(error.message || 'Failed to upload CV');

        // Update the profile with the CV path + original filename
        await supabase
            .from('profiles')
            .update({
                cv_id: data.path,
                original_filename: file.name,
            })
            .eq('user_id', uid);

        return {
            id: data.path,
            path: data.path,
            original_filename: file.name,
        };
    },

    async fetchMyCVs() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');
        const uid = session.user.id;

        // List files in the user's CV folder
        const { data: files, error } = await supabase.storage
            .from('cvs')
            .list(uid, { limit: 20, sortBy: { column: 'created_at', order: 'desc' } });

        if (error) throw new Error(error.message || 'Failed to fetch CVs');

        return (files || []).map(f => ({
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

        // Clear cv_id from profile if this was the active CV
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
