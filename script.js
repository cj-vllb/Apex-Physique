// script.js
document.addEventListener('DOMContentLoaded', () => {

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Mobile nav toggle
  const hamburger = document.getElementById('hamburger');
  const mainNav = document.getElementById('mainNav');
  function setNav(open) {
    mainNav.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));
  }
  hamburger.addEventListener('click', () => setNav(!mainNav.classList.contains('open')));
  mainNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setNav(false)));

  // FAQ accordion
  document.querySelectorAll('.faq-item').forEach(item => {
    item.querySelector('.faq-q').addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      document.querySelectorAll('.faq-item').forEach(i => {
        i.classList.remove('active');
        i.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
      });
      if (!isActive) {
        item.classList.add('active');
        item.querySelector('.faq-q').setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Video placeholder -> embed (Step 2: VSL)
  const playBtn = document.getElementById('playBtn');
  const videoWrapper = document.getElementById('videoWrapper');
  playBtn.addEventListener('click', () => {
    videoWrapper.innerHTML = `<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1" title="Apex Physique VSL" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
  });

  // Shared final destination for both flows: hard redirect to the
  // external Thank You page (no more inline "You're booked!" section).
  const THANK_YOU_URL = 'thank-you.html';
  function redirectToThankYou() {
    window.location.href = THANK_YOU_URL;
  }

  /* ---------------------------------------------------------
     Generic step flow controller.
     Works for both the modal flow and the inline flow, scoped
     entirely to their own root element so the two never conflict.
     Toggles between the GHL Form panel (step 1) and the GHL
     Calendar panel (step 2).
  --------------------------------------------------------- */
  function initStepFlow(root, { onComplete } = {}) {
    if (!root) return;

    const dots = Array.from(root.querySelectorAll('.step-dot'));
    const panels = Array.from(root.querySelectorAll('.step-panel'));
    const totalSteps = panels.length;
    let current = 1;

    function fieldError(step, name) {
      return step.querySelector(`[data-error="${name}"]`);
    }

    // Manual field validation is no longer needed here: Step 1 is now a
    // GHL form embed, which handles its own validation and submission.
    // This simply gates forward navigation (hook a GHL onSubmit callback
    // into this to auto-advance instead of the manual "Continue" button).
    function validateStep(step, stepNumber) {
      return true;
    }

    function goToStep(n) {
      current = n;
      panels.forEach(p => p.classList.toggle('active', Number(p.dataset.step) === n));
      dots.forEach(d => {
        const dNum = Number(d.dataset.dot);
        d.classList.toggle('active', dNum === n);
        d.classList.toggle('done', dNum < n);
      });
      const progress = root.querySelector('.step-progress');
      if (progress) progress.setAttribute('aria-label', `Step ${n} of ${totalSteps}`);

      const activePanel = root.querySelector('.step-panel.active');
      const firstField = activePanel && activePanel.querySelector('input, select');
      if (firstField && !prefersReducedMotion) {
        setTimeout(() => firstField.focus({ preventScroll: true }), 100);
      }
    }

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || !root.contains(btn)) return;

      const step = btn.closest('.step-panel');
      const stepNumber = Number(step.dataset.step);
      const action = btn.dataset.action;

      if (action === 'next') {
        if (!validateStep(step, stepNumber)) return;
        // Hook point: send Step 1 / Step 2 data to GoHighLevel webhook/API here
        goToStep(Math.min(stepNumber + 1, totalSteps));
      }

      if (action === 'back') {
        goToStep(Math.max(stepNumber - 1, 1));
      }

      if (action === 'confirm') {
        // The step flow stops here at the Calendar step. GHL typically
        // handles the post-booking redirect natively via the calendar
        // embed's own redirect URL setting, so no inline success DOM is
        // rendered. onComplete (redirectToThankYou) is a manual fallback
        // for this button in case GHL's native redirect isn't configured.
        if (typeof onComplete === 'function') onComplete();
      }
    });

    goToStep(1);
    return { reset: () => goToStep(1) };
  }

  // Inline step flow (below the fold): GHL Form -> GHL Calendar
  const inlineFlow = initStepFlow(document.getElementById('inlineFlow'), {
    onComplete: redirectToThankYou
  });

  // Modal step flow (hero-triggered): GHL Form -> GHL Calendar
  const leadModal = document.getElementById('leadModal');
  const heroCtaBtn = document.getElementById('heroCtaBtn');
  const modalClose = document.getElementById('modalClose');
  const modalFlow = initStepFlow(document.getElementById('modalFlow'), {
    onComplete: redirectToThankYou
  });

  function openModal() {
    if (modalFlow && modalFlow.reset) modalFlow.reset();
    leadModal.classList.add('open');
    leadModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const firstField = leadModal.querySelector('.step-panel.active input, .step-panel.active select');
    if (firstField) setTimeout(() => firstField.focus(), 200);
  }

  function closeModal() {
    leadModal.classList.remove('open');
    leadModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  heroCtaBtn.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);
  leadModal.addEventListener('click', (e) => {
    if (e.target === leadModal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && leadModal.classList.contains('open')) closeModal();
  });

  // Scroll reveal (IntersectionObserver).
  // Elements that enter view in the same pass are staggered in DOM order, so
  // a heading + paragraph + button read as one group without long delays.
  const revealEls = document.querySelectorAll('.reveal, .reveal-img');
  const STAGGER = 80;   // ms, keep in step with --stagger in styles.css
  const MAX_STEPS = 4;

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(el => el.classList.add('in-view'));
  } else {
    // A clipped image can't intersect the viewport, so images are observed
    // through their (unclipped) wrapper and revealed from there.
    const targets = new Map();
    const io = new IntersectionObserver((entries) => {
      entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => (a.target.compareDocumentPosition(b.target) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1)
        .forEach((entry, i) => {
          const el = targets.get(entry.target);
          const base = el.classList.contains('reveal-img') ? 120 : 0;
          el.style.setProperty('--d', `${base + Math.min(i, MAX_STEPS) * STAGGER}ms`);
          el.classList.add('in-view');
          io.unobserve(entry.target);
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -48px 0px' });

    revealEls.forEach(el => {
      const target = el.classList.contains('reveal-img') ? el.parentElement : el;
      targets.set(target, el);
      io.observe(target);
    });

    // Safety net: never leave content hidden if something goes wrong.
    setTimeout(() => revealEls.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && !el.classList.contains('in-view')) el.classList.add('in-view');
    }), 2500);
  }


  /* ---------------------------------------------------------
     Count-up numbers.
     Markup holds the real final value, so it shows correctly with no JS,
     with reduced motion, or if anything below throws. Only the .count
     element changes; units and labels sit outside it.
  --------------------------------------------------------- */
  function initCounters() {
    const counters = Array.from(document.querySelectorAll('.count[data-count]'));
    if (!counters.length || prefersReducedMotion || !('IntersectionObserver' in window)) return;

    const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

    function run(el) {
      const raw = el.dataset.count;
      const target = parseFloat(raw);
      const decimals = (raw.split('.')[1] || '').length;
      const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      const duration = Number(el.dataset.duration) || 1600;
      const delay = Number(el.dataset.delay) || 0;
      let start = null;

      function frame(now) {
        if (start === null) start = now;
        const t = Math.min((now - start) / duration, 1);
        el.textContent = fmt.format(t === 1 ? target : target * easeOutCubic(t));
        if (t < 1) requestAnimationFrame(frame);
      }
      setTimeout(() => requestAnimationFrame(frame), delay);
    }

    try {
      // Start from zero while the block is still hidden by its reveal, so there is no flash of the final value.
      counters.forEach(el => { el.textContent = '0'; });

      const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);          // once per page load
          run(entry.target);
        });
      }, { threshold: 0.6 });
      counters.forEach(el => io.observe(el));
    } catch (err) {
      counters.forEach(el => { el.textContent = new Intl.NumberFormat('en-US').format(parseFloat(el.dataset.count)); });
    }
  }
  initCounters();

  /* ---------------------------------------------------------
     Seamless marquee.
     The original list stays in the DOM as the accessible copy. Aria-hidden
     clones are added until the track is at least one viewport plus one group
     wide, then the track slides left by exactly one group's width, which
     lands on an identical frame, so the loop has no seam.
  --------------------------------------------------------- */
  function initMarquee(root) {
    const track = root.querySelector('.marquee-track');
    const group = root.querySelector('.marquee-group');
    if (!track || !group || prefersReducedMotion) return;

    const SPEED = 40;               // px per second
    let clones = [];
    let last = '';

    function build() {
      root.classList.add('is-running');              // switches the group to its nowrap layout before measuring
      const groupWidth = group.getBoundingClientRect().width;
      const viewWidth = root.clientWidth;
      if (!groupWidth || !viewWidth) return;
      const total = Math.ceil(viewWidth / groupWidth) + 1;
      const key = `${Math.round(groupWidth)}|${total}`;
      if (key === last) return;                      // nothing changed, don't restart the animation
      last = key;

      clones.forEach(c => c.remove());
      clones = [];
      for (let i = 1; i < total; i++) {
        const c = group.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        track.appendChild(c);
        clones.push(c);
      }
      root.style.setProperty('--marquee-shift', `${groupWidth}px`);
      root.style.setProperty('--marquee-dur', `${(groupWidth / SPEED).toFixed(2)}s`);
    }

    build();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
    if ('ResizeObserver' in window) {
      let raf = 0;
      new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(build); }).observe(root);
    } else {
      window.addEventListener('resize', build);
    }
  }
  document.querySelectorAll('[data-marquee]').forEach(initMarquee);

  // Depth parallax for the hero's background peaks (CSS transform only,
  // one rAF-throttled scroll listener, paused while the hero is off-screen).
  const hero = document.getElementById('step1');
  if (hero && !prefersReducedMotion) {
    let ticking = false;
    let heroVisible = true;
    const update = () => {
      hero.style.setProperty('--sy', Math.min(window.scrollY, hero.offsetHeight));
      ticking = false;
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero);
    }
    window.addEventListener('scroll', () => {
      if (!heroVisible || ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
  }

});
