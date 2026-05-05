// Demo mode detection — checks for ?demo=true in the URL
export const isDemoMode = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    let isDemo = params.get('demo') === 'true';
    
    if (!isDemo) {
      isDemo = sessionStorage.getItem('isDemo') === 'true';
    }

    if (!isDemo && window.self !== window.top) {
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
