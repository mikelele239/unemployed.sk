import { getAccessToken } from '../supabase';
import { isDemoMode } from '../demoMode';

// Assuming you store the user's session token securely, 
// e.g., in localStorage or context state after login.
const getAuthToken = () => {
    return getAccessToken();
};


export const cvApi = {
    async uploadCV(file) {
        if (isDemoMode()) {
            return { id: 'mock-cv-id', name: file.name };
        }
        const token = getAuthToken();
        if (!token) throw new Error('Not authenticated');

        const formData = new FormData();
        formData.append('cv', file); // 'cv' matches the multer .single('cv')

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
        const token = getAuthToken();
        if (!token) throw new Error('Not authenticated');

        const res = await fetch('/api/cvs', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch CVs');
        return data; // Array of CV metadata objects
    },

    async downloadCV(id) {
        const token = getAuthToken();
        if (!token) throw new Error('Not authenticated');

        const res = await fetch(`/api/cvs/download/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to generate download link');
        return data.url; // The signed URL
    },

    async deleteCV(id) {
        const token = getAuthToken();
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
