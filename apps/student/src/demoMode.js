// Demo mode detection — checks for ?demo=true in the URL
export const isDemoMode = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    // 1. URL Param is the primary source
    let isDemo = params.get('demo') === 'true';
    
    // 2. Session storage persistence
    if (!isDemo) {
      isDemo = sessionStorage.getItem('isDemo') === 'true';
    }

    // 3. Iframe detection - if we are in an iframe on the live site, it's almost certainly a demo
    if (!isDemo && window.self !== window.top) {
       // Only auto-enable demo if we are on the known production domain or localhost
       const host = window.location.hostname;
       if (host === 'unemployed.sk' || host === 'localhost' || host === '127.0.0.1') {
         isDemo = true;
       }
    }

    if (isDemo) {
      sessionStorage.setItem('isDemo', 'true');
    }
    return isDemo;
  } catch {
    return false;
  }
};
