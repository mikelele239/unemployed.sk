    // Student tab toggle
    document.querySelectorAll('.student-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.student-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.student-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
      });
    });

    // Nav scroll transparency
    const nav = document.querySelector('nav');
    function updateNav() {
      const t = Math.min(window.scrollY / 120, 1);
      const isLight = document.body.classList.contains('light-mode');
      if (isLight) {
        nav.style.background = `rgba(255,255,255,${0.12 + t * 0.12})`;
        nav.style.borderColor = `rgba(255,255,255,${0.18 + t * 0.25})`;
        nav.style.borderTopColor = `rgba(255,255,255,${0.35 + t * 0.4})`;
        nav.style.boxShadow = `0 12px 40px rgba(0,0,0,${0.08 + t*0.1}), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,${0.3 + t*0.55})`;
      } else {
        nav.style.background = `rgba(10,10,10,${0.15 + t * 0.15})`;
        nav.style.borderColor = `rgba(255,255,255,${0.08 + t * 0.06})`;
        nav.style.borderTopColor = `rgba(255,255,255,${0.15 + t * 0.1})`;
        nav.style.boxShadow = `0 12px 40px rgba(0,0,0,${0.15 + t*0.35}), inset 0 1px 0 rgba(255,255,255,${0.08 + t*0.1})`;
      }
    }
    window.addEventListener('scroll', updateNav, { passive: true });
    updateNav();

    // Theme toggle
    const toggle = document.getElementById('themeToggle');
    const toggleMobile = document.getElementById('themeToggleMobile');

    function applyThemeToggle() {
      document.body.classList.toggle('light-mode');
      const isLight = document.body.classList.contains('light-mode');
      // Sync both desktop and mobile toggle icons
      [toggle, toggleMobile].forEach(function(btn) {
        var moon = btn.querySelector('.icon-moon');
        var sun = btn.querySelector('.icon-sun');
        if (moon) moon.style.display = isLight ? 'block' : 'none';
        if (sun) sun.style.display = isLight ? 'none' : 'block';
      });
      setCookie('theme', isLight ? 'light' : 'dark', 8760);
      setTimeout(updateNav, 10);
      // sync theme to demo iframes
      var demoIframe = document.getElementById('demoIframe');
      if (demoIframe && demoIframe.contentWindow) {
        demoIframe.contentWindow.postMessage({ type: 'theme', theme: isLight ? 'light' : 'dark' }, '*');
      }
      var empDemoIframe = document.getElementById('empDemoIframe');
      if (empDemoIframe && empDemoIframe.contentWindow) {
        empDemoIframe.contentWindow.postMessage({ type: 'theme', theme: isLight ? 'light' : 'dark' }, '*');
      }
    }

    toggle.addEventListener('click', applyThemeToggle);
    toggleMobile.addEventListener('click', applyThemeToggle);

    // Mobile menu
    const menuBtn = document.getElementById('menuBtn');
    const mobileNav = document.getElementById('mobileNav');

    menuBtn.addEventListener('click', () => {
      mobileNav.classList.toggle('open');
    });

    document.querySelectorAll('.mobile-dropdown .mobile-link, .mobile-dropdown .mobile-cta').forEach(link => {
      link.addEventListener('click', () => mobileNav.classList.remove('open'));
    });

    document.addEventListener('click', (e) => {
      if (!mobileNav.contains(e.target) && !menuBtn.contains(e.target)) {
        mobileNav.classList.remove('open');
      }
    });

    // Close mobile menu when resizing past the mobile breakpoint
    window.addEventListener('resize', function() {
      if (window.innerWidth > 900 && mobileNav.classList.contains('open')) {
        mobileNav.classList.remove('open');
      }
    });

    // Scroll reveal
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    reveals.forEach(el => observer.observe(el));

    // Rotating hero words
    const rotatingWord = document.getElementById('rotatingWord');
    const words = ['prv\u00FA', 'vysn\u00EDvan\u00FA', 'perfektn\u00FA', 'dobre platen\u00FA', 'flexibiln\u00FA', 'vzdialen\u00FA'];
    let wordIndex = 0;
    rotatingWord.classList.add('in');

    setInterval(() => {
      rotatingWord.classList.remove('in');
      rotatingWord.classList.add('out');
      setTimeout(() => {
        wordIndex = (wordIndex + 1) % words.length;
        rotatingWord.textContent = words[wordIndex];
        rotatingWord.classList.remove('out');
        rotatingWord.classList.add('in');
      }, 400);
    }, 2500);

    // Card stack rotation
    const cards = document.querySelectorAll('.card-carousel .phone-card');
    const totalCards = cards.length;
    let activeIndex = 0;
    let autoTimer;

    function layoutCards() {
      cards.forEach((card, i) => {
        let offset = i - activeIndex;
        if (offset > totalCards / 2) offset -= totalCards;
        if (offset < -totalCards / 2) offset += totalCards;

        const absOffset = Math.abs(offset);
        const spread = window.innerWidth < 600 ? 80 : 160;
        const xShift = offset * spread;
        const scale = Math.max(1 - absOffset * 0.1, 0.7);
        const rotate = offset * 4;
        const zIndex = totalCards - absOffset;
        const opacity = Math.max(1 - absOffset * 0.25, 0.15);

        card.style.transform = `translateX(${xShift}px) scale(${scale}) rotate(${rotate}deg)`;
        card.style.zIndex = zIndex;
        card.style.opacity = opacity;
        card.style.borderColor = offset === 0 ? 'var(--accent)' : 'var(--border)';
        card.style.boxShadow = offset === 0
          ? '0 16px 50px rgba(255,92,0,0.25)'
          : '0 8px 30px rgba(0,0,0,0.25)';
        card.style.cursor = offset === 0 ? 'default' : 'pointer';
      });
    }

    function startAutoRotate() {
      clearInterval(autoTimer);
      autoTimer = setInterval(() => {
        activeIndex = (activeIndex + 1) % totalCards;
        layoutCards();
      }, 5000);
    }

    // Click card to make it active
    cards.forEach((card, i) => {
      card.addEventListener('click', (e) => {
        if (i === activeIndex) return;
        if (e.target.closest('.swipe-btn')) return;
        activeIndex = i;
        layoutCards();
        startAutoRotate();
      });
    });

    // Swipe buttons
    function swipeCard(direction) {
      const card = cards[activeIndex];
      const xOut = direction === 'like' ? 600 : -600;
      const rotOut = direction === 'like' ? 20 : -20;
      card.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
      card.style.transform = `translateX(${xOut}px) scale(0.8) rotate(${rotOut}deg)`;
      card.style.opacity = '0';

      setTimeout(() => {
        card.style.transition = 'none';
        activeIndex = (activeIndex + 1) % totalCards;
        layoutCards();
        requestAnimationFrame(() => {
          cards.forEach(c => {
            c.style.transition = 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.7s ease, border-color 0.3s, background 0.3s, box-shadow 0.7s ease, z-index 0s';
          });
        });
        startAutoRotate();
      }, 500);
    }

    document.querySelectorAll('.swipe-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.phone-card');
        const cardIndex = [...cards].indexOf(card);
        if (cardIndex !== activeIndex) return;
        const isLike = btn.classList.contains('like');
        swipeCard(isLike ? 'like' : 'dislike');
      });
    });

    layoutCards();
    startAutoRotate();

    // Country prefix picker
    const countries = [
      ["AF","Afghanistan","+93"],["AL","Albania","+355"],["DZ","Algeria","+213"],["AD","Andorra","+376"],
      ["AO","Angola","+244"],["AG","Antigua and Barbuda","+1-268"],["AR","Argentina","+54"],["AM","Armenia","+374"],
      ["AU","Australia","+61"],["AT","Austria","+43"],["AZ","Azerbaijan","+994"],["BS","Bahamas","+1-242"],
      ["BH","Bahrain","+973"],["BD","Bangladesh","+880"],["BB","Barbados","+1-246"],["BY","Belarus","+375"],
      ["BE","Belgium","+32"],["BZ","Belize","+501"],["BJ","Benin","+229"],["BT","Bhutan","+975"],
      ["BO","Bolivia","+591"],["BA","Bosnia and Herzegovina","+387"],["BW","Botswana","+267"],["BR","Brazil","+55"],
      ["BN","Brunei","+673"],["BG","Bulgaria","+359"],["BF","Burkina Faso","+226"],["BI","Burundi","+257"],
      ["KH","Cambodia","+855"],["CM","Cameroon","+237"],["CA","Canada","+1"],["CV","Cape Verde","+238"],
      ["CF","Central African Republic","+236"],["TD","Chad","+235"],["CL","Chile","+56"],["CN","China","+86"],
      ["CO","Colombia","+57"],["KM","Comoros","+269"],["CD","Congo (DRC)","+243"],["CG","Congo","+242"],
      ["CR","Costa Rica","+506"],["HR","Croatia","+385"],["CU","Cuba","+53"],["CY","Cyprus","+357"],
      ["CZ","Czech Republic","+420"],["DK","Denmark","+45"],["DJ","Djibouti","+253"],["DM","Dominica","+1-767"],
      ["DO","Dominican Republic","+1-809"],["EC","Ecuador","+593"],["EG","Egypt","+20"],["SV","El Salvador","+503"],
      ["GQ","Equatorial Guinea","+240"],["ER","Eritrea","+291"],["EE","Estonia","+372"],["SZ","Eswatini","+268"],
      ["ET","Ethiopia","+251"],["FJ","Fiji","+679"],["FI","Finland","+358"],["FR","France","+33"],
      ["GA","Gabon","+241"],["GM","Gambia","+220"],["GE","Georgia","+995"],["DE","Germany","+49"],
      ["GH","Ghana","+233"],["GR","Greece","+30"],["GD","Grenada","+1-473"],["GT","Guatemala","+502"],
      ["GN","Guinea","+224"],["GW","Guinea-Bissau","+245"],["GY","Guyana","+592"],["HT","Haiti","+509"],
      ["HN","Honduras","+504"],["HU","Hungary","+36"],["IS","Iceland","+354"],["IN","India","+91"],
      ["ID","Indonesia","+62"],["IR","Iran","+98"],["IQ","Iraq","+964"],["IE","Ireland","+353"],
      ["IL","Israel","+972"],["IT","Italy","+39"],["CI","Ivory Coast","+225"],["JM","Jamaica","+1-876"],
      ["JP","Japan","+81"],["JO","Jordan","+962"],["KZ","Kazakhstan","+7"],["KE","Kenya","+254"],
      ["KI","Kiribati","+686"],["KW","Kuwait","+965"],["KG","Kyrgyzstan","+996"],["LA","Laos","+856"],
      ["LV","Latvia","+371"],["LB","Lebanon","+961"],["LS","Lesotho","+266"],["LR","Liberia","+231"],
      ["LY","Libya","+218"],["LI","Liechtenstein","+423"],["LT","Lithuania","+370"],["LU","Luxembourg","+352"],
      ["MG","Madagascar","+261"],["MW","Malawi","+265"],["MY","Malaysia","+60"],["MV","Maldives","+960"],
      ["ML","Mali","+223"],["MT","Malta","+356"],["MH","Marshall Islands","+692"],["MR","Mauritania","+222"],
      ["MU","Mauritius","+230"],["MX","Mexico","+52"],["FM","Micronesia","+691"],["MD","Moldova","+373"],
      ["MC","Monaco","+377"],["MN","Mongolia","+976"],["ME","Montenegro","+382"],["MA","Morocco","+212"],
      ["MZ","Mozambique","+258"],["MM","Myanmar","+95"],["NA","Namibia","+264"],["NR","Nauru","+674"],
      ["NP","Nepal","+977"],["NL","Netherlands","+31"],["NZ","New Zealand","+64"],["NI","Nicaragua","+505"],
      ["NE","Niger","+227"],["NG","Nigeria","+234"],["KP","North Korea","+850"],["MK","North Macedonia","+389"],
      ["NO","Norway","+47"],["OM","Oman","+968"],["PK","Pakistan","+92"],["PW","Palau","+680"],
      ["PS","Palestine","+970"],["PA","Panama","+507"],["PG","Papua New Guinea","+675"],["PY","Paraguay","+595"],
      ["PE","Peru","+51"],["PH","Philippines","+63"],["PL","Poland","+48"],["PT","Portugal","+351"],
      ["QA","Qatar","+974"],["RO","Romania","+40"],["RU","Russia","+7"],["RW","Rwanda","+250"],
      ["KN","Saint Kitts and Nevis","+1-869"],["LC","Saint Lucia","+1-758"],["VC","Saint Vincent","+1-784"],
      ["WS","Samoa","+685"],["SM","San Marino","+378"],["ST","Sao Tome and Principe","+239"],
      ["SA","Saudi Arabia","+966"],["SN","Senegal","+221"],["RS","Serbia","+381"],["SC","Seychelles","+248"],
      ["SL","Sierra Leone","+232"],["SG","Singapore","+65"],["SK","Slovakia","+421"],["SI","Slovenia","+386"],
      ["SB","Solomon Islands","+677"],["SO","Somalia","+252"],["ZA","South Africa","+27"],
      ["KR","South Korea","+82"],["SS","South Sudan","+211"],["ES","Spain","+34"],["LK","Sri Lanka","+94"],
      ["SD","Sudan","+249"],["SR","Suriname","+597"],["SE","Sweden","+46"],["CH","Switzerland","+41"],
      ["SY","Syria","+963"],["TW","Taiwan","+886"],["TJ","Tajikistan","+992"],["TZ","Tanzania","+255"],
      ["TH","Thailand","+66"],["TL","Timor-Leste","+670"],["TG","Togo","+228"],["TO","Tonga","+676"],
      ["TT","Trinidad and Tobago","+1-868"],["TN","Tunisia","+216"],["TR","Turkey","+90"],
      ["TM","Turkmenistan","+993"],["TV","Tuvalu","+688"],["UG","Uganda","+256"],["UA","Ukraine","+380"],
      ["AE","United Arab Emirates","+971"],["GB","United Kingdom","+44"],["US","United States","+1"],
      ["UY","Uruguay","+598"],["UZ","Uzbekistan","+998"],["VU","Vanuatu","+678"],["VA","Vatican City","+379"],
      ["VE","Venezuela","+58"],["VN","Vietnam","+84"],["YE","Yemen","+967"],["ZM","Zambia","+260"],
      ["ZW","Zimbabwe","+263"]
    ];

    function countryFlag(code) {
      return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
    }

    const phonePrefix = document.getElementById('phonePrefix');
    countries.forEach(([code, name, dial]) => {
      const opt = document.createElement('option');
      opt.value = dial;
      opt.textContent = countryFlag(code) + ' ' + dial;
      if (code === 'SK') opt.selected = true;
      phonePrefix.appendChild(opt);
    });

    // Background grid
    (function() {
      const canvas = document.getElementById('bgGrid');
      const ctx = canvas.getContext('2d');
      const GRID = 80;
      const flashes = [];

      function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      resize();
      window.addEventListener('resize', resize);

      function addFlash() {
        const isDark = !document.body.classList.contains('light-mode');
        const cols = Math.ceil(canvas.width / GRID) + 1;
        const rows = Math.ceil(canvas.height / GRID) + 1;
        const isV = Math.random() > 0.5;
        flashes.push({
          isV,
          idx: isV ? Math.floor(Math.random() * cols) : Math.floor(Math.random() * rows),
          alpha: 0,
          growing: true,
          speed: 0.03 + Math.random() * 0.03
        });
      }

      function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const isDark = !document.body.classList.contains('light-mode');
        const baseAlpha = isDark ? 0.045 : 0.055;
        const baseColor = isDark
          ? `rgba(255,255,255,${baseAlpha})`
          : `rgba(0,0,0,${baseAlpha})`;

        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 1;

        for (let x = 0; x <= canvas.width + GRID; x += GRID) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y <= canvas.height + GRID; y += GRID) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        for (let i = flashes.length - 1; i >= 0; i--) {
          const f = flashes[i];
          if (f.growing) {
            f.alpha += f.speed;
            if (f.alpha >= 1) f.growing = false;
          } else {
            f.alpha -= f.speed * 0.6;
          }
          if (f.alpha <= 0) { flashes.splice(i, 1); continue; }

          ctx.save();
          ctx.strokeStyle = `rgba(255,92,0,${f.alpha * 0.25})`;
          ctx.lineWidth = 1.5;
          ctx.shadowColor = `rgba(255,92,0,${f.alpha * 0.4})`;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          if (f.isV) {
            const x = f.idx * GRID;
            ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
          } else {
            const y = f.idx * GRID;
            ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
          }
          ctx.stroke();
          ctx.restore();
        }
        requestAnimationFrame(draw);
      }

      setInterval(addFlash, 2000);
      draw();
    })();

    // ── i18n ──
    const translations = {
      sk: {
        'nav.students': 'Uchádzači',
        'nav.graduates': 'Absolventi',
        'nav.employers': 'Zamestnávatelia',
        'nav.signup': 'Registruj sa',
        'nav.login': 'Prihlásiť sa',
        'hero.title': 'Nájdi svoju<br><span class="accent"><span class="rotating-word" id="rotatingWord">prvú</span> prácu.</span>',
        'hero.desc': 'Brigády, stáže a plné úväzky pre študentov a absolventov na Slovensku. Inteligentné párovanie, transparentný plat a overení zamestnávatelia — pomôžeme ti byť <span class="strikethrough-wrap"><span class="strike-un">un</span><span class="strike-line"></span></span>employed.',
        'hero.learnMore': 'Zisti viac',
        'card.marketingIntern': 'Marketingový stážista',
        'card.internship': 'Stáž',
        'card.hybrid': 'Hybridné',
        'card.partTime': 'Čiastočný úväzok',
        'card.hrs20': '20 hod/týždeň',
        'card.juniorDev': 'Junior vývojár',
        'card.fullTime': 'Plný úväzok',
        'card.onSite': 'V kancelárii',
        'card.noExp': 'Bez praxe',
        'card.cashier': 'Víkendový pokladník',
        'card.weekends': 'Víkendy',
        'card.flexible': 'Flexibilné',
        'card.dataAnalyst': 'Dátový analytik',
        'card.remote': 'Na diaľku',
        'card.6months': '6 mesiacov',
        'card.warehouse': 'Skladník',
        'card.evenings': 'Večery',
        'card.loc.bratislava': 'Bratislava, Slovensko',
        'card.loc.kosice': 'Košice, Slovensko',
        'card.loc.zilina': 'Žilina, Slovensko',
        'card.loc.nitra': 'Nitra, Slovensko',
        'card.rate.850': '8,50 € <span>/hod</span>',
        'card.rate.1800': '1 800 € <span>/mes</span>',
        'card.rate.720': '7,20 € <span>/hod</span>',
        'card.rate.1000': '10,00 € <span>/hod</span>',
        'card.rate.780': '7,80 € <span>/hod</span>',
        'card.hrs40': '40 hod/týždeň',
        'card.hrs12': '12 hod/týždeň',
        'card.hrs25': '25 hod/týždeň',
        'card.hrs16': '16 hod/týždeň',
        'students.label': 'Pre študentov a absolventov',
        'students.title': 'Od tvojej prvej práce až po tvoj dream job',
        'students.desc': 'Či už hľadáš brigádu, stáž alebo prvú kariérnu pozíciu — máme pre teba to pravé.',
        'students.highschool': 'Stredná škola',
        'students.university': 'Vysoká škola',
        'students.graduates': 'Absolventi',
        'hs.find.title': 'Nájdi svoju prvú prácu',
        'hs.find.desc': 'Žiadne skúsenosti? Žiadny problém. Pozície, kde žiadna kvalifikácia nie je potrebná.',
        'hs.easy.title': 'Jednoducho a rýchlo',
        'hs.easy.desc': 'Prihlás sa jedným klikom — až 3× rýchlejšie ako na bežných portáloch.',
        'hs.gigs.title': 'Jednorázové brigády',
        'hs.gigs.desc': 'Krátkodobé brigády na mieru — odpracuj, zarob a žiadne záväzky.',
        'uni.salary.title': 'Transparentný plat',
        'uni.salary.desc': 'Každá pozícia ukazuje presne, koľko zarobíš — žiadne hádanky, žiadne prekvapenia.',
        'uni.internships.title': 'Stáže pre tvoj odbor',
        'uni.internships.desc': 'Náš párovací algoritmus ti nájde stáže na mieru — a swipovaním štýlom Tinder si rýchlo vyberieš tie, ktoré ťa zaujmú.',
        'uni.comms.title': 'Komunikácia na jednom mieste',
        'uni.comms.desc': 'Správy, pohovory a aktualizácie — všetko prehľadne v jednej aplikácii.',
        'grads.refs.title': 'Referencie a odznaky',
        'grads.refs.desc': 'Získaj odporúčania z predchádzajúcich brigád a odznaky, ktoré dokazujú tvoje výsledky.',
        'grads.jobs.title': 'Top pozície s najlepším platom',
        'grads.jobs.desc': 'Najlepšie platené juniorské pozície na jednom mieste — žiadne pasce typu „5 rokov praxe".',
        'grads.screening.title': 'Overené firmy a stáže na mieru',
        'grads.screening.desc': 'Každá firma je overená a stáže sú vybrané podľa toho, čo ti naozaj sedí.',
        'emp.label': 'Pre zamestnávateľov',
        'emp.title': 'Nábor mladých talentov, bez zbytočnej práce',
        'emp.desc': 'AI predvýber, overení kandidáti a analytika na jednom mieste — nájdite správnych ľudí rýchlejšie.',
        'emp.ai.title': 'AI predvýber a párovanie',
        'emp.ai.desc': 'Naše AI predvyberá a páruje uchádzačov k vašim pozíciám — vidíte len kandidátov, ktorí naozaj sedia.',
        'emp.invite.title': 'Pozvánky z našej databázy',
        'emp.invite.desc': 'Prehľadávajte našu databázu overených kandidátov a pozvite ich priamo na vaše otvorené pozície.',
        'emp.analytics.title': 'Analytika a export dát',
        'emp.analytics.desc': 'Sledujte zobrazenia, prihlášky a výkon náboru — všetko z dashboardu s možnosťou exportu.',
        'emp.autofill.title': 'AI tvorba inzerátov',
        'emp.autofill.desc': 'Vytvorte pracovný inzerát za sekundy — naše AI napíše popis, požiadavky a tagy za vás.',
        'emp.demo': 'Vyskúšaj employer demo',
        'emp.contact': 'Kontaktujte sales pre cenník',
        'emp.toggleLabel': 'Pre zamestnávateľov — zobraziť viac',
        'students.demo': 'Vyskúšaj demo',
        'signup.label': 'Skorý prístup',
        'signup.title': 'Buď jeden z prvých.<br><span style="font-style:italic">Aplikácia príde už čoskoro.</span>',
        'signup.desc': 'Zaregistruj sa a získaj prednostný prístup pred oficiálnym launchom.',
        'signup.counter': '5 000+ registrovaných',
        'signup.emailPh': 'Tvoj email',
        'signup.phonePh': 'Telefónne číslo',
        'signup.iAm': 'Som...',
        'signup.hsStudent': 'Stredoškolák',
        'signup.uniStudent': 'Vysokoškolák',
        'signup.graduate': 'Absolvent',
        'signup.employer': 'Zamestnávateľ',
        'signup.agreeToTerms': 'Súhlasím so <a id="openPrivacy2">Zásadami ochrany osobných údajov</a> a <a id="openTos">Všeobecnými obchodnými podmienkami</a>.',
        'signup.marketingConsent': 'Chcem dostávať novinky a aktualizácie produktu (nepovinné).',
        'signup.submit': 'Registrácia',
        'signup.sending': 'Odosielam…',
        'signup.alreadySubmitted': 'Už si sa zaregistroval/a. Ozveme sa ti čoskoro!',
        'signup.error': 'Nastala chyba. Skús to znova.',
        'signup.prefixLabel': 'Predvoľba krajiny',
        'signup.downloadOn': 'Stiahni na',
        'signup.comingSoon': 'Už čoskoro',
        'toast.success': 'Údaje odoslané — ozveme sa ti!',
        'footer.text': '&copy; 2026 unemployed.sk &middot; Vyrobené na Slovensku 🇸🇰',
        'consent.title': 'Súkromie & cookies',
        'consent.text': 'Používame <strong>funkčné cookies</strong> (jazyk, téma) nevyhnutné pre správne fungovanie webu a <strong>analytické cookies</strong> na zlepšenie služieb. Kliknutím na „Odmietnuť" odmietate len analytické cookies — funkčné cookies zostanú aktívne. Vaše údaje spracúvame podľa <a id="consentPrivacyLink">zásad ochrany súkromia</a>.',
        'consent.accept': 'Súhlasím',
        'consent.decline': 'Odmietnuť',
        'privacy.close': 'Zavrieť',
        'privacy.title': 'Zásady ochrany osobných údajov',
        'privacy.operator': 'Prevádzkovateľ: unemployed.sk &middot; Platné od: 1. apríla 2026',
        'privacy.s1.title': '1. Aké údaje zbierame',
        'privacy.s1.email': 'E-mailová adresa (povinná)',
        'privacy.s1.phone': 'Telefónne číslo vrátane predvoľby krajiny (nepovinné)',
        'privacy.s1.usertype': 'Typ používateľa (stredoškolák / vysokoškolák / absolvent / zamestnávateľ)',
        'privacy.s1.ip': 'IP adresa — zbieraná výlučne na bezpečnostné účely, prevenciu spamu a obmedzenie počtu požiadaviek. Pred uložením je jednosmerným hašovaním (SHA-256) nezvratne anonymizovaná a nie je spájaná s konkrétnou osobou.',
        'privacy.s2.title': '2. Účel spracovania',
        'privacy.s2.desc': 'Údaje spracúvame výlučne za účelom poskytnutia skorého prístupu k aplikácii unemployed.sk a zasielania informácií o jej spustení. Právnym základom je Váš dobrovoľný súhlas (čl. 6 ods. 1 písm. a) GDPR).',
        'privacy.s3.title': '3. Príjemcovia údajov',
        'privacy.s3.desc': 'Vaše osobné údaje neposkytujeme tretím stranám na marketingové účely. Údaje môžeme zdieľať iba s dodávateľmi technickej infraštruktúry (hostingové služby) nevyhnutnej na prevádzku webu, a to výlučne na základe spracovateľských zmlúv.',
        'privacy.s4.title': '4. Doba uchovávania',
        'privacy.s4.desc': 'Údaje uchovávame po dobu nevyhnutnú na splnenie účelu (max. 24 mesiacov od registrácie), alebo kým neodvoláte súhlas.',
        'privacy.s5.title': '5. Vaše práva',
        'privacy.s5.access': 'Právo na prístup k údajom',
        'privacy.s5.rectify': 'Právo na opravu alebo vymazanie',
        'privacy.s5.portability': 'Právo na prenosnosť údajov',
        'privacy.s5.withdraw': 'Právo kedykoľvek odvolať súhlas bez vplyvu na zákonnosť predchádzajúceho spracovania',
        'privacy.s5.complain': 'Právo podať sťažnosť na Úrade na ochranu osobných údajov SR (<a href="https://dataprotection.gov.sk" target="_blank" rel="noopener">dataprotection.gov.sk</a>)',
        'privacy.s6.title': '6. Kontakt',
        'privacy.s6.desc': 'Pre uplatnenie práv alebo otázky k ochrane súkromia nás kontaktujte na: <strong>unemployed.sk@gmail.com</strong>',
        'tos.close': 'Zavrieť',
        'tos.title': 'Všeobecné obchodné podmienky',
        'tos.operator': 'Prevádzkovateľ: unemployed.sk &middot; Platné od: 1. apríla 2026',
        'tos.s1.title': '1. Predmet a rozsah služby',
        'tos.s1.desc': 'Tieto podmienky upravujú používanie čakacej listiny (waitlist) webovej stránky unemployed.sk. Registráciou na čakacej listine nevzniká žiadny zmluvný nárok na prístup k platforme, na konkrétnu funkčnosť ani na termín spustenia. Ide výlučne o predbežný záujem o skorý prístup po spustení služby.',
        'tos.s2.title': '2. Povinnosti používateľa',
        'tos.s2.desc': 'Používateľ sa zaväzuje uviesť pravdivé a aktuálne kontaktné údaje. Registrácia prostredníctvom automatizovaných nástrojov, botov alebo falošných identít je zakázaná.',
        'tos.s3.title': '3. Vylúčenie zodpovednosti',
        'tos.s3.desc': 'Webová stránka a čakacia listina sú poskytované „tak, ako sú" bez akýchkoľvek záruk. Prevádzkovateľ nezodpovedá za žiadne priame ani nepriame škody vyplývajúce z registrácie na čakacej listine, nedostupnosti služby ani z prípadného oneskorenia alebo zrušenia spustenia platformy.',
        'tos.s4.title': '4. Duševné vlastníctvo',
        'tos.s4.desc': 'Všetok obsah webovej stránky unemployed.sk (texty, grafika, logá, zdrojový kód) je chránený autorskými právami prevádzkovateľa. Akékoľvek kopírovanie alebo šírenie bez písomného súhlasu je zakázané.',
        'tos.s5.title': '5. Zmeny podmienok',
        'tos.s5.desc': 'Prevádzkovateľ si vyhradzuje právo tieto podmienky kedykoľvek zmeniť. Aktuálna verzia je vždy dostupná na tejto stránke. Ďalšie používanie služby po zverejnení zmien sa považuje za súhlas s novými podmienkami.',
        'tos.s6.title': '6. Rozhodné právo',
        'tos.s6.desc': 'Tieto podmienky sa riadia právnym poriadkom Slovenskej republiky. Prípadné spory budú riešené pred príslušnými súdmi Slovenskej republiky.',
        'tos.s7.title': '7. Kontakt',
        'tos.s7.desc': 'Otázky k podmienkam zasielajte na: <strong>unemployed.sk@gmail.com</strong>',
      },
      en: {
        'nav.students': 'Job seekers',
        'nav.graduates': 'Graduates',
        'nav.employers': 'Employers',
        'nav.signup': 'Sign up',
        'nav.login': 'Login',
        'hero.title': 'Find your<br><span class="accent"><span class="rotating-word" id="rotatingWord">first</span> job.</span>',
        'hero.desc': 'Part-time jobs, internships and full-time roles for students and graduates in Slovakia. Smart matching, transparent pay and verified employers — we\'ll help you be <span class="strikethrough-wrap"><span class="strike-un">un</span><span class="strike-line"></span></span>employed.',
        'hero.learnMore': 'Learn more',
        'card.marketingIntern': 'Marketing Intern',
        'card.internship': 'Internship',
        'card.hybrid': 'Hybrid',
        'card.partTime': 'Part-time',
        'card.hrs20': '20 hrs/week',
        'card.juniorDev': 'Junior Developer',
        'card.fullTime': 'Full-time',
        'card.onSite': 'On-site',
        'card.noExp': 'No experience',
        'card.cashier': 'Weekend Cashier',
        'card.weekends': 'Weekends',
        'card.flexible': 'Flexible',
        'card.dataAnalyst': 'Data Analyst',
        'card.remote': 'Remote',
        'card.6months': '6 months',
        'card.warehouse': 'Warehouse Worker',
        'card.evenings': 'Evenings',
        'card.loc.bratislava': 'Bratislava, Slovakia',
        'card.loc.kosice': 'Košice, Slovakia',
        'card.loc.zilina': 'Žilina, Slovakia',
        'card.loc.nitra': 'Nitra, Slovakia',
        'card.rate.850': '€8.50 <span>/hr</span>',
        'card.rate.1800': '€1,800 <span>/mo</span>',
        'card.rate.720': '€7.20 <span>/hr</span>',
        'card.rate.1000': '€10.00 <span>/hr</span>',
        'card.rate.780': '€7.80 <span>/hr</span>',
        'card.hrs40': '40 hrs/week',
        'card.hrs12': '12 hrs/week',
        'card.hrs25': '25 hrs/week',
        'card.hrs16': '16 hrs/week',
        'students.label': 'For students & graduates',
        'students.title': 'From your first job to your dream job',
        'students.desc': 'Whether you\'re looking for a gig, an internship or your first career role — we\'ve got you covered.',
        'students.highschool': 'High school',
        'students.university': 'University',
        'students.graduates': 'Graduates',
        'hs.find.title': 'Find your first job',
        'hs.find.desc': 'No experience? No problem. Positions where no qualifications are needed.',
        'hs.easy.title': 'Simple & fast',
        'hs.easy.desc': 'Apply with one click — up to 3× faster than on regular job portals.',
        'hs.gigs.title': 'One-off gigs',
        'hs.gigs.desc': 'Short-term gigs tailored to you — work, earn and no strings attached.',
        'uni.salary.title': 'Transparent pay',
        'uni.salary.desc': 'Every listing shows exactly how much you\'ll earn — no guessing, no surprises.',
        'uni.internships.title': 'Internships for your field',
        'uni.internships.desc': 'Our matching algorithm finds internships tailored to you — and with Tinder-style swiping you can quickly shortlist the ones you like.',
        'uni.comms.title': 'All-in-one communication',
        'uni.comms.desc': 'Messages, interviews and updates — everything in one place, one app.',
        'grads.refs.title': 'Referrals & badges',
        'grads.refs.desc': 'Get recommendations from past jobs and badges that prove your track record.',
        'grads.jobs.title': 'Top positions, highest pay',
        'grads.jobs.desc': 'The best-paid junior positions in one place — no "5 years experience" traps.',
        'grads.screening.title': 'Verified companies & tailored roles',
        'grads.screening.desc': 'Every company is verified and roles are selected based on what truly fits you.',
        'emp.label': 'For employers',
        'emp.title': 'Hire young talent, without the hassle',
        'emp.desc': 'AI pre-screening, verified candidates and analytics in one place — find the right people faster.',
        'emp.ai.title': 'AI pre-screening & matching',
        'emp.ai.desc': 'Our AI pre-screens and matches applicants to your roles — you only see candidates who truly fit.',
        'emp.invite.title': 'Invite from our database',
        'emp.invite.desc': 'Browse our database of verified candidates and invite them directly to your open positions.',
        'emp.analytics.title': 'Analytics & data export',
        'emp.analytics.desc': 'Track views, applications and hiring performance — all from your dashboard with export options.',
        'emp.autofill.title': 'AI-powered listing creation',
        'emp.autofill.desc': 'Create a job listing in seconds — our AI writes the description, requirements and tags for you.',
        'emp.demo': 'Try the employer demo',
        'emp.contact': 'Contact sales for pricing',
        'emp.toggleLabel': 'For employers — show more',
        'students.demo': 'Try the demo',
        'signup.label': 'Early access',
        'signup.title': 'Be one of the first.<br><span style="font-style:italic">The app is coming soon.</span>',
        'signup.desc': 'Sign up and get priority access before the official launch.',
        'signup.counter': '5,000+ registered',
        'signup.emailPh': 'Your email',
        'signup.phonePh': 'Phone number',
        'signup.iAm': 'I am...',
        'signup.hsStudent': 'High school student',
        'signup.uniStudent': 'University student',
        'signup.graduate': 'Graduate',
        'signup.employer': 'Employer',
        'signup.agreeToTerms': 'I agree to the <a id="openPrivacy2">Privacy Policy</a> and <a id="openTos">Terms &amp; Conditions</a>.',
        'signup.marketingConsent': 'I\'d like to receive product news and updates (optional).',
        'signup.submit': 'Sign up',
        'signup.sending': 'Sending…',
        'signup.alreadySubmitted': 'You\'ve already signed up. We\'ll be in touch soon!',
        'signup.error': 'An error occurred. Please try again.',
        'signup.prefixLabel': 'Country code',
        'signup.downloadOn': 'Download on',
        'signup.comingSoon': 'Coming soon',
        'toast.success': 'Data submitted — we\'ll be in touch!',
        'footer.text': '&copy; 2026 unemployed.sk &middot; Made in Slovakia 🇸🇰',
        'consent.title': 'Privacy & cookies',
        'consent.text': 'We use <strong>functional cookies</strong> (language, theme) essential for the site to work, and <strong>analytics cookies</strong> to improve our service. Clicking "Decline" rejects only analytics cookies — functional cookies will remain active. Your data is processed according to our <a id="consentPrivacyLink">privacy policy</a>.',
        'consent.accept': 'Accept',
        'consent.decline': 'Decline',
        'privacy.close': 'Close',
        'privacy.title': 'Privacy Policy',
        'privacy.operator': 'Controller: unemployed.sk &middot; Effective: 1 April 2026',
        'privacy.s1.title': '1. What data we collect',
        'privacy.s1.email': 'Email address (required)',
        'privacy.s1.phone': 'Phone number including country code (optional)',
        'privacy.s1.usertype': 'User type (high school student / university student / graduate / employer)',
        'privacy.s1.ip': 'IP address — collected solely for security, spam prevention, and rate-limiting purposes. It is irreversibly anonymised via one-way SHA-256 hashing before being stored and cannot be linked back to any individual.',
        'privacy.s2.title': '2. Purpose of processing',
        'privacy.s2.desc': 'We process your data solely for the purpose of providing early access to the unemployed.sk app and sending information about its launch. The legal basis is your voluntary consent (Art. 6(1)(a) GDPR).',
        'privacy.s3.title': '3. Recipients of data',
        'privacy.s3.desc': 'We do not share your personal data with third parties for marketing purposes. We may share data only with technical infrastructure providers (hosting services) necessary to operate the website, and only under data processing agreements.',
        'privacy.s4.title': '4. Retention period',
        'privacy.s4.desc': 'We retain your data for the time necessary to fulfil the purpose (max. 24 months from registration), or until you withdraw your consent.',
        'privacy.s5.title': '5. Your rights',
        'privacy.s5.access': 'Right of access to your data',
        'privacy.s5.rectify': 'Right to rectification or erasure',
        'privacy.s5.portability': 'Right to data portability',
        'privacy.s5.withdraw': 'Right to withdraw consent at any time without affecting the lawfulness of prior processing',
        'privacy.s5.complain': 'Right to lodge a complaint with the Slovak Data Protection Authority (<a href="https://dataprotection.gov.sk" target="_blank" rel="noopener">dataprotection.gov.sk</a>)',
        'privacy.s6.title': '6. Contact',
        'privacy.s6.desc': 'To exercise your rights or for any privacy-related questions, contact us at: <strong>unemployed.sk@gmail.com</strong>',
        'tos.close': 'Close',
        'tos.title': 'Terms & Conditions',
        'tos.operator': 'Operator: unemployed.sk &middot; Effective: 1 April 2026',
        'tos.s1.title': '1. Scope of service',
        'tos.s1.desc': 'These terms govern use of the unemployed.sk waitlist. Registering on the waitlist creates no contractual entitlement to platform access, specific features, or a launch date. It represents solely a preliminary expression of interest in early access once the service launches.',
        'tos.s2.title': '2. User obligations',
        'tos.s2.desc': 'Users agree to provide accurate and up-to-date contact details. Registration via automated tools, bots, or false identities is prohibited.',
        'tos.s3.title': '3. Limitation of liability',
        'tos.s3.desc': 'The website and waitlist are provided "as is" without any warranties. The operator is not liable for any direct or indirect damages arising from waitlist registration, service unavailability, or any delay or cancellation of the platform launch.',
        'tos.s4.title': '4. Intellectual property',
        'tos.s4.desc': 'All content on unemployed.sk (text, graphics, logos, source code) is protected by the operator\'s copyright. Any copying or distribution without written consent is prohibited.',
        'tos.s5.title': '5. Changes to terms',
        'tos.s5.desc': 'The operator reserves the right to modify these terms at any time. The current version is always available on this page. Continued use of the service after changes are published constitutes acceptance of the updated terms.',
        'tos.s6.title': '6. Governing law',
        'tos.s6.desc': 'These terms are governed by the laws of the Slovak Republic. Any disputes shall be resolved before the competent courts of the Slovak Republic.',
        'tos.s7.title': '7. Contact',
        'tos.s7.desc': 'Questions about these terms: <strong>unemployed.sk@gmail.com</strong>',
      }
    };

    const heroWordsI18n = {
      sk: ['prvú', 'vysnívanú', 'perfektnú', 'dobre platenú', 'flexibilnú', 'vzdialenú'],
      en: ['first', 'dream', 'perfect', 'well-paid', 'flexible', 'remote']
    };

    let currentLang = 'sk';

    function setLang(lang) {
      currentLang = lang;
      setCookie('lang', lang, 8760);
      const t = translations[lang];
      document.documentElement.lang = lang;

      // text content
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
      });

      // innerHTML content
      document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        if (t[key]) el.innerHTML = t[key];
      });

      // placeholders
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (t[key]) el.placeholder = t[key];
      });

      // aria-labels
      document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria-label');
        if (t[key]) el.setAttribute('aria-label', t[key]);
      });

      // update rotating words
      words.length = 0;
      heroWordsI18n[lang].forEach(w => words.push(w));
      wordIndex = 0;
      rotatingWord.textContent = words[0];

      // re-bind privacy modal link after innerHTML swap
      const privacyLink = document.getElementById('openPrivacy');
      if (privacyLink) {
        privacyLink.addEventListener('click', (e) => {
          e.preventDefault();
          privacyOverlay.classList.add('open');
        });
      }
      const privacyLink2 = document.getElementById('openPrivacy2');
      if (privacyLink2) {
        privacyLink2.addEventListener('click', (e) => {
          e.preventDefault();
          privacyOverlay.classList.add('open');
        });
      }
      const tosLink = document.getElementById('openTos');
      if (tosLink) {
        tosLink.addEventListener('click', (e) => {
          e.preventDefault();
          tosOverlay.classList.add('open');
        });
      }

      // re-bind consent banner privacy link after innerHTML swap
      if (typeof bindConsentPrivacyLink === 'function') bindConsentPrivacyLink();

      // update active lang buttons
      document.querySelectorAll('.lang-switch button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
      });

      // sync language to demo iframe
      var demoIframe = document.getElementById('demoIframe');
      if (demoIframe && demoIframe.contentWindow) {
        demoIframe.contentWindow.postMessage({ type: 'lang', lang: lang }, '*');
      }
      var empDemoIframe = document.getElementById('empDemoIframe');
      if (empDemoIframe && empDemoIframe.contentWindow) {
        empDemoIframe.contentWindow.postMessage({ type: 'lang', lang: lang }, '*');
      }
    }

    // Wire up lang switch buttons
    document.querySelectorAll('.lang-switch button').forEach(btn => {
      btn.addEventListener('click', () => {
        setLang(btn.dataset.lang);
      });
    });

    // Privacy modal
    const privacyOverlay = document.getElementById('privacyOverlay');
    var openPrivacyEl = document.getElementById('openPrivacy');
    if (openPrivacyEl) {
      openPrivacyEl.addEventListener('click', (e) => {
        e.preventDefault();
        privacyOverlay.classList.add('open');
      });
    }
    var openPrivacy2El = document.getElementById('openPrivacy2');
    if (openPrivacy2El) {
      openPrivacy2El.addEventListener('click', (e) => {
        e.preventDefault();
        privacyOverlay.classList.add('open');
      });
    }
    document.getElementById('closePrivacy').addEventListener('click', () => {
      privacyOverlay.classList.remove('open');
    });
    privacyOverlay.addEventListener('click', (e) => {
      if (e.target === privacyOverlay) privacyOverlay.classList.remove('open');
    });

    // Terms & Conditions modal
    const tosOverlay = document.getElementById('tosOverlay');
    var openTosEl = document.getElementById('openTos');
    if (openTosEl) {
      openTosEl.addEventListener('click', (e) => {
        e.preventDefault();
        tosOverlay.classList.add('open');
      });
    }
    document.getElementById('closeTos').addEventListener('click', () => {
      tosOverlay.classList.remove('open');
    });
    tosOverlay.addEventListener('click', (e) => {
      if (e.target === tosOverlay) tosOverlay.classList.remove('open');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        privacyOverlay.classList.remove('open');
        tosOverlay.classList.remove('open');
      }
    });

    // ── Cookie helpers (defined early for consent banner) ──
    function setCookie(name, value, hours) {
      var expires = new Date(Date.now() + hours * 3600000).toUTCString();
      document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
    }
    function getCookie(name) {
      var match = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
      return match ? decodeURIComponent(match[1]) : null;
    }

    // ── Consent banner ──
    (function() {
      var banner = document.getElementById('consentBanner');
      var acceptBtn = document.getElementById('consentAccept');
      var declineBtn = document.getElementById('consentDecline');

      function show() { banner.classList.add('show'); }
      function hide() { banner.classList.remove('show'); }

      window.showConsentBanner = show;
      window.hideConsentBanner = hide;

      window.bindConsentPrivacyLink = function() {
        var link = document.getElementById('consentPrivacyLink');
        if (link) {
          link.addEventListener('click', function(e) {
            e.preventDefault();
            privacyOverlay.classList.add('open');
          });
        }
      };

      acceptBtn.addEventListener('click', function() {
        localStorage.setItem('consentStatus', 'accepted');
        setCookie('consentStatus', 'accepted', 8760);
        hide();
      });

      declineBtn.addEventListener('click', function() {
        localStorage.setItem('consentStatus', 'declined');
        setCookie('consentStatus', 'declined', 8760);
        hide();
      });

      if (!localStorage.getItem('consentStatus') && !getCookie('consentStatus')) {
        setTimeout(show, 800);
      }

      window.bindConsentPrivacyLink();
    })();

    function hasSubmittedRecently() {
      var cookieVal = getCookie('form_submitted_at');
      if (cookieVal && (Date.now() - parseInt(cookieVal, 10)) < 86400000) return true;
      var lsVal = localStorage.getItem('lastSubmitTime');
      if (lsVal && (Date.now() - parseInt(lsVal, 10)) < 86400000) return true;
      return false;
    }

    function markSubmitted() {
      var now = Date.now().toString();
      setCookie('form_submitted_at', now, 24);
      localStorage.setItem('lastSubmitTime', now);
    }

    // ── Form submit + toast + rate limiting + overlay ──
    var signupForm = document.getElementById('signupForm');
    var toast = document.getElementById('toast');
    var formOverlay = document.getElementById('formSubmittedOverlay');
    var toastTimer;

    // Show overlay if already submitted within 24h
    if (hasSubmittedRecently()) {
      formOverlay.classList.add('show');
    }

    signupForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      // If user hasn't accepted consent, show the banner
      if (localStorage.getItem('consentStatus') !== 'accepted') {
        window.showConsentBanner();
        return;
      }

      // Rate limit: 24h between submissions (cookie + localStorage)
      if (hasSubmittedRecently()) {
        formOverlay.classList.add('show');
        return;
      }

      var submitBtn = signupForm.querySelector('button[type="submit"]');
      var originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = translations[currentLang]['signup.sending'];

      var formData = new URLSearchParams(new FormData(signupForm));
      formData.set('consented', document.getElementById('consentTerms').checked ? '1' : '0');
      formData.set('marketingConsent', document.getElementById('consentMarketing').checked ? '1' : '0');

      try {
        var res = await fetch('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        });
        if (res.ok) {
          signupForm.reset();
          markSubmitted();
          clearTimeout(toastTimer);
          toast.classList.add('show');
          toastTimer = setTimeout(function() {
            toast.classList.remove('show');
            // Fade in overlay only after toast disappears
            formOverlay.classList.add('animate');
            requestAnimationFrame(function() {
              formOverlay.classList.add('show');
            });
          }, 5000);
        } else {
          var errData = null;
          try { errData = await res.json(); } catch(_) {}
          // If already registered (429), show the overlay so user knows
          if (res.status === 429) {
            markSubmitted();
            toast.querySelector('.toast-text').textContent = (errData && errData.error) || translations[currentLang]['signup.alreadySubmitted'];
            toast.classList.add('show');
            setTimeout(function(){
              toast.classList.remove('show');
              formOverlay.classList.add('animate');
              requestAnimationFrame(function() {
                formOverlay.classList.add('show');
              });
            }, 3000);
          } else {
            toast.querySelector('.toast-text').textContent = (errData && errData.error) || translations[currentLang]['signup.error'];
            toast.classList.add('show');
            setTimeout(function(){ toast.classList.remove('show'); }, 5000);
          }
        } // end else (non-ok response)
      } catch(err) {
        toast.querySelector('.toast-text').textContent = translations[currentLang]['signup.error'];
        toast.classList.add('show');
        setTimeout(function(){ toast.classList.remove('show'); }, 5000);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });

    // ── Restore theme & language from cookies ──
    (function() {
      var savedTheme = getCookie('theme');
      if (savedTheme === 'light' && !document.body.classList.contains('light-mode')) {
        document.body.classList.add('light-mode');
        document.querySelectorAll('.theme-toggle').forEach(function(btn) {
          var m = btn.querySelector('.icon-moon');
          var s = btn.querySelector('.icon-sun');
          if (m) m.style.display = 'block';
          if (s) s.style.display = 'none';
        });
        updateNav();
      }
      var savedLang = getCookie('lang');
      if (savedLang && savedLang !== currentLang && translations[savedLang]) {
        setLang(savedLang);
      }
      // Save consent status to cookie too
      var consent = localStorage.getItem('consentStatus');
      if (consent) setCookie('consentStatus', consent, 8760);
    })();

    // ── Custom cursor glow ──
    (function() {
      var glow = document.createElement('div');
      glow.className = 'cursor-glow';
      document.body.appendChild(glow);

      var mx = -200, my = -200, gx = -200, gy = -200;
      var rafId;

      document.addEventListener('mousemove', function(e) {
        mx = e.clientX;
        my = e.clientY;
        if (!rafId) rafId = requestAnimationFrame(animateGlow);
      });

      function animateGlow() {
        gx += (mx - gx) * 0.1;
        gy += (my - gy) * 0.1;
        glow.style.left = gx + 'px';
        glow.style.top = gy + 'px';
        if (Math.abs(mx - gx) > 0.5 || Math.abs(my - gy) > 0.5) {
          rafId = requestAnimationFrame(animateGlow);
        } else {
          glow.style.left = mx + 'px';
          glow.style.top = my + 'px';
          rafId = null;
        }
      }

      document.addEventListener('mouseenter', function() {
        glow.style.opacity = '1';
      });
      document.addEventListener('mouseleave', function() {
        glow.style.opacity = '0';
      });

      var hoverSelector = 'a, button, [role="button"], input, select, textarea, .card, .app-badge, .tab-btn, .nav-link, .consent-btn-accept, .consent-btn-decline';
      document.addEventListener('mouseover', function(e) {
        if (e.target.closest(hoverSelector)) glow.classList.add('hovering');
      });
      document.addEventListener('mouseout', function(e) {
        if (e.target.closest(hoverSelector)) glow.classList.remove('hovering');
      });
    })();

    // ── DEMO POPUP ──
    (function() {
      const trigger = document.getElementById('demoTriggerBtn');
      const overlay = document.getElementById('demoOverlay');
      const closeBtn = document.getElementById('demoCloseBtn');
      if (!trigger || !overlay) return;

      var cursorGlow = document.querySelector('.cursor-glow');

      trigger.addEventListener('click', function(e) {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          window.open('/student-demo/', '_blank');
        } else {
          overlay.classList.add('open');
          document.body.style.overflow = 'hidden';
          if (cursorGlow) cursorGlow.style.display = 'none';
          // sync current theme + lang to iframe
          var iframe = document.getElementById('demoIframe');
          if (iframe && iframe.contentWindow) {
            // Reset so onboarding always shows fresh, pass lang so it renders correctly from the start
            iframe.contentWindow.postMessage({ type: 'reset', lang: currentLang }, '*');
            var isLight = document.body.classList.contains('light-mode');
            iframe.contentWindow.postMessage({ type: 'theme', theme: isLight ? 'light' : 'dark' }, '*');
            iframe.contentWindow.postMessage({ type: 'lang', lang: currentLang }, '*');
          }
          // Also set a flag so if the iframe fires 'ready' after this, we re-send
          iframe && (iframe.dataset.pendingLang = currentLang);
        }
      });

      function closeDemo() {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
        if (cursorGlow) cursorGlow.style.display = '';
        var iframe = document.getElementById('demoIframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'reset' }, '*');
        }
      }

      closeBtn.addEventListener('click', closeDemo);
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeDemo();
      });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && overlay.classList.contains('open')) closeDemo();
      });
    })();

    // ── EMPLOYER DEMO POPUP ──
    (function() {
      const trigger = document.getElementById('empDemoTriggerBtn');
      const overlay = document.getElementById('empDemoOverlay');
      const closeBtn = document.getElementById('empDemoCloseBtn');
      if (!trigger || !overlay) return;

      var cursorGlow = document.querySelector('.cursor-glow');

      trigger.addEventListener('click', function(e) {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          window.open('/employer-demo/', '_blank');
        } else {
          overlay.classList.add('open');
          document.body.style.overflow = 'hidden';
          if (cursorGlow) cursorGlow.style.display = 'none';
          var iframe = document.getElementById('empDemoIframe');
          if (iframe && iframe.contentWindow) {
            var isLight = document.body.classList.contains('light-mode');
            iframe.contentWindow.postMessage({ type: 'theme', theme: isLight ? 'light' : 'dark' }, '*');
            iframe.contentWindow.postMessage({ type: 'lang', lang: currentLang }, '*');
          }
          iframe && (iframe.dataset.pendingLang = currentLang);
        }
      });

      function closeEmpDemo() {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
        if (cursorGlow) cursorGlow.style.display = '';
        var iframe = document.getElementById('empDemoIframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'reset' }, '*');
        }
      }

      closeBtn.addEventListener('click', closeEmpDemo);
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeEmpDemo();
      });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && overlay.classList.contains('open')) closeEmpDemo();
      });
    })();

    // ── IFRAME READY LISTENER — re-sends lang when iframe signals it's ready ──
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'ready') {
        var isLight = document.body.classList.contains('light-mode');
        var studentIframe = document.getElementById('demoIframe');
        if (studentIframe && studentIframe.contentWindow) {
          studentIframe.contentWindow.postMessage({ type: 'lang', lang: currentLang }, '*');
          studentIframe.contentWindow.postMessage({ type: 'theme', theme: isLight ? 'light' : 'dark' }, '*');
        }
        var empIframe = document.getElementById('empDemoIframe');
        if (empIframe && empIframe.contentWindow) {
          empIframe.contentWindow.postMessage({ type: 'lang', lang: currentLang }, '*');
          empIframe.contentWindow.postMessage({ type: 'theme', theme: isLight ? 'light' : 'dark' }, '*');
        }
      }
    });

    // ── EMPLOYERS COLLAPSIBLE TOGGLE ──
    (function() {
      const toggle = document.getElementById('empToggle');
      const body = document.getElementById('empBody');
      if (!toggle || !body) return;

      toggle.addEventListener('click', function() {
        const expanded = body.classList.toggle('expanded');
        toggle.classList.toggle('expanded', expanded);
        toggle.setAttribute('aria-expanded', expanded);
        // Re-trigger reveal animations for newly visible content
        if (expanded) {
          body.querySelectorAll('.reveal').forEach(function(el) {
            el.classList.add('visible');
          });
        }
      });
    })();
