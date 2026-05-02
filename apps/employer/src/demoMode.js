export const isDemoMode = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const isDemo = params.get('demo') === 'true' || sessionStorage.getItem('isDemo') === 'true';
    if (isDemo) {
      sessionStorage.setItem('isDemo', 'true');
    }
    return isDemo;
  } catch {
    return false;
  }
};
