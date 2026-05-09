import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

/**
 * CandidateAvatar — robust avatar component that:
 * 1. Tries to find avatar in storage by listing user's folder
 * 2. Falls back to signing the stored avatar_url path
 * 3. Preloads images before rendering to avoid broken icons
 * 4. Shows initials as fallback when no valid image exists
 */
export default function CandidateAvatar({ userId, avatarUrl: rawAvatarUrl, name, size = 46, style = {} }) {
  const [resolvedUrl, setResolvedUrl] = useState(null);

  const initials = (name || 'U').split(' ').map(n => n?.[0] || '').join('').toUpperCase().slice(0, 2) || 'U';

  useEffect(() => {
    let cancelled = false;
    setResolvedUrl(null); // Reset on prop change

    const preload = (url) => new Promise((resolve) => {
      if (!url) return resolve(false);
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });

    const resolve = async () => {
      if (!userId) return;

      // Strategy 1: List storage folder for avatar files
      try {
        const { data: files } = await supabase.storage.from('cvs').list(userId, { limit: 20 });
        const avatarFile = (files || []).find(f => f.name.toLowerCase().startsWith('avatar.'));
        if (avatarFile) {
          const { data } = await supabase.storage.from('cvs').createSignedUrl(`${userId}/${avatarFile.name}`, 3600);
          if (data?.signedUrl && !cancelled) {
            const ok = await preload(data.signedUrl);
            if (ok && !cancelled) { setResolvedUrl(data.signedUrl); return; }
          }
        }
      } catch {}

      // Strategy 2: Sign the raw avatar_url if it looks like a storage path
      if (rawAvatarUrl && !rawAvatarUrl.startsWith('http')) {
        try {
          const { data } = await supabase.storage.from('cvs').createSignedUrl(rawAvatarUrl, 3600);
          if (data?.signedUrl && !cancelled) {
            const ok = await preload(data.signedUrl);
            if (ok && !cancelled) { setResolvedUrl(data.signedUrl); return; }
          }
        } catch {}
      }

      // Strategy 3: Validate the raw URL if it's already a full URL
      if (rawAvatarUrl && rawAvatarUrl.startsWith('http') && !cancelled) {
        const ok = await preload(rawAvatarUrl);
        if (ok && !cancelled) { setResolvedUrl(rawAvatarUrl); return; }
      }

      // Strategy 4: Try common avatar file extensions
      for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
        try {
          const { data } = await supabase.storage.from('cvs').createSignedUrl(`${userId}/avatar.${ext}`, 3600);
          if (data?.signedUrl && !cancelled) {
            const ok = await preload(data.signedUrl);
            if (ok && !cancelled) { setResolvedUrl(data.signedUrl); return; }
          }
        } catch {}
      }
    };

    resolve();
    return () => { cancelled = true; };
  }, [userId, rawAvatarUrl]);

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: Math.round(size * 0.35), color: '#fff',
      flexShrink: 0, position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(135deg, #1a1a1a, #333)',
      border: '1px solid rgba(255,255,255,0.05)',
      ...style,
    }}>
      {resolvedUrl ? (
        <img
          src={resolvedUrl}
          alt=""
          onError={() => setResolvedUrl(null)}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
            borderRadius: '50%',
          }}
        />
      ) : (
        initials
      )}
    </div>
  );
}
