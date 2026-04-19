import React, { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  sk: {
    // Navigation
    'nav.foryou': 'Pre teba',
    'nav.search': 'Hľadať',
    'nav.applications': 'Prihlášky',
    'nav.profile': 'Profil',

    // For You
    'foryou.title': 'Pre teba',
    'foryou.subtitle': 'Tvoje najlepšie zhody, ',
    'foryou.defaultName': 'Kamoško',
    'foryou.loading': 'Načítavam tvoje zhody...',
    'foryou.empty': 'To je všetko!',
    'foryou.emptyDesc': 'Prezri si záložku Prihlášky',
    'foryou.toast': '✓ Máš záujem! Zamestnávateľ sa ti ozve.',

    // Swipe Card / Detail
    'card.verified': 'Overená firma',
    'card.unknownLocation': 'Lokalita neznáma',

    // Job Detail
    'detail.requirements': 'Požiadavky',
    'detail.whatWeOffer': 'Čo ponúkame',
    'detail.showMore': 'Zobraziť viac',
    'detail.showLess': 'Zobraziť menej',
    'detail.apply': 'Mám záujem',
    'detail.applied': 'Už si sa prihlásil/a',

    // Search
    'search.title': 'Hľadať práce',
    'search.placeholder': 'Názov pozície alebo firma...',
    'search.all': 'Všetky',
    'search.parttime': 'Brigády',
    'search.internships': 'Stáže',
    'search.gigs': 'Jednorázovky',
    'search.loading': 'Načítavam ponuky...',
    'search.empty': 'Žiadne výsledky nenašli pre tieto filtre.',
    'search.view': 'Zobraziť',
    'search.filters': 'Podrobné filtre',
    'search.minRate': 'Minimálna odmena',
    'search.focus': 'Zameranie',
    'search.applyFilters': 'Aplikovať filtre',

    // Applications
    'apps.title': 'Tvoje prihlášky',
    'apps.subtitle': 'Sleduj stav svojich pohovorov.',
    'apps.sent': 'Odoslané',
    'apps.interview': 'Pohovor',
    'apps.offer': 'Ponuka!',
    'apps.rejected': 'Zamietnuté',
    'apps.viewMsg': 'Zobraziť správu od',
    'apps.messagePlaceholder': 'Pohovor je naplánovaný na zajtra...',
    'apps.empty': 'Zatiaľ si sa nikam neprihlásil/a.',

    // Profile
    'profile.title': 'Profil',
    'profile.subtitle': 'Tvoj životopis nepotrebujeme.',
    'profile.name': 'Meno',
    'profile.namePlaceholder': 'Tvoje meno',
    'profile.university': 'Univerzita',
    'profile.field': 'Odbor',
    'profile.fieldPlaceholder': 'Čo študuješ?',
    'profile.bio': 'Niečo o tebe',
    'profile.bioPlaceholder': 'Aké sú tvoje silné stránky?',
    'profile.experience': 'Prax a skúsenosti',
    'profile.experiencePlaceholder': 'Kde si naposledy pracoval/a?',
    'profile.save': 'Uložiť profil',
    'profile.toast': 'Profil bol uložený!',

    // Onboarding
    'onboarding.welcome': 'Vitaj,',
    'onboarding.subtitle': 'poďme zistiť, čo hľadáš.',
    'onboarding.name': 'Ako sa voláš?',
    'onboarding.school': 'Kde študuješ?',
    'onboarding.start': 'A poďme hľadať',

    // New Onboarding Flow
    'ob.hook': 'Zabudni na nekonečné hľadanie.',
    'ob.hookSub': 'O chvíľu ti nájdeme prácu. Inteligentne.',
    'ob.uploadTitle': 'Máš životopis?',
    'ob.uploadTitle2': 'Ušetri si čas.',
    'ob.uploadSub': 'Nahraj svoje CV a náš systém z neho vytiahne všetko potrebné.',
    'ob.uploadCta': 'Klikni alebo presuň súbor sem',
    'ob.uploadFormats': 'Podporované: PDF, DOCX (Max 5MB)',
    'ob.noCV': 'Nemám CV, vyplním si to ručne',
    'ob.parsing': 'Extrahujem dáta...',
    'ob.parsingSub': 'Čítam skúsenosti, zručnosti a vzdelanie.',
    'ob.reviewTitle': 'Máme to!',
    'ob.reviewSub': 'Skontroluj, či sme tvoje údaje extrahovali správne. Ak niečo chýba, môžeš si to doplniť neskôr.',
    'ob.reviewName': 'Meno a Priezvisko',
    'ob.reviewNamePlaceholder': 'Zadaj svoje meno...',
    'ob.reviewEdu': 'Vzdelanie',
    'ob.reviewLoc': 'Lokalita',
    'ob.reviewSkills': 'Extrahované zručnosti',
    'ob.reviewAddMore': '+ Pridať ďalšie',
    'ob.reviewConfirm': 'To sedí! Nájdi mi prácu',
    'ob.climax1': 'Hľadáme tvoj match...',
    'ob.climax2': 'Skrolujeme 1 240 pracovných pozícií...',
    'ob.climax3': 'Odstraňujeme tie, čo žiadajú 5 rokov praxe...',
    'ob.climax4': 'Pripravujeme tvoj For You feed',
    'ob.climaxMatch': 'Zhoda 98%',
    'ob.manualName': 'Ako sa voláš?',
    'ob.manualNameSub': 'Personalizujeme tvoj zážitok.',
    'ob.manualNamePh': 'Tvoje celé meno',
    'ob.manualEdu': 'Stupeň vzdelania?',
    'ob.manualEduSub': 'Pomôže nám nájsť správne pozície.',
    'ob.manualLoc': 'Kde bývaš?',
    'ob.manualLocSub': 'Uprednostníme práce v tvojom okolí.',
    'ob.manualType': 'Aký typ práce?',
    'ob.manualTypeSub': 'Vyber jednu alebo viac.',
    'ob.next': 'Pokračovať',
    'ob.finish': 'Dokončiť',
  },
  en: {
    // Navigation
    'nav.foryou': 'For You',
    'nav.search': 'Search',
    'nav.applications': 'Applications',
    'nav.profile': 'Profile',

    // For You
    'foryou.title': 'For You',
    'foryou.subtitle': 'Your best matches, ',
    'foryou.defaultName': 'Buddy',
    'foryou.loading': 'Loading your matches...',
    'foryou.empty': 'That\'s all!',
    'foryou.emptyDesc': 'Check out your Applications tab',
    'foryou.toast': '✓ Interested! The employer will contact you.',

    // Swipe Card / Detail
    'card.verified': 'Verified company',
    'card.unknownLocation': 'Location unknown',

    // Job Detail
    'detail.requirements': 'Requirements',
    'detail.whatWeOffer': 'What we offer',
    'detail.showMore': 'Show more',
    'detail.showLess': 'Show less',
    'detail.apply': 'I\'m interested',
    'detail.applied': 'Already applied',

    // Search
    'search.title': 'Search jobs',
    'search.placeholder': 'Job title or company...',
    'search.all': 'All',
    'search.parttime': 'Part-time',
    'search.internships': 'Internships',
    'search.gigs': 'One-off gigs',
    'search.loading': 'Loading jobs...',
    'search.empty': 'No results found for these filters.',
    'search.view': 'View',
    'search.filters': 'Detailed filters',
    'search.minRate': 'Minimum rate',
    'search.focus': 'Field of interest',
    'search.applyFilters': 'Apply filters',

    // Applications
    'apps.title': 'Your applications',
    'apps.subtitle': 'Track your interview status.',
    'apps.sent': 'Applied',
    'apps.interview': 'Interview',
    'apps.offer': 'Offer!',
    'apps.rejected': 'Rejected',
    'apps.viewMsg': 'View message from',
    'apps.messagePlaceholder': 'Interview scheduled for tomorrow...',
    'apps.empty': 'You haven\'t applied anywhere yet.',

    // Profile
    'profile.title': 'Profile',
    'profile.subtitle': 'We don\'t need your CV.',
    'profile.name': 'Name',
    'profile.namePlaceholder': 'Your name',
    'profile.university': 'University',
    'profile.field': 'Field of study',
    'profile.fieldPlaceholder': 'What are you studying?',
    'profile.bio': 'About you',
    'profile.bioPlaceholder': 'What are your strengths?',
    'profile.experience': 'Experience',
    'profile.experiencePlaceholder': 'Where did you work last?',
    'profile.save': 'Save profile',
    'profile.toast': 'Profile saved!',

    // Onboarding
    'onboarding.welcome': 'Welcome,',
    'onboarding.subtitle': 'let\'s find out what you\'re looking for.',
    'onboarding.name': 'What is your name?',
    'onboarding.school': 'Where do you study?',
    'onboarding.start': 'Let\'s start searching',

    // New Onboarding Flow
    'ob.hook': 'Forget endless scrolling.',
    'ob.hookSub': "We'll find you the right job. Intelligently.",
    'ob.uploadTitle': 'Got a CV?',
    'ob.uploadTitle2': 'Save yourself time.',
    'ob.uploadSub': 'Upload your CV and our system will extract everything you need.',
    'ob.uploadCta': 'Click or drag file here',
    'ob.uploadFormats': 'Supported: PDF, DOCX (Max 5MB)',
    'ob.noCV': "I don't have a CV, I'll fill it in manually",
    'ob.parsing': 'Extracting data...',
    'ob.parsingSub': 'Reading experience, skills and education.',
    'ob.reviewTitle': 'Got it!',
    'ob.reviewSub': 'Check that we extracted your data correctly. You can add more details later.',
    'ob.reviewName': 'Full Name',
    'ob.reviewNamePlaceholder': 'Enter your name...',
    'ob.reviewEdu': 'Education',
    'ob.reviewLoc': 'Location',
    'ob.reviewSkills': 'Extracted skills',
    'ob.reviewAddMore': '+ Add more',
    'ob.reviewConfirm': 'Looks good! Find me a job',
    'ob.climax1': 'Finding your match...',
    'ob.climax2': 'Scrolling through 1,240 job positions...',
    'ob.climax3': 'Removing ones that require 5 years of experience...',
    'ob.climax4': 'Preparing your For You feed',
    'ob.climaxMatch': '98% Match',
    'ob.manualName': 'What is your name?',
    'ob.manualNameSub': 'We personalise your experience.',
    'ob.manualNamePh': 'Your full name',
    'ob.manualEdu': 'Level of education?',
    'ob.manualEduSub': 'Helps us find the right positions.',
    'ob.manualLoc': 'Where do you live?',
    'ob.manualLocSub': 'We prioritise jobs in your area.',
    'ob.manualType': 'What type of work?',
    'ob.manualTypeSub': 'Select one or more.',
    'ob.next': 'Continue',
    'ob.finish': 'Finish',
  }
};

const I18nContext = createContext();

export const I18nProvider = ({ children }) => {
  // Use localStorage or fall back to 'sk'
  const [lang, setLang] = useState(() => {
    // Try to read parent's cookie or standard logic if we had access? 
    // Usually iframe relies on postMessage. We can default to 'sk'.
    return 'sk';
  });

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'lang' && (event.data.lang === 'sk' || event.data.lang === 'en')) {
        setLang(event.data.lang);
      }
      if (event.data && event.data.type === 'theme') {
        const root = document.documentElement;
        if (event.data.theme === 'light') {
          root.setAttribute('data-theme', 'light');
        } else {
          root.removeAttribute('data-theme');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const t = (key) => {
    return translations[lang] && translations[lang][key];
  };

  return (
    <I18nContext.Provider value={{ lang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  return useContext(I18nContext);
};
