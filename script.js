// script.js
document.addEventListener('DOMContentLoaded', () => {

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Mobile nav toggle
  const hamburger = document.getElementById('hamburger');
  const mainNav = document.getElementById('mainNav');
  hamburger.addEventListener('click', () => mainNav.classList.toggle('open'));
  mainNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mainNav.classList.remove('open')));

  // FAQ accordion
  document.querySelectorAll('.faq-item').forEach(item => {
    item.querySelector('.faq-q').addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
      if (!isActive) item.classList.add('active');
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
  function initStepFlow(root, { onComplete, pillEl } = {}) {
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
      if (pillEl) pillEl.textContent = `Step ${n} of ${totalSteps}`;

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
    pillEl: document.getElementById('inlineStepPill'),
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

  // Scroll reveal (IntersectionObserver)
  const revealEls = document.querySelectorAll('.reveal');

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(el => el.classList.add('in-view'));
  } else {
    const groupCounters = new WeakMap();
    revealEls.forEach(el => {
      const parent = el.parentElement;
      const count = groupCounters.get(parent) || 0;
      el.style.transitionDelay = `${Math.min(count, 5) * 90}ms`;
      groupCounters.set(parent, count + 1);
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    revealEls.forEach(el => io.observe(el));
  }

  // Subtle 3D tilt on the hero image, following the cursor
  const heroMedia = document.querySelector('.hero-media');
  if (heroMedia && !prefersReducedMotion && window.matchMedia('(hover: hover)').matches) {
    const heroImg = heroMedia.querySelector('img');
    heroMedia.addEventListener('mousemove', (e) => {
      const rect = heroMedia.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      heroImg.style.transform = `rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
    });
    heroMedia.addEventListener('mouseleave', () => {
      heroImg.style.transform = 'rotateY(0) rotateX(0)';
    });
  }

});