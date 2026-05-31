import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Settings, LogOut, Shield, MapPin, GraduationCap, Mail, 
  FileText, Award, Globe, Moon, Sun, Camera, Plus, Edit2, 
  Trash2, Sparkles, Check, X, AlertTriangle, ChevronRight,
  Bot, Paperclip
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, getAccessToken, getAccessTokenAsync } from '../supabase';
import { useTranslation } from '../I18nContext';

// Helper: parse bilingual JSON strings {sk,en} — returns the right language
function biLang(val, lang) {
  if (!val) return '';
  if (typeof val === 'object' && (val.sk || val.en)) return val[lang] || val.en || val.sk || '';
  if (typeof val !== 'string') return String(val);
  try {
    const parsed = JSON.parse(val);
    if (parsed && typeof parsed === 'object' && (parsed.sk || parsed.en)) return parsed[lang] || parsed.en || parsed.sk || '';
    return val;
  } catch { return val; }
}
function biLangArr(arr, lang) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => biLang(item, lang)).filter(Boolean);
}

export default function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, setLang, theme, setTheme, t } = useTranslation();
  const [profile, setProfile] = useState({ name: '', edu: '', loc: '', bio: '', skills: [], email: '', cover_url: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [tempProfile, setTempProfile] = useState(null);
  const [showAvatarSourceModal, setShowAvatarSourceModal] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);

  // Upload type: 'avatar' or 'cover'
  const [activeUploadType, setActiveUploadType] = useState('avatar');
  const [resolvedCoverUrl, setResolvedCoverUrl] = useState(null);
  const [coverFailed, setCoverFailed] = useState(false);

  // Crop modal states
  const [cropActive, setCropActive] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropPan, setCropPan] = useState({ x: 0, y: 0 });
  const [cropAspect, setCropAspect] = useState(1);
  const [dragActive, setDragActive] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const startEditing = () => {
    setTempProfile({
      name: profile.name || '',
      edu: profile.edu || '',
      loc: profile.loc || '',
      bio: profile.bio || '',
      skills: [...(profile.skills || [])],
      avatar_url: profile.avatar_url || '',
      cover_url: profile.cover_url || '',
    });
    setIsEditing(true);
  };

  const closeEditing = () => {
    setIsEditing(false);
    setTempProfile(null);
  };

  const [cvs, setCvs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [generatingCv, setGeneratingCv] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingSkill, setAddingSkill] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const skillInputRef = useRef(null);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [aiProfile, setAiProfile] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState(null);

  // Profile Insights editing state
  const [isEditingInsights, setIsEditingInsights] = useState(false);
  const [isEditingRecently, setIsEditingRecently] = useState(false);
  const [isEditingInsightsRecently, setIsEditingInsightsRecently] = useState(false);
  const [tempInsights, setTempInsights] = useState(null);
  const [savingInsights, setSavingInsights] = useState(false);

  useEffect(() => {
    if (isEditing) {
      setIsEditingRecently(true);
    } else {
      const timer = setTimeout(() => setIsEditingRecently(false), 600);
      return () => clearTimeout(timer);
    }
  }, [isEditing]);

  useEffect(() => {
    if (isEditingInsights) {
      setIsEditingInsightsRecently(true);
    } else {
      const timer = setTimeout(() => setIsEditingInsightsRecently(false), 600);
      return () => clearTimeout(timer);
    }
  }, [isEditingInsights]);

  useEffect(() => {
    setIsEditing(false);
    setIsEditingInsights(false);
    setTempProfile(null);
    setTempInsights(null);
  }, [location.key]);

  useEffect(() => {
    const handleActiveClick = (e) => {
      if (e.detail?.path === '/profile') {
        setIsEditing(false);
        setIsEditingInsights(false);
        setTempProfile(null);
        setTempInsights(null);
      }
    };
    window.addEventListener('active-nav-click', handleActiveClick);
    return () => window.removeEventListener('active-nav-click', handleActiveClick);
  }, []);

  const startEditingInsights = () => {
    if (!aiProfile) return;
    
    // Normalize strengths and suggested roles
    let strengths = [];
    if (Array.isArray(aiProfile.ai_strengths)) {
      strengths = aiProfile.ai_strengths.map(s => biLang(s, lang)).filter(Boolean);
    } else if (typeof aiProfile.ai_strengths === 'string') {
      try {
        const parsed = JSON.parse(aiProfile.ai_strengths);
        const arr = Array.isArray(parsed) ? parsed : [];
        strengths = arr.map(s => biLang(s, lang)).filter(Boolean);
      } catch {
        strengths = aiProfile.ai_strengths.split(',').map(s => biLang(s.trim(), lang)).filter(Boolean);
      }
    }

    let roles = [];
    if (Array.isArray(aiProfile.ai_suggested_roles)) {
      roles = aiProfile.ai_suggested_roles.map(r => biLang(r, lang)).filter(Boolean);
    } else if (typeof aiProfile.ai_suggested_roles === 'string') {
      try {
        const parsed = JSON.parse(aiProfile.ai_suggested_roles);
        const arr = Array.isArray(parsed) ? parsed : [];
        roles = arr.map(r => biLang(r, lang)).filter(Boolean);
      } catch {
        roles = aiProfile.ai_suggested_roles.split(',').map(r => biLang(r.trim(), lang)).filter(Boolean);
      }
    }

    setTempInsights({
      ai_headline: biLang(aiProfile.ai_headline, lang) || '',
      ai_strengths: strengths,
      ai_suggested_roles: roles,
      languages: Array.isArray(aiProfile.languages) ? aiProfile.languages.map(l => ({ ...l })) : [],
      education_level: aiProfile.education_level || 'unknown',
      education_field: aiProfile.education_field || '',
      experience_years: aiProfile.experience_years || 0
    });
    setIsEditingInsights(true);
  };

  const closeEditingInsights = () => {
    setIsEditingInsights(false);
    setTempInsights(null);
  };

  const handleSaveInsights = async () => {
    if (!tempInsights) return;
    try {
      setSavingInsights(true);
      const token = await getAccessToken();
      const res = await fetch('/api/ai-profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ai_headline: tempInsights.ai_headline,
          ai_strengths: tempInsights.ai_strengths,
          ai_suggested_roles: tempInsights.ai_suggested_roles,
          languages: tempInsights.languages,
          education_level: tempInsights.education_level,
          education_field: tempInsights.education_field,
          experience_years: tempInsights.experience_years
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ai_profile) {
          setAiProfile(data.ai_profile);
        }
        setIsEditingInsights(false);
        setTempInsights(null);
      }
    } catch (e) {
      console.warn('Save insights error:', e);
    } finally {
      setSavingInsights(false);
    }
  };

  // Account deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // CV deletion state
  const [showDeleteCvModal, setShowDeleteCvModal] = useState(false);
  const [deletingCv, setDeletingCv] = useState(false);
  const [hoveringCv, setHoveringCv] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 400, height: 400, facingMode: 'user' } 
      });
      setCameraStream(stream);
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error('Camera access error:', err);
      alert(lang === 'en' ? 'Could not access camera. Please upload a file instead.' : 'Nepodarilo sa spustiť kameru. Nahrajte súbor.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
  };

  // Cleanup camera stream on unmount to prevent dangling media streams
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');

      setCropImageSrc(dataUrl);
      setCropZoom(1);
      setCropPan({ x: 0, y: 0 });
      setCropAspect(canvas.width / canvas.height);
      setCropActive(true);

      stopCamera();
      setShowAvatarSourceModal(false);
    } catch (err) {
      console.error('Capture error:', err);
    }
  };

  const uploadAvatarFile = async (file) => {
    try {
      setUploading(true);
      const token = await getAccessTokenAsync() || getAccessToken();
      if (!token) return;

      const formData = new FormData();
      formData.append('avatar', file);

      const res = await fetch('/api/student/avatar-upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        const json = await res.json();
        const avatarUrl = json.avatar_url || '';

        setProfile(prev => ({ ...prev, avatar_url: avatarUrl }));
        if (tempProfile) {
          setTempProfile(prev => ({ ...prev, avatar_url: avatarUrl }));
        }
        setResolvedAvatarUrl(avatarUrl);
        setAvatarFailed(false);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('Avatar upload error:', err);
        alert(err.error || 'Upload failed');
      }
    } catch (err) { 
      console.error('Avatar upload error:', err); 
    } finally {
      setUploading(false);
    }
  };

  const uploadCoverFile = async (file) => {
    try {
      setUploading(true);
      const token = await getAccessTokenAsync() || getAccessToken();
      if (!token) return;

      const formData = new FormData();
      formData.append('cover', file);

      const res = await fetch('/api/student/cover-upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        const json = await res.json();
        const coverUrl = json.cover_url || '';

        setProfile(prev => ({ ...prev, cover_url: coverUrl }));
        if (tempProfile) {
          setTempProfile(prev => ({ ...prev, cover_url: coverUrl }));
        }
        setResolvedCoverUrl(coverUrl);
        setCoverFailed(false);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('Cover upload error:', err);
        alert(err.error || 'Upload failed');
      }
    } catch (err) { 
      console.error('Cover upload error:', err); 
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const uid = session.user.id;
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', uid)
          .maybeSingle();
        if (data) {
          setProfile({
            ...data,
            name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
            edu: data.education || '',
            loc: data.location || '',
            bio: data.bio || '',
            skills: data.skills || [],
            avatar_url: data.avatar_url || '',
            cover_url: data.cover_url || '',
            email: session.user.email || data.email || '',
          });

          // Sync the cvs state from the profiles table instead of calling a separate storage list
          if (data.cv_id) {
            setCvs([{
              id: data.cv_id,
              path: data.cv_id,
              original_filename: data.original_filename || data.cv_id.split('_').slice(1).join('_') || 'CV.pdf',
              created_at: data.updated_at || new Date().toISOString(),
            }]);
          } else {
            setCvs([]);
          }
        }

        // Resolve files from storage with fresh signed URLs
        try {
          const { data: files } = await supabase.storage.from('cvs').list(uid, { limit: 20 });
          
          const avatarFile = (files || []).find(f => f.name.toLowerCase().startsWith('avatar.'));
          if (avatarFile) {
            const { data: signedData } = await supabase.storage.from('cvs').createSignedUrl(`${uid}/${avatarFile.name}`, 3600);
            if (signedData?.signedUrl) {
              setResolvedAvatarUrl(signedData.signedUrl);
              setAvatarFailed(false);
            }
          }

          const coverFile = (files || []).find(f => f.name.toLowerCase().startsWith('cover.'));
          if (coverFile) {
            const { data: signedData } = await supabase.storage.from('cvs').createSignedUrl(`${uid}/${coverFile.name}`, 3600);
            if (signedData?.signedUrl) {
              setResolvedCoverUrl(signedData.signedUrl);
              setCoverFailed(false);
            }
          }
        } catch (avatarErr) {
          console.error('Avatar resolve error:', avatarErr);
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
      }
    };
    fetchProfile();
  }, []);

  // Load AI profile
  useEffect(() => {
    const loadAiProfile = async () => {
      try {
        const token = await getAccessTokenAsync() || getAccessToken();
        if (!token) return;
        const res = await fetch('/api/ai-profile', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setAiProfile(data.profile);
            // Sync AI-extracted location to profile display if profiles.location is stale/different
            if (data.profile.location) {
              setProfile(prev => ({
                ...prev,
                loc: data.profile.location,
              }));
            }
          }
        }
      } catch (e) { console.warn('AI profile fetch:', e.message); }
    };
    loadAiProfile();
  }, []);

  // Load verification status
  useEffect(() => {
    const loadVerification = async () => {
      try {
        const token = await getAccessTokenAsync() || getAccessToken();
        if (!token) return;
        const res = await fetch('/api/verify/status', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.verification) setVerificationStatus(data.verification);
        }
      } catch (e) { console.warn('Verification status fetch:', e.message); }
    };
    loadVerification();
  }, []);



  const handleSave = async () => {
    if (!tempProfile) return;
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const nameParts = (tempProfile.name || '').trim().split(' ');
      const token = session.access_token;

      // Save via server API (bypasses RLS)
      const res = await fetch('/api/student/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: nameParts[0] || '',
          last_name: nameParts.slice(1).join(' ') || '',
          education: tempProfile.edu || '',
          location: tempProfile.loc || '',
          bio: tempProfile.bio || '',
          skills: tempProfile.skills || [],
          avatar_url: tempProfile.avatar_url || '',
          cover_url: tempProfile.cover_url || '',
        }),
      });

      if (res.ok) {
        // Also sync location to ai_profiles so it persists across CV re-parses
        try {
          await fetch('/api/ai-profile', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ location: tempProfile.loc || '' }),
          });
        } catch (e) { console.warn('AI profile location sync:', e.message); }

        setProfile(prev => ({
          ...prev,
          name: tempProfile.name,
          edu: tempProfile.edu,
          loc: tempProfile.loc,
          bio: tempProfile.bio,
          skills: tempProfile.skills,
          avatar_url: tempProfile.avatar_url,
          cover_url: tempProfile.cover_url,
        }));
        
        setIsEditing(false);
        setTempProfile(null);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('Profile save error:', err);
      }
    } catch (err) { console.error('Save error:', err); }
    finally { setSaving(false); }
  };

  const handleCvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if filename matches current CV
    const currentName = profile?.original_filename || (cvs && cvs[0]?.original_filename);
    if (currentName && file.name === currentName) {
      alert(lang === 'en' ? 'You already have this CV uploaded.' : 'Tento životopis už máš nahraný.');
      return;
    }

    if (!file.name.toLowerCase().match(/\.(pdf|doc|docx)$/)) {
      alert(lang === 'en' ? 'Only PDF and DOC/DOCX files are accepted' : 'Akceptujeme len PDF a DOC/DOCX súbory');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert(lang === 'en' ? 'File too large (max 10 MB)' : 'Súbor je príliš veľký (max 10 MB)');
      return;
    }

    try {
      setUploading(true);
      const token = await getAccessTokenAsync() || getAccessToken();
      if (!token) {
        alert(lang === 'en' ? 'Authentication error — please log in again.' : 'Chyba overenia — prihláste sa znova.');
        return;
      }

      // Upload via server endpoint — file storage is instant, AI parsing runs in background
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/cvs/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('Upload error:', err);
        alert(err.error || 'Upload failed');
        return;
      }

      const result = await res.json();
      console.log('[Profile] CV uploaded. Status:', result.parse_status);

      // Update local CV list and profile state
      if (result.cv?.id) {
        setProfile(prev => prev ? {
          ...prev,
          cv_id: result.cv.id,
          original_filename: result.cv.original_filename || file.name,
        } : null);
        setCvs([{
          id: result.cv.id,
          path: result.cv.id,
          original_filename: result.cv.original_filename || file.name,
          created_at: new Date().toISOString(),
        }]);
      }

      // If AI profile was returned immediately, use it
      if (result.ai_profile) {
        setAiProfile(result.ai_profile);
      }

      // Refresh verification status right away
      try {
        const freshToken = await getAccessTokenAsync() || getAccessToken();
        const vRes = await fetch('/api/verify/status', {
          headers: { 'Authorization': `Bearer ${freshToken}` },
        });
        if (vRes.ok) {
          const vData = await vRes.json();
          setVerificationStatus(vData.verification || null);
        }
      } catch (e) {
        console.warn('[Profile] Refresh verification status error:', e.message);
      }

      // AI parsing runs in the background — poll for the updated AI profile
      // with multiple retries at increasing intervals
      const pollDelays = [3000, 6000, 12000]; // 3s, 6s, 12s
      for (const delay of pollDelays) {
        await new Promise(resolve => setTimeout(resolve, delay));
        try {
          const freshToken = await getAccessTokenAsync() || getAccessToken();
          const aiRes = await fetch('/api/ai-profile', { headers: { 'Authorization': `Bearer ${freshToken}` } });
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            if (aiData.profile && aiData.profile.parse_status !== 'processing') {
              setAiProfile(aiData.profile);
              console.log('[Profile] AI profile loaded after background processing');
              break;
            }
          }
        } catch (e) { console.warn('AI profile poll:', e.message); }
      }

    } catch (err) { console.error('Upload error:', err); }
    finally { setUploading(false); }
  };

  const handleGenerateCv = async () => {
    try {
      setGeneratingCv(true);
      const token = await getAccessTokenAsync() || getAccessToken();
      if (!token) {
        alert(lang === 'en' ? 'Authentication error — please log in again.' : 'Chyba overenia — prihláste sa znova.');
        return;
      }

      const res = await fetch('/api/cvs/generate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('Generation error:', err);
        alert(err.error || (lang === 'en' ? 'Generation failed.' : 'Generovanie zlyhalo.'));
        return;
      }

      const result = await res.json();
      if (result.cv?.id) {
        setProfile(prev => prev ? {
          ...prev,
          cv_id: result.cv.id,
          original_filename: result.cv.original_filename,
        } : null);
        setCvs([{
          id: result.cv.id,
          path: result.cv.id,
          original_filename: result.cv.original_filename,
          created_at: result.cv.created_at || new Date().toISOString(),
        }]);
        
        try {
          const vRes = await fetch('/api/verify/status', {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (vRes.ok) {
            const vData = await vRes.json();
            setVerificationStatus(vData.verification || null);
          }
        } catch (e) {
          console.warn('[Profile] Refresh verification status error:', e.message);
        }
      }
    } catch (err) {
      console.error('Generation error:', err);
      alert(lang === 'en' ? 'An error occurred while generating CV.' : 'Pri generovaní životopisu sa vyskytla chyba.');
    } finally {
      setGeneratingCv(false);
    }
  };

  const handleCvPreview = async (cvPath) => {
    try {
      const { data, error } = await supabase.storage
        .from('cvs')
        .createSignedUrl(cvPath, 3600);
      if (!error && data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) { console.error('CV preview error:', err); }
  };

  const handleDeleteCv = async () => {
    if (!cvs.length) return;
    try {
      setDeletingCv(true);
      const cvPath = cvs[0].id;
      const token = await getAccessTokenAsync() || getAccessToken();
      const res = await fetch(`/api/cvs/${cvPath}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setCvs([]);
        setShowDeleteCvModal(false);
      } else {
        const err = await res.json();
        alert(err.error || (lang === 'en' ? 'Failed to delete CV.' : 'Odstránenie životopisu zlyhalo.'));
      }
    } catch (err) {
      console.error(err);
      alert(lang === 'en' ? 'An error occurred while deleting the CV.' : 'Pri odstraňovaní životopisu sa vyskytla chyba.');
    } finally {
      setDeletingCv(false);
    }
  };

  const handleAddSkill = () => {
    if (newSkill.trim()) {
      if (tempProfile) {
        if (!tempProfile.skills.includes(newSkill.trim())) {
          setTempProfile(prev => ({ ...prev, skills: [...(prev.skills || []), newSkill.trim()] }));
        }
      } else {
        if (!profile.skills.includes(newSkill.trim())) {
          setProfile(prev => ({ ...prev, skills: [...(prev.skills || []), newSkill.trim()] }));
        }
      }
      setNewSkill('');
      setAddingSkill(false);
    }
  };

  const handleRemoveSkill = (skill) => {
    if (tempProfile) {
      setTempProfile(prev => ({ ...prev, skills: (prev.skills || []).filter(s => s !== skill) }));
    } else {
      setProfile(prev => ({ ...prev, skills: (prev.skills || []).filter(s => s !== skill) }));
    }
  };

  // Profile strength: name, location, profile pic, CV, 3+ skills
  const strengthItems = [
    { key: 'name', label: lang === 'sk' ? 'Meno' : 'Name', done: !!profile.name?.trim() },
    { key: 'loc', label: lang === 'sk' ? 'Lokalita' : 'Location', done: !!profile.loc?.trim() },
    { key: 'avatar', label: lang === 'sk' ? 'Profilová fotka' : 'Profile picture', done: !!profile.avatar_url },
    { key: 'cv', label: lang === 'sk' ? 'Životopis' : 'CV', done: cvs.length > 0 },
    { key: 'skills', label: lang === 'sk' ? '3+ zručnosti' : '3+ skills', done: (profile.skills || []).length >= 3 },
  ];
  const completionPercent = Math.round((strengthItems.filter(i => i.done).length / strengthItems.length) * 100);

  const getProfileRank = (pct) => {
    if (pct < 40) return lang === 'sk' ? 'Nový Hrdina 🌟' : 'New Hero 🌟';
    if (pct < 80) return lang === 'sk' ? 'Kariérny Cestovateľ 🚀' : 'Career Explorer 🚀';
    if (pct < 100) return lang === 'sk' ? 'Profi Kandidát 🏆' : 'Pro Candidate 🏆';
    return lang === 'sk' ? 'Legenda Trhu 👑' : 'Market Legend 👑';
  };

  const handleSuggestionClick = (key) => {
    if (key === 'cv') {
      document.getElementById('cv-file-input')?.click();
    } else if (key === 'avatar') {
      setActiveUploadType('avatar');
      setShowAvatarSourceModal(true);
    } else if (key === 'skills') {
      setAddingSkill(true);
      setTimeout(() => {
        skillInputRef.current?.focus();
      }, 100);
    } else {
      startEditing();
      setTimeout(() => {
        if (key === 'name') {
          document.getElementById('profile-name-input')?.focus();
        } else if (key === 'loc') {
          document.getElementById('profile-loc-input')?.focus();
        }
      }, 150);
    }
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result);
      setCropZoom(1);
      setCropPan({ x: 0, y: 0 });
      const img = new Image();
      img.onload = () => {
        setCropAspect(img.width / img.height);
        setCropActive(true);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    setShowAvatarSourceModal(false);
  };

  const handleDragStart = (clientX, clientY) => {
    setDragActive(true);
    setDragStart({
      x: clientX - cropPan.x,
      y: clientY - cropPan.y
    });
  };

  const handleDragMove = (clientX, clientY) => {
    if (!dragActive) return;
    setCropPan({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handleDragEnd = () => {
    setDragActive(false);
  };

  const onMouseDown = (e) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  const onMouseMove = (e) => {
    if (dragActive) {
      e.preventDefault();
      handleDragMove(e.clientX, e.clientY);
    }
  };

  const onMouseUp = () => {
    handleDragEnd();
  };

  const onTouchStart = (e) => {
    if (e.touches.length === 1) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchMove = (e) => {
    if (dragActive && e.touches.length === 1) {
      handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchEnd = () => {
    handleDragEnd();
  };

  const handleConfirmCrop = () => {
    if (!cropImageSrc) return;
    const img = new Image();
    img.onload = async () => {
      const isCover = activeUploadType === 'cover';
      const canvas = document.createElement('canvas');
      canvas.width = isCover ? 900 : 400;
      canvas.height = isCover ? 360 : 400;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fill background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const displayW = isCover ? 300 : 250;
      const displayH = isCover ? 120 : 250;
      const cropScale = canvas.width / displayW;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.translate(cropPan.x * cropScale, cropPan.y * cropScale);
      ctx.scale(cropZoom, cropZoom);

      const aspect = img.width / img.height;
      let drawW, drawH;
      if (isCover) {
        const canvasAspect = 900 / 360;
        if (aspect >= canvasAspect) {
          drawH = 360;
          drawW = 360 * aspect;
        } else {
          drawW = 900;
          drawH = 900 / aspect;
        }
      } else {
        if (aspect >= 1) {
          drawH = 400;
          drawW = 400 * aspect;
        } else {
          drawW = 400;
          drawH = 400 / aspect;
        }
      }

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], isCover ? 'cover.png' : 'avatar.png', { type: 'image/png' });
        setCropActive(false);
        if (isCover) {
          await uploadCoverFile(file);
        } else {
          await uploadAvatarFile(file);
        }
      }, 'image/png');
    };
    img.src = cropImageSrc;
  };

  const isCover = activeUploadType === 'cover';
  const viewportW = isCover ? 300 : 250;
  const viewportH = isCover ? 120 : 250;
  const viewportRadius = isCover ? '12px' : '50%';

  return (
    <div style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1200, width: '100%', margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 400, letterSpacing: '-0.5px' }}>{t('nav.profile')}</h1>
      </div>

      <div style={{ padding: '20px 24px 40px', maxWidth: 1200, width: '100%', margin: '0 auto' }}>
        <div className="profile-grid" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* LEFT COLUMN */}
          <div className="profile-left-col" style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
            
            {/* User Profile Card */}
            <motion.div 
              layoutId={isEditing || isEditingRecently ? "profile-info-pill" : undefined}
              className="profile-card" 
              style={{ overflow: 'hidden', padding: 0, position: 'relative', borderRadius: 24, transition: 'border-color 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease' }}
            >
              {/* Cover Banner */}
              <div style={{ 
                height: 120, 
                background: (resolvedCoverUrl || profile.cover_url) && !coverFailed
                  ? `url(${resolvedCoverUrl || profile.cover_url}) center/cover no-repeat`
                : 'var(--accent)', 
                position: 'relative' 
              }}>
                <button 
                  onClick={() => { setActiveUploadType('cover'); setShowAvatarSourceModal(true); }}
                  style={{ 
                    position: 'absolute', 
                    bottom: 12, 
                    right: 12, 
                    background: 'var(--overlay-dark)', 
                    backdropFilter: 'blur(8px)', 
                    border: '1px solid var(--overlay-border)', 
                    borderRadius: '12px', 
                    padding: '6px 12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 6, 
                    color: '#fff', 
                    fontSize: 11, 
                    fontWeight: 700, 
                    cursor: 'pointer', 
                    transition: 'all 0.2s' 
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--overlay-darker)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--overlay-dark)'}
                >
                  <Camera size={13} />
                  <span>{lang === 'sk' ? 'Zmeniť pozadie' : 'Change banner'}</span>
                </button>
              </div>

              {/* Avatar overlapping banner */}
              <div 
                onClick={() => { setActiveUploadType('avatar'); setShowAvatarSourceModal(true); }}
                style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--bg-card)', border: '4px solid var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, overflow: 'hidden', position: 'relative', cursor: 'pointer', marginTop: -50, marginLeft: 24, boxShadow: 'var(--shadow)', flexShrink: 0 }}
              >
                {(resolvedAvatarUrl || profile.avatar_url) && !avatarFailed ? (
                  <img src={resolvedAvatarUrl || profile.avatar_url} alt="" onError={() => setAvatarFailed(true)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block', borderRadius: '50%' }} />
                ) : (
                  profile.name ? profile.name.charAt(0).toUpperCase() : 'U'
                )}
                {/* Camera icon Hover overlay */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--overlay-dark)', opacity: 0, transition: 'opacity 0.2s', color: '#fff' }}
                  className="avatar-hover-overlay"
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                  <Camera size={22} />
                </div>
              </div>

              {/* Profile Details Area */}
              <div style={{ padding: '16px 24px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px' }}>{profile.name || (lang === 'en' ? 'User' : 'Užívateľ')}</h2>
                  <button 
                    onClick={startEditing}
                    style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s', flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)'; }}
                  >
                    <Edit2 size={13} />
                    <span>{lang === 'sk' ? 'Upraviť' : 'Edit'}</span>
                  </button>
                </div>
                
                {profile.bio && (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, marginTop: 8, lineHeight: 1.5, fontStyle: 'italic' }}>
                    "{profile.bio}"
                  </p>
                )}
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                    <MapPin size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span>{profile.loc || (lang === 'en' ? 'Location not set' : 'Lokalita nenastavená')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                    <GraduationCap size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span>{
                      profile.edu ||
                      (aiProfile?.education_level
                        ? [
                            { high_school: lang === 'sk' ? 'Stredná škola' : 'High School', bachelors: lang === 'sk' ? 'Bakalárske štúdium' : "Bachelor's", masters: lang === 'sk' ? 'Magisterské štúdium' : "Master's", phd: 'Doctorate (PhD)' }[aiProfile.education_level] || aiProfile.education_level,
                            aiProfile.education_field
                          ].filter(Boolean).join(' · ')
                        : (lang === 'en' ? 'Education not set' : 'Vzdelanie nenastavené'))
                    }</span>
                  </div>
                  {profile.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden' }}>
                      <Mail size={15} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.email}</span>
                    </div>
                  )}
                  {profile.skills && profile.skills.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                      {profile.skills.map(s => (
                        <span key={s} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Profile Level Progress Bar Card */}
            <div className="profile-card">
              {completionPercent === 100 && (
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 10, stiffness: 100 }}
                  style={{ float: 'right', fontSize: 24 }}
                >
                  🎉
                </motion.div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                    {lang === 'en' ? 'Profile Strength' : 'Sila profilu'}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
                    {getProfileRank(completionPercent)}
                  </span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-lighter)', padding: '4px 10px', borderRadius: 8 }}>
                  {completionPercent}%
                </span>
              </div>
              
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
                <motion.div 
                  initial={{ width: 0 }} 
                  animate={{ width: `${completionPercent}%` }} 
                  transition={{ type: 'spring', stiffness: 60, damping: 12 }} 
                  style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent) 0%, var(--color-premium) 100%)', borderRadius: 3 }} 
                />
              </div>
              
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, fontWeight: 600 }}>
                {completionPercent === 100 
                  ? (lang === 'sk' ? 'Tvoj profil je kompletný a pripravený na hľadanie práce! 🚀' : 'Your profile is 100% complete and job-ready! 🚀')
                  : (lang === 'sk' ? 'Dokonči nasledujúce kroky pre lepšie ponuky:' : 'Complete the following steps for better job matching:')}
              </p>

              {completionPercent < 100 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {strengthItems.map(item => (
                    <motion.div 
                      layout
                      key={item.key} 
                      onClick={() => !item.done && handleSuggestionClick(item.key)}
                      whileHover={!item.done ? { x: 3, background: 'var(--accent-lighter)' } : {}}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 10, 
                        fontSize: 12,
                        cursor: item.done ? 'default' : 'pointer',
                        padding: '8px 12px',
                        borderRadius: 12,
                        background: item.done ? 'transparent' : 'var(--bg-card-hover)',
                        border: item.done ? '1px solid transparent' : '1px dashed var(--border)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ 
                        width: 18, 
                        height: 18, 
                        borderRadius: '50%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: 10, 
                        background: item.done ? 'var(--color-success)' : 'var(--bg)', 
                        border: item.done ? 'none' : '1.5px solid var(--border)', 
                        color: '#fff',
                        fontWeight: 900,
                        flexShrink: 0
                      }}>
                        {item.done ? '✓' : ''}
                      </span>
                      <span style={{ 
                        color: item.done ? 'var(--text-muted)' : 'var(--text)', 
                        fontWeight: item.done ? 500 : 700, 
                        textDecoration: item.done ? 'line-through' : 'none',
                        flex: 1
                      }}>
                        {item.label}
                      </span>
                      {!item.done && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', opacity: 0.8, display: 'flex', alignItems: 'center' }}>
                          {lang === 'sk' ? 'DOPLNIŤ' : 'ADD'} <ChevronRight size={12} />
                        </span>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Settings & System Preferences Card */}
            <div className="profile-card" style={{ padding: '20px 24px' }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={16} style={{ color: 'var(--text-muted)' }} />
                {lang === 'en' ? 'System Settings' : 'Systémové nastavenia'}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Language Toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{lang === 'en' ? 'Language' : 'Jazyk'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{lang === 'en' ? 'Interface language' : 'Jazyk rozhrania'}</div>
                  </div>
                  <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg)' }}>
                    <button
                      onClick={() => setLang('sk')}
                      style={{
                        padding: '6px 12px', border: 'none', fontSize: 11, fontWeight: 800,
                        background: lang === 'sk' ? 'var(--accent)' : 'transparent',
                        color: lang === 'sk' ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer', transition: 'all 0.2s'
                      }}
                    >SK</button>
                    <button
                      onClick={() => setLang('en')}
                      style={{
                        padding: '6px 12px', border: 'none', fontSize: 11, fontWeight: 800,
                        background: lang === 'en' ? 'var(--accent)' : 'transparent',
                        color: lang === 'en' ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer', transition: 'all 0.2s'
                      }}
                    >EN</button>
                  </div>
                </div>

                {/* Theme Toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{lang === 'en' ? 'Appearance' : 'Vzhľad'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{lang === 'en' ? 'Dark or light mode' : 'Tmavý alebo svetlý vzhľad'}</div>
                  </div>
                  <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg)' }}>
                    <button
                      onClick={() => setTheme('dark')}
                      style={{
                        padding: '6px 10px', border: 'none', fontSize: 11, fontWeight: 700,
                        background: theme === 'dark' ? 'var(--accent)' : 'transparent',
                        color: theme === 'dark' ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 4
                      }}
                    >
                      <Moon size={12} />
                      {lang === 'en' ? 'Dark' : 'Tmavý'}
                    </button>
                    <button
                      onClick={() => setTheme('light')}
                      style={{
                        padding: '6px 10px', border: 'none', fontSize: 11, fontWeight: 700,
                        background: theme === 'light' ? 'var(--accent)' : 'transparent',
                        color: theme === 'light' ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 4
                      }}
                    >
                      <Sun size={12} />
                      {lang === 'en' ? 'Light' : 'Svetlý'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy & Data card moved to right column */}

            {/* Danger Zone — Account Deletion */}
            <div style={{ marginTop: 16, padding: 20, borderRadius: 16, border: '1px solid rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {lang === 'en' ? 'Danger Zone' : 'Nebezpečná zóna'}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
                {lang === 'en' 
                  ? 'Permanently delete your account and all associated data. This action cannot be undone.' 
                  : 'Natrvalo vymazať váš účet a všetky súvisiace údaje. Túto akciu nie je možné vrátiť späť.'}
              </p>
              <button
                onClick={() => setShowDeleteModal(true)}
                style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.3)', background: 'transparent', color: '#ef4444', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.borderColor = '#ef4444'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'; }}
              >
                <Trash2 size={14} />
                {lang === 'en' ? 'Delete Account' : 'Vymazať účet'}
              </button>
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div className="profile-right-col" style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
            
            {/* AI CV Verification Status Card */}
            <div
              className="profile-card"
              onClick={verificationStatus?.status !== 'completed' ? () => navigate('/messages', { state: { openVerification: true } }) : undefined}
              style={{
                position: 'relative', overflow: 'hidden',
                cursor: verificationStatus?.status !== 'completed' ? 'pointer' : 'default',
                transition: 'all 0.3s ease',
                background: verificationStatus?.status === 'completed'
                  ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.06) 0%, var(--bg-card) 50%)'
                  : 'var(--bg-card)'
              }}
              onMouseEnter={e => { if (verificationStatus?.status !== 'completed') { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 8px 30px var(--accent-light)'; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, background: verificationStatus?.status === 'completed' ? 'rgba(34, 197, 94, 0.08)' : 'var(--accent-lighter)', borderRadius: '50%', filter: 'blur(30px)', pointerEvents: 'none' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: verificationStatus?.status === 'completed'
                    ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                    : 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                }}>
                  <Bot size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                    {lang === 'sk' ? 'AI CV Overenie' : 'AI CV Verification'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {verificationStatus?.status === 'completed'
                      ? (lang === 'sk' ? 'Profil overený' : 'Profile verified')
                      : verificationStatus?.status === 'in_progress'
                        ? (lang === 'sk' ? 'Prebieha overovanie...' : 'Verification in progress...')
                        : (lang === 'sk' ? 'Neoverený' : 'Not verified')}
                  </div>
                </div>
                 {verificationStatus?.status === 'completed' && (
                  <span style={{
                    fontSize: 9, fontWeight: 800, color: 'var(--color-success)', textTransform: 'uppercase',
                    letterSpacing: '0.5px', background: 'var(--color-success-bg)',
                    border: '1px solid var(--color-success-bg)', borderRadius: 100, padding: '2px 8px',
                    display: 'inline-flex', alignItems: 'center', gap: 4
                  }}>
                    ✓ {lang === 'sk' ? 'Overené' : 'Verified'}
                  </span>
                )}
                {verificationStatus?.status === 'in_progress' && (
                  <span style={{
                    fontSize: 9, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase',
                    letterSpacing: '0.5px', background: 'var(--accent-light)',
                    border: '1px solid var(--shadow-accent)', borderRadius: 100, padding: '2px 8px',
                    display: 'inline-flex', alignItems: 'center', gap: 4
                  }}>
                    {lang === 'sk' ? 'Rozpracované' : 'In progress'}
                  </span>
                )}
              </div>

              {verificationStatus?.status === 'completed' && (
                <>
                  {/* Overall Score replaced with clean status display without numeric score */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '12px 14px', borderRadius: 10, background: 'var(--bg)' }}>
                    <Shield size={24} style={{ color: '#22c55e', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                        {lang === 'sk' ? 'Úspešne overené AI' : 'Successfully verified by AI'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {verificationStatus.completed_at && (
                          <>{lang === 'sk' ? 'Dokončené' : 'Completed'}: {new Date(verificationStatus.completed_at).toLocaleDateString(lang === 'sk' ? 'sk-SK' : 'en-US', { dateStyle: 'medium' })}</>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Per-attribute results - binary verification state without numeric percentages */}
                  {verificationStatus.results && (
                    <div className="grid-responsive cols-2" style={{ gap: 8 }}>
                      {Object.entries(verificationStatus.results).map(([attr, result]) => {
                        const attrLabels = {
                          language: { sk: 'Jazyky', en: 'Languages' },
                          skills: { sk: 'Zručnosti', en: 'Skills' },
                          experience: { sk: 'Skúsenosti', en: 'Experience' },
                          soft_skills: { sk: 'Soft skills', en: 'Soft Skills' },
                        };
                        return (
                          <div key={attr} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                              {attrLabels[attr]?.[lang] || attr}
                            </span>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '3px 8px',
                              borderRadius: 100,
                              background: result.verified ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              border: `1px solid ${result.verified ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                              fontSize: 10,
                              fontWeight: 800,
                              color: result.verified ? '#22c55e' : '#ef4444',
                              flexShrink: 0
                            }}>
                              {result.verified ? <Check size={10} /> : <X size={10} />}
                              <span>{result.verified ? (lang === 'sk' ? 'Overené' : 'Verified') : (lang === 'sk' ? 'Neoverené' : 'Unverified')}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {(!verificationStatus || verificationStatus.status !== 'completed') && (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'linear-gradient(135deg, var(--accent-lighter), var(--bg))', border: '1px solid var(--accent-light)', textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, margin: '0 0 8px', fontWeight: 600 }}>
                    {verificationStatus?.status === 'in_progress'
                      ? (lang === 'sk' ? 'Klikni sem pre dokončenie overenia' : 'Click here to finish your verification')
                      : (lang === 'sk' ? 'Overenie profilu zvyšuje tvoju šancu na pozvanie na pohovor až o 70%.' : 'Profile verification increases your chance of getting invited to an interview by up to 70%.')}
                  </p>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: 'var(--accent)' }}>
                    {verificationStatus?.status === 'in_progress'
                      ? (lang === 'sk' ? 'Pokračovať v overení' : 'Continue Verification')
                      : (lang === 'sk' ? 'Začať overenie' : 'Start Verification')}
                    <ChevronRight size={14} />
                  </div>
                </div>
              )}
            </div>

            {/* AI Insights profile card */}
            {aiProfile && aiProfile.parse_status !== 'failed' && (
              <motion.div 
                layoutId={isEditingInsights || isEditingInsightsRecently ? "profile-insights-pill" : undefined}
                className="profile-card" 
                style={{
                  position: 'relative', overflow: 'hidden', borderRadius: 24, transition: 'border-color 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease'
                }}
              >
                {/* subtle accent glow in corner */}
                <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, background: 'var(--accent-lighter)', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{lang === 'sk' ? 'Profil Insights' : 'Profile Insights'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {aiProfile.parse_status === 'ready'
                        ? (lang === 'sk' ? 'Zosumarizované z tvojho CV' : 'Summarized from your CV')
                        : (lang === 'sk' ? 'Spracováva sa...' : 'Processing...')}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    {verificationStatus?.status === 'completed' && (
                      <span style={{
                        fontSize: 9, fontWeight: 800, color: 'var(--color-success)', textTransform: 'uppercase',
                        letterSpacing: '0.5px', background: 'var(--color-success-bg)',
                        border: '1px solid var(--color-success-bg)', borderRadius: 100, padding: '2px 8px',
                        display: 'inline-flex', alignItems: 'center', gap: 4
                      }}>
                        ✓ {lang === 'sk' ? 'Overené' : 'Verified'}
                      </span>
                    )}
                    <button
                      onClick={startEditingInsights}
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'var(--color-success-bg)',
                        color: 'var(--color-success)',
                        border: '1px solid var(--color-success-border)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.2s',
                        fontFamily: 'var(--font-body)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
                      onMouseLeave={e => e.currentTarget.style.opacity = 1}
                    >
                      <Edit2 size={10} />
                      {lang === 'sk' ? 'Upraviť' : 'Edit'}
                    </button>
                    {aiProfile.confidence_score && aiProfile.confidence_score < 0.98 && aiProfile.confidence_score !== 1 && (
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                        background: 'var(--overlay-light)',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border)' }}>
                        {Math.min(Math.round(aiProfile.confidence_score * 100), 97)}% {lang === 'sk' ? 'zhoda' : 'match'}
                      </span>
                    )}
                  </div>
                </div>

                {/* AI Headline */}
                {aiProfile.ai_headline && (
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 8, lineHeight: 1.3 }}>
                    {biLang(aiProfile.ai_headline, lang)}
                  </div>
                )}

                {/* Performance Metrics Stats Grid */}
                <div className="grid-responsive cols-3" style={{ gap: 8, marginBottom: 16 }}>
                  {[
                    { value: (aiProfile.hard_skills?.length || 0) + (aiProfile.soft_skills?.length || 0), label: lang === 'sk' ? 'Zručnosti' : 'Skills' },
                    { value: aiProfile.languages?.length || 0, label: lang === 'sk' ? 'Jazyky' : 'Langs' },
                    { value: aiProfile.experience_years || 0, label: lang === 'sk' ? 'Roky praxe' : 'Yrs Exp' },
                  ].map(({ value, label }) => (
                    <div key={label} style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px', textAlign: 'center', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, marginTop: 4, textTransform: 'uppercase' }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* AI Strengths */}
                {biLangArr(aiProfile.ai_strengths, lang).length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                      💪 {lang === 'sk' ? 'Silné stránky' : 'Core Strengths'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {biLangArr(aiProfile.ai_strengths, lang).map(s => (
                        <span key={s} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested Roles */}
                {aiProfile.ai_suggested_roles?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                      🎯 {lang === 'sk' ? 'Odporúčané pozície' : 'Suggested Job Roles'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {aiProfile.ai_suggested_roles.map(r => (
                        <span key={r} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}>{r}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Languages with Levels */}
                {aiProfile.languages?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                      🌐 {lang === 'sk' ? 'Jazyková úroveň' : 'Language Proficiencies'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {aiProfile.languages.map((l, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--text)' }}>{l.lang}</span>
                          <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 5px', borderRadius: 4, background: 'var(--border)', color: 'var(--text-muted)' }}>{l.level}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Education details */}
                {aiProfile.education_level && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 14, background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text)' }}>
                    <GraduationCap size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 700 }}>
                      {{ high_school: lang === 'sk' ? 'Stredná škola' : 'High School', bachelors: lang === 'sk' ? 'Bakalárske štúdium' : "Bachelor's Degree", masters: lang === 'sk' ? 'Magisterské štúdium' : "Master's Degree", phd: 'Doctorate (PhD)' }[aiProfile.education_level] || aiProfile.education_level}
                    </span>
                    {aiProfile.education_field && (
                      <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>· {aiProfile.education_field}</span>
                    )}
                  </div>
                )}

                {/* Missing fields list */}
                {aiProfile.ai_missing_fields?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                      ⚠️ {lang === 'sk' ? 'Odporúčané doplniť' : 'Suggested Additions'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {aiProfile.ai_missing_fields.map(f => (
                        <span key={f} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{f}</span>
                      ))}
                    </div>
                  </div>
                )}


              </motion.div>
            )}



            {/* CV upload card */}
            <div className="profile-card">
              <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={16} style={{ color: 'var(--text-muted)' }} />
                {lang === 'en' ? 'Your Curriculum Vitae' : 'Tvoj životopis'}
              </h3>
              
              {cvs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div 
                    onMouseEnter={() => setHoveringCv(true)}
                    onMouseLeave={() => setHoveringCv(false)}
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                      padding: '14px 16px', background: 'var(--bg-card-hover)', border: '1px solid var(--border)', 
                      borderRadius: 16, position: 'relative'
                    }}
                  >
                    {hoveringCv && (
                      <button
                        onClick={() => setShowDeleteCvModal(true)}
                        title={lang === 'en' ? 'Delete CV' : 'Odstrániť životopis'}
                        style={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: 'var(--color-error)',
                          color: '#fff',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: 9,
                          fontWeight: 900,
                          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
                          zIndex: 10,
                          transition: 'transform 0.2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        ✕
                      </button>
                    )}
                    <div 
                      onClick={() => handleCvPreview(cvs[0].id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1, minWidth: 0 }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📄</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cvs[0].original_filename}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(cvs[0].created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button 
                        onClick={() => handleCvPreview(cvs[0].id)}
                        style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        {lang === 'en' ? 'Preview' : 'Prezrieť'}
                      </button>
                      <label style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: uploading ? 'default' : 'pointer' }}>
                        <input type="file" id="cv-file-input" onChange={handleCvUpload} hidden disabled={uploading} accept=".pdf,.doc,.docx" />
                        {uploading ? '...' : (lang === 'en' ? 'Change' : 'Zmeniť')}
                      </label>
                    </div>
                  {/* Regenerate CV option removed in favor of chatbot interview flow */}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ 
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, 
                    padding: '24px 16px', borderRadius: 16, border: '2px dashed var(--border)', 
                    color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: uploading ? 'default' : 'pointer', transition: 'border-color 0.2s', textAlign: 'center'
                  }}
                  onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <input type="file" id="cv-file-input" onChange={handleCvUpload} hidden disabled={uploading} accept=".pdf,.doc,.docx" />
                    <Paperclip size={24} style={{ color: 'var(--text-muted)' }} />
                    <span>{uploading ? '...' : (lang === 'en' ? 'Upload CV (PDF, DOC, DOCX)' : 'Nahraj životopis (PDF, DOC, DOCX)')}</span>
                  </label>
                  <button 
                    onClick={() => navigate('/messages', { state: { openVerification: true, startCvInterview: true } })}
                    disabled={uploading}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '14px 16px', borderRadius: 16, border: '1px solid var(--accent)',
                      background: 'transparent', color: 'var(--accent)', fontSize: 13, fontWeight: 700,
                      cursor: uploading ? 'default' : 'pointer', transition: 'all 0.2s', width: '100%'
                    }}
                    onMouseOver={e => { if(!uploading) { e.currentTarget.style.background = 'var(--accent-light)'; } }}
                    onMouseOut={e => { if(!uploading) { e.currentTarget.style.background = 'transparent'; } }}
                  >
                    <Bot size={16} />
                    <span>{lang === 'en' ? 'Complete interview to generate CV' : 'Absolvovať pohovor pre vygenerovanie životopisu'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Privacy & Data — GDPR Compliance */}
            <div style={{ marginTop: 16, padding: 20, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {lang === 'en' ? 'Privacy & Data' : 'Súkromie a dáta'}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
                {lang === 'en'
                  ? 'Download a copy of all your personal data (GDPR Art. 15).'
                  : 'Stiahnite si kópiu všetkých vašich osobných údajov (GDPR čl. 15).'}
              </p>
              <button
                onClick={async () => {
                  try {
                    const token = await getAccessTokenAsync() || getAccessToken();
                    const res = await fetch('/api/auth/export-data', {
                      headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!res.ok) throw new Error('Export failed');
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `unemployed-data-export.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch {
                    alert(lang === 'en' ? 'Failed to export data.' : 'Export dát zlyhal.');
                  }
                }}
                style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                {lang === 'en' ? 'Download My Data' : 'Stiahnuť moje dáta'}
              </button>
            </div>

            {/* Logout button */}
            <div style={{ marginTop: 8 }}>
              <button 
                onClick={async () => {
                  await supabase.auth.signOut();
                  localStorage.removeItem('unemployed_apps');
                  localStorage.removeItem('unemployed_profile');
                  window.location.href = '/app';
                }}
                style={{ width: '100%', padding: '14px', borderRadius: 16, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--color-error)'; e.currentTarget.style.color = 'var(--color-error)'; e.currentTarget.style.background = 'var(--color-error-bg)'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <LogOut size={16} /> 
                {lang === 'en' ? 'Log out' : 'Odhlásiť sa'}
              </button>
            </div>


          </div>


        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'var(--overlay-darker)', backdropFilter: 'blur(4px)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={() => { if (!deleting) { setShowDeleteModal(false); setDeleteConfirmText(''); } }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 420, background: 'var(--bg-card)', borderRadius: 24, border: '1px solid rgba(239, 68, 68, 0.3)', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={22} style={{ color: '#ef4444' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#ef4444' }}>
                    {lang === 'en' ? 'Delete Account' : 'Vymazať účet'}
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    {lang === 'en' ? 'This action is permanent and irreversible' : 'Táto akcia je trvalá a nezvratná'}
                  </p>
                </div>
              </div>

              <div style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 14, padding: 16, marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>
                  {lang === 'en'
                    ? 'This will permanently delete your account, profile, CVs, applications, messages, and all associated data. You will not be able to recover any of this information.'
                    : 'Tým sa natrvalo vymaže váš účet, profil, životopisy, žiadosti, správy a všetky súvisiace údaje. Tieto informácie nebude možné obnoviť.'}
                </p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
                  {lang === 'en'
                    ? 'Type "delete my account" to confirm:'
                    : 'Pre potvrdenie napíšte "delete my account":'}
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="delete my account"
                  autoFocus
                  disabled={deleting}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: deleteConfirmText.toLowerCase().trim() === 'delete my account' ? '2px solid #ef4444' : '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box', transition: 'border 0.2s' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  disabled={deleteConfirmText.toLowerCase().trim() !== 'delete my account' || deleting}
                  onClick={async () => {
                    try {
                      setDeleting(true);
                      const token = await getAccessTokenAsync() || getAccessToken();
                      const res = await fetch('/api/auth/delete-account', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ confirmation: deleteConfirmText }),
                      });
                      if (res.ok) {
                        await supabase.auth.signOut();
                        localStorage.clear();
                        window.location.href = '/';
                      } else {
                        const err = await res.json().catch(() => ({}));
                        alert(err.error || 'Failed to delete account');
                      }
                    } catch (err) {
                      console.error('Delete account error:', err);
                      alert(lang === 'en' ? 'Failed to delete account. Try again.' : 'Nepodarilo sa vymazať účet. Skúste to znova.');
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  style={{ flex: 1, padding: '14px', borderRadius: 14, border: 'none', background: deleteConfirmText.toLowerCase().trim() === 'delete my account' && !deleting ? '#ef4444' : 'rgba(239, 68, 68, 0.2)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: deleteConfirmText.toLowerCase().trim() === 'delete my account' && !deleting ? 'pointer' : 'not-allowed', transition: 'all 0.2s', opacity: deleteConfirmText.toLowerCase().trim() === 'delete my account' && !deleting ? 1 : 0.5 }}
                >
                  {deleting ? (lang === 'en' ? 'Deleting...' : 'Mazanie...') : (lang === 'en' ? 'Delete My Account' : 'Vymazať môj účet')}
                </button>
                <button
                  onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                  disabled={deleting}
                  style={{ padding: '14px 24px', borderRadius: 14, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer' }}
                >
                  {lang === 'en' ? 'Cancel' : 'Zrušiť'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete CV Confirmation Modal */}
      <AnimatePresence>
        {showDeleteCvModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'var(--overlay-darker)', backdropFilter: 'blur(4px)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={() => { if (!deletingCv) setShowDeleteCvModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 420, background: 'var(--bg-card)', borderRadius: 24, border: '1px solid var(--border)', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Trash2 size={22} style={{ color: '#ef4444' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                    {lang === 'en' ? 'Delete CV' : 'Odstrániť životopis'}
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    {lang === 'en' ? 'This action is permanent' : 'Táto akcia je trvalá'}
                  </p>
                </div>
              </div>

              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 24 }}>
                <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>
                  {lang === 'en'
                    ? 'Are you sure you want to permanently delete your Curriculum Vitae from your profile? This will remove the document file and cannot be undone.'
                    : 'Naozaj chcete natrvalo odstrániť svoj životopis zo svojho profilu? Týmto sa súbor dokumentu vymaže a túto akciu nemožno vrátiť späť.'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  disabled={deletingCv}
                  onClick={handleDeleteCv}
                  style={{ flex: 1, padding: '14px', borderRadius: 14, border: 'none', background: '#ef4444', color: '#fff', fontSize: 14, fontWeight: 800, cursor: deletingCv ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
                >
                  {deletingCv ? (lang === 'en' ? 'Deleting...' : 'Mazanie...') : (lang === 'en' ? 'Delete' : 'Odstrániť')}
                </button>
                <button
                  onClick={() => setShowDeleteCvModal(false)}
                  disabled={deletingCv}
                  style={{ padding: '14px 24px', borderRadius: 14, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: deletingCv ? 'not-allowed' : 'pointer' }}
                >
                  {lang === 'en' ? 'Cancel' : 'Zrušiť'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditing && tempProfile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ position: 'fixed', inset: 0, background: 'var(--overlay-darker)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={closeEditing}
          >
            <motion.div
              layoutId="profile-info-pill"
              transition={{ type: 'spring', damping: 30, stiffness: 200 }}
              onClick={e => e.stopPropagation()} 
              className="modal-card"
              style={{ maxWidth: 500, transition: 'none' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800 }}>{lang === 'sk' ? 'Upraviť profil' : 'Edit Profile'}</h2>
                <button onClick={closeEditing} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>✕</button>
              </div>

              {/* Banner / Cover Upload in edit modal */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, width: '100%' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{lang === 'sk' ? 'Pozadie profilu' : 'Profile Banner'}</label>
                <div 
                  onClick={() => { setActiveUploadType('cover'); setShowAvatarSourceModal(true); }}
                  style={{ 
                    height: 80, 
                    borderRadius: 12, 
                    border: '1px solid var(--border)', 
                    background: (resolvedCoverUrl || tempProfile.cover_url) && !coverFailed
                      ? `url(${resolvedCoverUrl || tempProfile.cover_url}) center/cover no-repeat`
                      : 'var(--accent)', 
                    position: 'relative', 
                    overflow: 'hidden',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <div style={{ position: 'absolute', inset: 0, background: 'var(--overlay-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, gap: 6, opacity: 0, transition: 'opacity 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0}
                  >
                    <Camera size={16} />
                    <span>{lang === 'sk' ? 'Klikni pre zmenu' : 'Click to change'}</span>
                  </div>
                </div>
              </div>

              {/* Avatar Upload in edit modal */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
                <div 
                  onClick={() => { setActiveUploadType('avatar'); setShowAvatarSourceModal(true); }}
                  style={{ width: 90, height: 90, borderRadius: '50%', background: 'var(--bg)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, overflow: 'hidden', position: 'relative', cursor: 'pointer', marginBottom: 8 }}
                >
                  {(resolvedAvatarUrl || tempProfile.avatar_url) && !avatarFailed ? (
                    <img src={resolvedAvatarUrl || tempProfile.avatar_url} alt="" onError={() => setAvatarFailed(true)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block', borderRadius: '50%' }} />
                  ) : (
                    tempProfile.name ? tempProfile.name.charAt(0).toUpperCase() : 'U'
                  )}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--overlay-dark)', opacity: 0, transition: 'opacity 0.2s', color: '#fff', fontSize: 16 }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                    📷
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lang === 'sk' ? 'Klikni pre zmenu fotky' : 'Click to change photo'}</span>
              </div>

              {/* Name */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>{lang === 'sk' ? 'Meno a priezvisko' : 'Full Name'}</label>
                <input id="profile-name-input" value={tempProfile.name || ''} onChange={e => setTempProfile({...tempProfile, name: e.target.value})}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
              </div>
   
              {/* Location */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>{lang === 'sk' ? 'Lokalita' : 'Location'}</label>
                <input id="profile-loc-input" value={tempProfile.loc || ''} onChange={e => setTempProfile({...tempProfile, loc: e.target.value})} placeholder={lang === 'sk' ? 'napr. Bratislava' : 'e.g. Bratislava'}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {/* Education */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>{lang === 'sk' ? 'Vzdelanie' : 'Education'}</label>
                <input value={tempProfile.edu || ''} onChange={e => setTempProfile({...tempProfile, edu: e.target.value})} placeholder={lang === 'sk' ? 'napr. STU Bratislava' : 'e.g. STU Bratislava'}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {/* Bio / About */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>{lang === 'sk' ? 'O mne' : 'About Me'}</label>
                <textarea value={tempProfile.bio || ''} onChange={e => setTempProfile({...tempProfile, bio: e.target.value})} placeholder={lang === 'sk' ? 'Napíš niečo o sebe...' : 'Tell us about yourself...'}
                  rows={3}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontWeight: 500, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
              </div>

              {/* Skills Editor */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                  {lang === 'sk' ? 'Zručnosti' : 'Skills'}
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {tempProfile.skills.map((skill, index) => (
                    <span key={index} style={{ padding: '4px 8px 4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {skill}
                      <button 
                        type="button"
                        onClick={() => {
                          const updated = tempProfile.skills.filter((_, i) => i !== index);
                          setTempProfile({ ...tempProfile, skills: updated });
                        }}
                        style={{ border: 'none', background: 'none', padding: 0, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center' }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <input 
                    placeholder={lang === 'sk' ? '+ Pridať zručnosť' : '+ Add Skill'}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim();
                        if (val && !tempProfile.skills.includes(val)) {
                          setTempProfile({ ...tempProfile, skills: [...tempProfile.skills, val] });
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: 'transparent', border: '1px dashed var(--border)', color: 'var(--text-muted)',
                      width: 120, outline: 'none', height: 23, boxSizing: 'border-box', fontFamily: 'inherit'
                    }}
                  />
                </div>
              </div>

              {/* Save button */}
              <button onClick={handleSave} disabled={saving}
                style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                {saving ? '...' : (lang === 'sk' ? 'Uložiť zmeny' : 'Save Changes')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Insights Modal */}
      <AnimatePresence>
        {isEditingInsights && tempInsights && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ position: 'fixed', inset: 0, background: 'var(--overlay-darker)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={closeEditingInsights}
          >
            <motion.div
              layoutId="profile-insights-pill"
              transition={{ type: 'spring', damping: 30, stiffness: 200 }}
              onClick={e => e.stopPropagation()} 
              className="modal-card"
              style={{ transition: 'none' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800 }}>{lang === 'sk' ? 'Upraviť Insights' : 'Edit Insights'}</h2>
                <button onClick={closeEditingInsights} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>✕</button>
              </div>

              {/* Headline */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  {lang === 'sk' ? 'Profesijný nadpis' : 'Professional Headline'}
                </div>
                <textarea 
                  value={tempInsights.ai_headline} 
                  onChange={e => setTempInsights({...tempInsights, ai_headline: e.target.value})}
                  placeholder={lang === 'sk' ? 'napr. Junior Frontend Vývojár' : 'e.g. Junior Frontend Developer'}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: '1px dashed var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: 16,
                    fontWeight: 800,
                    lineHeight: 1.3,
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'none',
                    fontFamily: 'inherit'
                  }} 
                />
              </div>

              {/* Stats Grid with Interactive Years */}
              <div className="grid-responsive cols-3" style={{ gap: 8, marginBottom: 20 }}>
                {[
                  { value: (aiProfile.hard_skills?.length || 0) + (aiProfile.soft_skills?.length || 0), label: lang === 'sk' ? 'Zručnosti' : 'Skills' },
                  { value: tempInsights.languages?.length || 0, label: lang === 'sk' ? 'Jazyky' : 'Langs' },
                  { 
                    value: (
                      <input 
                        type="number" 
                        min="0" max="50"
                        value={tempInsights.experience_years}
                        onChange={e => setTempInsights({...tempInsights, experience_years: parseInt(e.target.value) || 0})}
                        style={{
                          width: '100%', border: 'none', background: 'transparent', textAlign: 'center',
                          fontSize: 22, fontWeight: 900, color: 'var(--text)', outline: 'none', padding: 0,
                          fontFamily: 'inherit'
                        }}
                      />
                    ), 
                    label: lang === 'sk' ? 'Roky praxe' : 'Yrs Exp' 
                  },
                ].map(({ value, label }, idx) => (
                  <div key={idx} style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px', textAlign: 'center', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{value}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, marginTop: 4, textTransform: 'uppercase' }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Core Strengths */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  💪 {lang === 'sk' ? 'Silné stránky' : 'Core Strengths'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {tempInsights.ai_strengths.map((s, index) => (
                    <span key={index} style={{ padding: '4px 8px 4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {s}
                      <button 
                        type="button"
                        onClick={() => {
                          const updated = tempInsights.ai_strengths.filter((_, i) => i !== index);
                          setTempInsights({ ...tempInsights, ai_strengths: updated });
                        }}
                        style={{ border: 'none', background: 'none', padding: 0, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center' }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <input 
                    placeholder={lang === 'sk' ? '+ Pridať' : '+ Add'}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim();
                        if (val && !tempInsights.ai_strengths.includes(val)) {
                          setTempInsights({ ...tempInsights, ai_strengths: [...tempInsights.ai_strengths, val] });
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: 'transparent', border: '1px dashed var(--border)', color: 'var(--text-muted)',
                      width: 100, outline: 'none', height: 23, boxSizing: 'border-box', fontFamily: 'inherit'
                    }}
                  />
                </div>
              </div>

              {/* Suggested Job Roles */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  🎯 {lang === 'sk' ? 'Odporúčané pozície' : 'Suggested Job Roles'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {tempInsights.ai_suggested_roles.map((r, index) => (
                    <span key={index} style={{ padding: '4px 8px 4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {r}
                      <button 
                        type="button"
                        onClick={() => {
                          const updated = tempInsights.ai_suggested_roles.filter((_, i) => i !== index);
                          setTempInsights({ ...tempInsights, ai_suggested_roles: updated });
                        }}
                        style={{ border: 'none', background: 'none', padding: 0, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center' }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <input 
                    placeholder={lang === 'sk' ? '+ Pridať' : '+ Add'}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim();
                        if (val && !tempInsights.ai_suggested_roles.includes(val)) {
                          setTempInsights({ ...tempInsights, ai_suggested_roles: [...tempInsights.ai_suggested_roles, val] });
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: 'transparent', border: '1px dashed var(--border)', color: 'var(--text-muted)',
                      width: 100, outline: 'none', height: 23, boxSizing: 'border-box', fontFamily: 'inherit'
                    }}
                  />
                </div>
              </div>

              {/* Languages with Levels */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  🌐 {lang === 'sk' ? 'Jazyková úroveň' : 'Language Proficiencies'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {tempInsights.languages.map((l, index) => (
                    <div key={index} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px 4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text)' }}>{l.lang}</span>
                      <select 
                        value={l.level}
                        onChange={e => {
                          const updated = [...tempInsights.languages];
                          updated[index] = { ...updated[index], level: e.target.value };
                          setTempInsights({ ...tempInsights, languages: updated });
                        }}
                        style={{ fontSize: 9, fontWeight: 900, padding: '1px 3px', borderRadius: 4, background: 'var(--border)', color: 'var(--text)', border: 'none', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        <option value="A1">A1</option>
                        <option value="A2">A2</option>
                        <option value="B1">B1</option>
                        <option value="B2">B2</option>
                        <option value="C1">C1</option>
                        <option value="C2">C2</option>
                        <option value="native">{lang === 'sk' ? 'Rodný' : 'Native'}</option>
                      </select>
                      <button 
                        type="button"
                        onClick={() => {
                          const updated = tempInsights.languages.filter((_, idx) => idx !== index);
                          setTempInsights({ ...tempInsights, languages: updated });
                        }}
                        style={{ border: 'none', background: 'none', padding: 0, color: 'var(--color-error)', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', marginLeft: 2 }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  
                  {/* Add language inline dropdown */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 8, border: '1px dashed var(--border)', height: 23, boxSizing: 'border-box' }}>
                    <input 
                      id="inline-new-lang-name"
                      placeholder={lang === 'sk' ? 'Pridať jazyk' : 'Add Language'}
                      style={{ border: 'none', background: 'transparent', fontSize: 11, width: 90, outline: 'none', color: 'var(--text-muted)', fontFamily: 'inherit' }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = e.currentTarget.value.trim();
                          const levelSelect = document.getElementById('inline-new-lang-level');
                          if (val) {
                            const updated = [...tempInsights.languages, { lang: val, level: levelSelect ? levelSelect.value : 'B2' }];
                            setTempInsights({ ...tempInsights, languages: updated });
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                    />
                    <select 
                      id="inline-new-lang-level"
                      style={{ fontSize: 9, fontWeight: 900, background: 'var(--border)', color: 'var(--text-muted)', border: 'none', outline: 'none', borderRadius: 4, padding: '1px 3px', fontFamily: 'inherit', cursor: 'pointer' }}
                    >
                      <option value="A1">A1</option>
                      <option value="A2">A2</option>
                      <option value="B1">B1</option>
                      <option value="B2" selected>B2</option>
                      <option value="C1">C1</option>
                      <option value="C2">C2</option>
                      <option value="native">{lang === 'sk' ? 'Rodný' : 'Native'}</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const nameInput = document.getElementById('inline-new-lang-name');
                        const levelSelect = document.getElementById('inline-new-lang-level');
                        if (nameInput && nameInput.value.trim()) {
                          const updated = [...tempInsights.languages, { lang: nameInput.value.trim(), level: levelSelect.value }];
                          setTempInsights({ ...tempInsights, languages: updated });
                          nameInput.value = '';
                        }
                      }}
                      style={{ border: 'none', background: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 800, padding: 0, display: 'flex', alignItems: 'center' }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Education details */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  🎓 {lang === 'sk' ? 'Najvyššie vzdelanie' : 'Highest Education'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg)', borderRadius: 10, border: '1px dashed var(--border)', fontSize: 12, color: 'var(--text)' }}>
                  <GraduationCap size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <select 
                    value={tempInsights.education_level || 'unknown'} 
                    onChange={e => setTempInsights({...tempInsights, education_level: e.target.value})}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 700, outline: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}
                  >
                    <option value="high_school">{lang === 'sk' ? 'Stredná škola' : 'High School'}</option>
                    <option value="bachelors">{lang === 'sk' ? 'Bakalárske štúdium' : "Bachelor's Degree"}</option>
                    <option value="masters">{lang === 'sk' ? 'Magisterské štúdium' : "Master's Degree"}</option>
                    <option value="phd">Doctorate (PhD)</option>
                    <option value="unknown">{lang === 'sk' ? 'Neznáme' : 'Unknown'}</option>
                  </select>
                  <span style={{ color: 'var(--text-muted)' }}>·</span>
                  <input 
                    value={tempInsights.education_field || ''} 
                    onChange={e => setTempInsights({...tempInsights, education_field: e.target.value})}
                    placeholder={lang === 'sk' ? 'napr. Odbor štúdia' : 'e.g. Field of Study'}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 500, outline: 'none', width: '100%', fontFamily: 'inherit', fontSize: 12 }}
                  />
                </div>
              </div>

              {/* Save button */}
              <button onClick={handleSaveInsights} disabled={savingInsights}
                style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                {savingInsights ? '...' : (lang === 'sk' ? 'Uložiť Insights' : 'Save Insights')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar Source Selector / Camera Modal */}
      <AnimatePresence>
        {showAvatarSourceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'var(--overlay-darker)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={() => { stopCamera(); setShowAvatarSourceModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              onClick={e => e.stopPropagation()}
              className="modal-card"
              style={{ maxWidth: 380, textAlign: 'center' }}
            >
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: cameraActive ? 16 : 20 }}>
                {cameraActive 
                  ? (lang === 'sk' ? 'Urob fotku' : 'Take a photo') 
                  : (isCover 
                      ? (lang === 'sk' ? 'Zmena pozadia' : 'Profile Banner') 
                      : (lang === 'sk' ? 'Zmena profilovej fotky' : 'Profile Picture'))}
              </h3>

              {cameraActive ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  {/* Live Video Preview (Adaptive crop window preview) */}
                  <div style={{ 
                    width: viewportW, 
                    height: viewportH, 
                    borderRadius: viewportRadius, 
                    overflow: 'hidden', 
                    background: '#000', 
                    border: '3px solid var(--accent)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    position: 'relative' 
                  }}>
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  </div>
                  
                  {/* Camera Actions */}
                  <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 8 }}>
                    <button 
                      onClick={capturePhoto}
                      style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      📸 {lang === 'sk' ? 'Odfotiť' : 'Capture'}
                    </button>
                    <button 
                      onClick={() => { stopCamera(); }}
                      style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      {lang === 'sk' ? 'Späť' : 'Back'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* File Upload Option */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left' }}
                    onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} hidden />
                    <span style={{ fontSize: 24 }}>📂</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
                        {lang === 'sk' ? 'Vybrať súbor' : 'Choose a file'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {lang === 'sk' ? 'Nahrať z galérie alebo súborov' : 'Upload from gallery or local files'}
                      </div>
                    </div>
                  </label>

                  {/* Camera Option */}
                  <div 
                    onClick={startCamera}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <span style={{ fontSize: 24 }}>📷</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
                        {lang === 'sk' ? 'Odfotiť sa' : 'Take a photo'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {lang === 'sk' ? 'Použiť fotoaparát na zariadení' : 'Use device camera'}
                      </div>
                    </div>
                  </div>

                  {/* Compatible Formats Info */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg)', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', marginTop: 4 }}>
                    <AlertTriangle size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'normal', lineHeight: 1.3 }}>
                      {lang === 'sk' 
                        ? 'Podporované: PNG, JPG, JPEG, WEBP · Max: 5 MB' 
                        : 'Compatible with: PNG, JPG, JPEG, WEBP · Max: 5 MB'}
                    </span>
                  </div>

                  {/* Cancel Button */}
                  <button 
                    onClick={() => { stopCamera(); setShowAvatarSourceModal(false); }}
                    style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'var(--border)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 800, cursor: 'pointer', marginTop: 4 }}
                  >
                    {lang === 'sk' ? 'Zrušiť' : 'Cancel'}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas Cropper Modal */}
      <AnimatePresence>
        {cropActive && cropImageSrc && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'var(--overlay-darker)', backdropFilter: 'blur(4px)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="modal-card"
              style={{ maxWidth: 400, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>
                {isCover 
                  ? (lang === 'sk' ? 'Upraviť výrez pozadia' : 'Adjust Banner Photo') 
                  : (lang === 'sk' ? 'Upraviť výrez fotky' : 'Adjust Profile Photo')}
              </h3>

              {/* Viewport for cropping */}
              <div 
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{ 
                  width: viewportW, 
                  height: viewportH, 
                  position: 'relative', 
                  overflow: 'hidden', 
                  borderRadius: viewportRadius, 
                  border: '2px solid var(--accent)', 
                  background: '#000', 
                  cursor: dragActive ? 'grabbing' : 'grab',
                  touchAction: 'none' 
                }}
              >
                <img 
                  src={cropImageSrc} 
                  alt="" 
                  style={{ 
                    transform: `translate(${cropPan.x}px, ${cropPan.y}px) scale(${cropZoom})`, 
                    transformOrigin: 'center', 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover', 
                    pointerEvents: 'none' 
                  }} 
                />
              </div>

              {/* Zoom Slider Control */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>{lang === 'sk' ? 'Priblíženie' : 'Zoom'}</span>
                  <span>{cropZoom.toFixed(1)}x</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="3" 
                  step="0.05" 
                  value={cropZoom} 
                  onChange={e => setCropZoom(parseFloat(e.target.value))} 
                  style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', height: 4, background: 'var(--border)', borderRadius: 2, outline: 'none' }} 
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 8 }}>
                <button 
                  onClick={handleConfirmCrop}
                  style={{ flex: 1.5, padding: '12px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <span style={{ fontWeight: 900 }}>✓</span> {lang === 'sk' ? 'Potvrdiť' : 'Confirm'}
                </button>
                <button 
                  onClick={() => { setCropActive(false); setShowAvatarSourceModal(true); }}
                  style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  {lang === 'sk' ? 'Späť' : 'Back'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
