(() => {
  const root = document.documentElement;

  // Splash on every load: scramble the name into place, then fade out. Click or any key skips it.
  const splash = document.querySelector('.splash');
  {
    const name = splash.querySelector('.splash-name');
    const target = name.dataset.text, glyphs = '01<>/{}#$%&*+=?ABCDEFXYZ';
    document.body.style.overflow = 'hidden';
    let done = false;

    // Start the CSS and JS animations together, once fonts are in (or after 1s at most)
    let started = false;
    const start = () => {
      if (started || done) return;
      // A background tab doesn't run CSS animations, so wait until the visitor is looking
      if (document.hidden) { document.addEventListener('visibilitychange', start, { once: true }); return; }
      started = true;
      splash.classList.add('go');
      setTimeout(finish, 2600);
      let frame = 0;
      const total = 32;
      const tick = () => {
        name.textContent = [...target].map((ch, i) => {
          if (ch === ' ') return ' ';
          return i < (frame / total) * target.length ? ch : glyphs[(Math.random() * glyphs.length) | 0];
        }).join('');
        if (++frame <= total) setTimeout(tick, 40);
        else { name.textContent = target; name.classList.add('glitch'); }
      };
      setTimeout(tick, 500);
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(start));
    setTimeout(start, 400);

    const finish = () => {
      if (done) return;
      done = true;
      splash.classList.add('out');
      document.body.style.overflow = '';
      if (current === 'home') playHome();
      setTimeout(() => splash.remove(), 700);
    };
    splash.addEventListener('click', finish);
    addEventListener('keydown', finish, { once: true });
  }

  // Theme: follow the device, unless the visitor picked one
  try {
    const saved = localStorage.getItem('theme');
    if (saved) root.dataset.theme = saved;
  } catch (e) {}
  document.querySelector('.theme-btn').addEventListener('click', () => {
    const dark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
  });

  // Pages: Home, Career, Personal. The hash names the page.
  const order = ['home', 'career', 'personal', 'portfolio'];
  const tabs = document.querySelectorAll('.switch button');
  const home = document.getElementById('view-home');
  let current = null, busy = false;

  function show(view) {
    current = view;
    document.body.dataset.view = view;
    tabs.forEach(t => t.setAttribute('aria-selected', t.dataset.view === view));
    document.querySelector('.switch').dataset.active = view;
    placePill();
    document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== 'view-' + view; });
    document.querySelectorAll('.hero [data-for], .footer-title [data-for]').forEach(el => { el.hidden = !el.dataset.for.split(' ').includes(view); });
    // Replay each section's reveal every time the page is visited
    document.querySelectorAll(`#view-${view} .reveal, .site-footer .reveal`).forEach(el => { el.classList.remove('in'); io.observe(el); });
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (view === 'home' && !document.querySelector('.splash:not(.out)')) playHome();
    if (view === 'portfolio') replay(document.querySelector('.pf-hero'));
  }

  function replay(el) {
    el.classList.remove('play');
    void el.offsetWidth;
    el.classList.add('play');
  }

  // The nav buttons differ in width, so the highlight measures the active one
  function placePill() {
    const sw = document.querySelector('.switch'), active = sw.querySelector('[aria-selected="true"]');
    if (!active) return;
    sw.style.setProperty('--pill-x', `${active.offsetLeft - 4}px`);
    sw.style.setProperty('--pill-w', `${active.offsetWidth}px`);
  }
  addEventListener('resize', placePill);
  if (document.fonts) document.fonts.ready.then(placePill);

  function playHome() {
    home.classList.remove('play');
    void home.offsetWidth; // restart the entrance animation
    home.classList.add('play');
  }

  const viewFromHash = () => (order.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home');
  // Seamless crossfade: the current page fades out, the next one fades in. The nav bar stays put.
  const onScreen = () => [...document.querySelectorAll('.hero, .view, footer')].filter(el => el.getClientRects().length);
  // Split the hero name into words so each one can rise out of its own mask
  const heroName = document.querySelector('.hero h1');
  heroName.innerHTML = heroName.textContent.trim().split(/\s+/)
    .map(w => `<span class="word"><span>${w}</span></span>`).join(' ');

  // Hero entrance: photo pops in, name rises word by word, the rest cascades after it
  function enterHero() {
    if (current === 'home' || current === 'portfolio') return [];
    const hero = document.querySelector('.hero');
    const smooth = 'cubic-bezier(.2, .8, .2, 1)';
    const anims = [];
    anims.push(hero.querySelector('.avatar:not([hidden])').animate(
      [{ opacity: 0, scale: .6, rotate: '-10deg' }, { opacity: 1, scale: 1.06, rotate: '2deg', offset: .7 }, { opacity: 1, scale: 1, rotate: '0deg' }],
      { duration: 700, easing: smooth, fill: 'backwards' }));
    hero.querySelectorAll('.word > span').forEach((w, i) => anims.push(w.animate(
      [{ translate: '0 110%' }, { translate: '0 0' }],
      { duration: 750, delay: 120 + i * 80, easing: smooth, fill: 'backwards' })));
    [hero.querySelector('.eyebrow'), hero.querySelector('.lede:not([hidden])'), ...hero.querySelectorAll('.actions .btn')]
      .forEach((el, i) => anims.push(el.animate(
        [{ opacity: 0, translate: '0 16px', filter: 'blur(6px)' }, { opacity: 1, translate: '0 0', filter: 'blur(0)' }],
        { duration: 600, delay: 200 + i * 70, easing: smooth, fill: 'backwards' })));
    return anims;
  }

  // The nav pill flashes as it slides to the new page
  function pillGlow() {
    document.querySelector('.switch-pill').animate(
      [{ boxShadow: '0 0 0 0 rgba(59,130,246,0)' }, { boxShadow: '0 0 18px 4px rgba(59,130,246,.6)' }, { boxShadow: '0 0 0 0 rgba(59,130,246,0)' }],
      { duration: 900, easing: 'ease-out' });
  }

  let pending = null;
  async function go(view, card) {
    if (busy) { pending = view; return; }
    if (view === current) return;
    busy = true;
    const out = onScreen().map(el => el.animate(
      [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 -8px' }],
      { duration: 260, easing: 'ease-in', fill: 'forwards' }
    ));
    if (card) card.animate([{ scale: 1 }, { scale: 1.03 }], { duration: 260, easing: 'ease-out', fill: 'forwards' });
    pillGlow();
    await Promise.all(out.map(a => a.finished));
    show(view);
    out.forEach(a => a.cancel());
    if (card) card.getAnimations().forEach(a => a.cancel());
    const ins = onScreen().filter(el => !el.classList.contains('hero')).map(el => el.animate(
      [{ opacity: 0, translate: '0 14px' }, { opacity: 1, translate: '0 0' }],
      { duration: 420, easing: 'cubic-bezier(.2, .7, .2, 1)' }
    ));
    ins.push(...enterHero());
    await Promise.all(ins.map(a => a.finished));
    busy = false;
    if (pending && pending !== current) { const next = pending; pending = null; go(next); }
    pending = null;
  }

  function navigate(view, card) {
    if (view === current || busy) return;
    history.pushState(null, '', '#' + view);
    go(view, card);
  }

  tabs.forEach(t => t.addEventListener('click', () => navigate(t.dataset.view)));
  document.querySelector('.brand').addEventListener('click', e => { e.preventDefault(); navigate('home'); });
  document.querySelector('.cta-portfolio').addEventListener('click', e => { e.preventDefault(); navigate('portfolio'); });
  document.querySelector('.to-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // MAG map demo: highlight each project in turn and fly the orange pin to it
  const demo = document.querySelector('.mag-demo');
  if (demo) {
    const items = [...demo.querySelectorAll('.md-item')];
    const stage = demo.querySelector('.md-stage'), marker = demo.querySelector('.md-marker');
    items.forEach(it => {
      const pin = document.createElement('span');
      pin.className = 'md-pin';
      pin.style.setProperty('--x', it.dataset.x + '%');
      pin.style.setProperty('--y', it.dataset.y + '%');
      stage.insertBefore(pin, marker);
    });
    let n = 0;
    const step = () => {
      items.forEach((it, i) => it.classList.toggle('on', i === n));
      marker.style.setProperty('--x', items[n].dataset.x + '%');
      marker.style.setProperty('--y', items[n].dataset.y + '%');
      n = (n + 1) % items.length;
    };
    step();
    setInterval(() => { if (current === 'portfolio') step(); }, 1800);
  }

  // Portfolio view switch: Product work | Digital & social, crossfading between the two lists
  const pfSwitch = document.querySelector('.pf-switch');
  let pfView = 'product', pfBusy = false;
  const pfHero = document.querySelector('.pf-hero');
  document.body.dataset.pf = pfView;
  // Each view has its own header copy, list, orbit, project list and colour
  async function showPf(view, animate = true) {
    if (view === pfView || pfBusy) return;
    pfBusy = true;
    const from = document.querySelector(`[data-pf-panel="${pfView}"]`), to = document.querySelector(`[data-pf-panel="${view}"]`);
    pfSwitch.dataset.active = view;
    pfSwitch.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', b.dataset.pf === view));
    if (animate) {
      await Promise.all([pfHero, from].map(el => el.animate(
        [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 -10px' }],
        { duration: 220, easing: 'ease-in', fill: 'forwards' }).finished));
    }
    document.body.dataset.pf = view;
    document.querySelectorAll('[data-pf-set]').forEach(el => { el.hidden = el.dataset.pfSet !== view; });
    from.hidden = true;
    [pfHero, from].forEach(el => el.getAnimations().forEach(a => a.cancel()));
    to.hidden = false;
    to.classList.remove('in');
    to.querySelectorAll('.reveal').forEach(el => el.classList.remove('in'));
    io.observe(to);
    to.querySelectorAll('.reveal').forEach(el => io.observe(el));
    replay(pfHero);
    if (animate) [pfHero, to].forEach(el => el.animate(
      [{ opacity: 0, translate: '0 14px' }, { opacity: 1, translate: '0 0' }],
      { duration: 420, easing: 'cubic-bezier(.2, .7, .2, 1)' }));
    pfView = view;
    pfBusy = false;
  }
  pfSwitch.querySelectorAll('button').forEach(b => b.addEventListener('click', () => showPf(b.dataset.pf)));

  // Portfolio header: logo tiles and the index jump to their project, and light each other up on hover
  document.querySelectorAll('[data-jump]').forEach(a => {
    a.addEventListener('click', async e => {
      e.preventDefault();
      const target = document.getElementById(a.dataset.jump);
      // switch to the view that holds this project first
      const panel = target.closest('[data-pf-panel]');
      if (panel && panel.hidden) await showPf(panel.dataset.pfPanel, false);
      window.scrollTo({ top: target.getBoundingClientRect().top + scrollY - 90, behavior: 'smooth' });
      target.animate([{ background: 'rgba(59,130,246,.10)' }, { background: 'transparent' }], { duration: 1600, delay: 500, easing: 'ease-out' });
    });
    a.addEventListener('pointerenter', () => document.querySelectorAll(`[data-jump="${a.dataset.jump}"]`).forEach(x => x.classList.add('lit')));
    a.addEventListener('pointerleave', () => document.querySelectorAll(`[data-jump="${a.dataset.jump}"]`).forEach(x => x.classList.remove('lit')));
  });
  document.querySelectorAll('.door').forEach(d => d.addEventListener('click', e => {
    e.preventDefault();
    navigate(d.dataset.view, d);
  }));
  addEventListener('popstate', () => go(viewFromHash()));

  // Cards lean toward the cursor
  document.querySelectorAll('.door').forEach(d => {
    d.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const r = d.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      d.style.setProperty('--rx', `${(-py * 8).toFixed(2)}deg`);
      d.style.setProperty('--ry', `${(px * 10).toFixed(2)}deg`);
      d.style.setProperty('--mx', `${((px + 0.5) * 100).toFixed(1)}%`);
      d.style.setProperty('--my', `${((py + 0.5) * 100).toFixed(1)}%`);
    });
    d.addEventListener('pointerleave', () => { d.style.removeProperty('--rx'); d.style.removeProperty('--ry'); });
  });

  // Fade-in on scroll, and count up the highlight numbers
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      e.target.querySelectorAll('[data-count]').forEach(countUp);
      io.unobserve(e.target);
    });
  }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
  // threshold 0: a section reveals as soon as it enters, however tall it is on a narrow phone
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // Touch screens have no hover: play the hover effects on whatever sits in the middle of the screen
  if (matchMedia('(hover: none)').matches) {
    const focusIo = new IntersectionObserver(entries => {
      entries.forEach(e => e.target.classList.toggle('inview', e.isIntersecting));
    }, { rootMargin: '-38% 0px -38% 0px' });
    document.querySelectorAll('.door, .timeline > li, .edu-list > .edu, .interest, .shot, .brand-stage, .app-stage, .tile')
      .forEach(el => focusIo.observe(el));
  }

  function countUp(el) {
    const end = +el.dataset.count, suffix = el.dataset.suffix || '', t0 = performance.now();
    const step = now => {
      const p = Math.min((now - t0) / 900, 1);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Experience filter
  document.querySelectorAll('.chip-btn').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.chip-btn').forEach(x => x.classList.toggle('is-on', x === b));
    const f = b.dataset.filter;
    document.querySelectorAll('.timeline > li').forEach(li => {
      li.classList.toggle('is-hidden', f !== 'all' && li.dataset.tags !== f);
    });
  }));

  // Photo lightbox
  const shots = [...document.querySelectorAll('.shot')];
  const lb = document.querySelector('.lightbox');
  const lbImg = lb.querySelector('img'), lbCap = lb.querySelector('figcaption');
  let idx = 0;
  function open(i) {
    idx = (i + shots.length) % shots.length;
    const img = shots[idx].querySelector('img');
    lbImg.src = img.src; lbImg.alt = img.alt;
    lbCap.textContent = shots[idx].dataset.caption;
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function close() { lb.hidden = true; document.body.style.overflow = ''; }
  shots.forEach((s, i) => s.addEventListener('click', () => open(i)));
  lb.querySelector('.lb-close').addEventListener('click', close);
  lb.querySelector('.lb-prev').addEventListener('click', () => open(idx - 1));
  lb.querySelector('.lb-next').addEventListener('click', () => open(idx + 1));
  lb.addEventListener('click', e => { if (e.target === lb) close(); });
  document.addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') open(idx - 1);
    if (e.key === 'ArrowRight') open(idx + 1);
  });

  show(viewFromHash());
})();
