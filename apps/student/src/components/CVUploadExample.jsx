import React, { useState, useEffect } from 'react';
import { cvApi } from '../services/cvApi';
import { UploadCloud, FileText, Trash2, Download } from 'lucide-react';

export default function CVUploadExample() {
  const [cvs, setCvs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Example fetch on mount
  useEffect(() => {
    loadCVs();
  }, []);

  const loadCVs = async () => {
    try {
      const data = await cvApi.fetchMyCVs();
      setCvs(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side quick validation matching server constraints
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be under 10MB.');
      return;
    }

    try {
      setUploading(true);
      setError('');
      
      const newCv = await cvApi.uploadCV(file);
      setCvs((prev) => [newCv, ...prev]);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (id) => {
    try {
      const url = await cvApi.downloadCV(id);
      // Initiate download or open in new tab
      window.open(url, '_blank');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Naozaj chcete vymazať tento životopis?')) return;
    try {
      await cvApi.deleteCV(id);
      setCvs(cvs.filter(cv => cv.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ padding: 24, background: 'var(--bg-card)', borderRadius: 16 }}>
      <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 16 }}>Môj životopis (CV)</h3>

      {error && <div style={{ color: 'red', background: '#fee2e2', padding: 12, borderRadius: 8, marginBottom: 16 }}>{error}</div>}

      <div style={{ marginBottom: 24 }}>
        <label style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 32, border: '2px dashed var(--border)', borderRadius: 12, cursor: uploading ? 'not-allowed' : 'pointer',
          background: 'var(--bg)', opacity: uploading ? 0.6 : 1
        }}>
          <UploadCloud size={32} color="var(--accent)" style={{ marginBottom: 12 }} />
          <span style={{ fontWeight: 600 }}>{uploading ? 'Nahráva sa...' : 'Kliknite pre nahratie CV (.pdf, .doc, .docx)'}</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Max 10MB</span>
          <input 
            type="file" 
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
            onChange={handleFileUpload} 
            disabled={uploading}
            style={{ display: 'none' }} 
          />
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {cvs.map((cv) => (
          <div key={cv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 8, background: 'var(--bg)', borderRadius: 8 }}>
                <FileText size={20} color="var(--accent)" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600 }}>{cv.original_filename}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                 {(cv.size_bytes / 1024 / 1024).toFixed(2)} MB • Nahrane: {new Date(cv.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={() => handleDownload(cv.id)}
                style={{ padding: 8, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Stiahnuť originál"
              >
                <Download size={16} />
              </button>
              <button 
                onClick={() => handleDelete(cv.id)}
                style={{ padding: 8, background: '#fee2e2', color: 'red', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Vymazať"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {cvs.length === 0 && !uploading && (
           <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Zatiaľ nemáte nahrané žiadne životopisy.</p>
        )}
      </div>
    </div>
  );
}
