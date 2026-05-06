import { getAccessTokenAsync } from '../supabase';

export const cvApi = {
    async uploadCV(file) {
        const token = await getAccessTokenAsync();
        if (!token) throw new Error('Not authenticated');

        const formData = new FormData();
        formData.append('cv', file);

        const res = await fetch('/api/cvs/upload', {
            method: 'POST',
            headers: {
                // DO NOT set Content-Type manually, fetch will set it with the correct boundary!
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload CV');
        return data.cv;
    },

    async fetchMyCVs() {
        const token = await getAccessTokenAsync();
        if (!token) throw new Error('Not authenticated');

        const res = await fetch('/api/cvs', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch CVs');
        return data; // Array of CV metadata objects
    },

    async downloadCV(id) {
        const token = await getAccessTokenAsync();
        if (!token) throw new Error('Not authenticated');

        const res = await fetch(`/api/cvs/download/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to generate download link');
        return data.url; // The signed URL
    },

    async deleteCV(id) {
        const token = await getAccessTokenAsync();
        if (!token) throw new Error('Not authenticated');

        const res = await fetch(`/api/cvs/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete CV');
        return true;
    }
};
