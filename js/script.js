(() => {
  'use strict';

  // Activate deferred non-critical stylesheets without inline onload handlers (CSP-safe)
  const activateAsyncStyles = () => {
    document.querySelectorAll('link[data-async-style]').forEach((link) => {
      if (link.media === 'all') return;
      if (link.sheet || document.readyState === 'complete') {
        link.media = 'all';
      } else {
        link.addEventListener('load', () => {
          link.media = 'all';
        }, { once: true });
      }
    });
  };
  activateAsyncStyles();

  document.addEventListener('DOMContentLoaded', () => {
    activateAsyncStyles();

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    // 1. Global Image Error Handler
    document.querySelectorAll('img').forEach((img) => {
      img.addEventListener('error', function () {
        if (this.dataset.fallbackSrc && this.src !== this.dataset.fallbackSrc) {
          this.src = this.dataset.fallbackSrc;
        } else {
          this.style.display = 'none';
          const fallback =
            this.closest('.hero-portrait')?.querySelector('.fallback') ||
            (this.nextElementSibling && this.nextElementSibling.classList.contains('fallback')
              ? this.nextElementSibling
              : null);
          if (fallback) {
            fallback.style.display = 'flex';
          }
        }
      }, { once: true });
    });

    // 2. Desktop-only Cursor Glow (Single passive listener, GPU translate3d, zero initial layer/reflow cost)
    const cursorGlow = document.getElementById('cursorGlow');
    if (cursorGlow && isFinePointer && !prefersReducedMotion) {
      let mouseX = -1000;
      let mouseY = -1000;
      let glowTicking = false;
      let glowVisible = false;

      window.addEventListener('pointermove', (e) => {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (!glowTicking) {
          glowTicking = true;
          requestAnimationFrame(() => {
            if (!glowVisible) {
              cursorGlow.style.opacity = '1';
              glowVisible = true;
            }
            cursorGlow.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
            glowTicking = false;
          });
        }
      }, { passive: true });
    }

    // 3. Mobile Navigation Menu Toggle (CSS drives icon swap & rotation via aria-expanded)
    const navToggle = document.getElementById('navToggle');
    const navbar = document.getElementById('navbar');
    const navBackdrop = document.getElementById('navBackdrop');

    if (navToggle && navbar) {
      const closeMobileNav = () => {
        navbar.classList.remove('mobile-open');
        document.body.classList.remove('menu-open');
        if (navBackdrop) navBackdrop.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
      };

      const openMobileNav = () => {
        navbar.classList.add('mobile-open');
        document.body.classList.add('menu-open');
        if (navBackdrop) navBackdrop.classList.add('active');
        navToggle.setAttribute('aria-expanded', 'true');
      };

      navToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (navbar.classList.contains('mobile-open')) {
          closeMobileNav();
        } else {
          openMobileNav();
        }
      });

      if (navBackdrop) {
        navBackdrop.addEventListener('click', closeMobileNav);
      }

      document.addEventListener('click', (e) => {
        if (
          navbar.classList.contains('mobile-open') &&
          !navbar.contains(e.target) &&
          !navToggle.contains(e.target)
        ) {
          closeMobileNav();
        }
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navbar.classList.contains('mobile-open')) {
          closeMobileNav();
          navToggle.focus();
        }
      });

      window.addEventListener('resize', () => {
        if (window.innerWidth > 960 && navbar.classList.contains('mobile-open')) {
          closeMobileNav();
        }
      }, { passive: true });

      navbar.querySelectorAll('a').forEach((a) => {
        a.addEventListener('click', () => {
          if (window.innerWidth <= 960) {
            closeMobileNav();
          }
        });
      });
    }

    // 4. Active Section Scrollspy (Native CSS scroll-target-group + IntersectionObserver fallback)
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a');

    if (navLinks.length) {
      if (CSS.supports('scroll-target-group: auto')) {
        const syncAriaCurrent = () => {
          const currentLink = document.querySelector('.nav-links a:target-current');
          navLinks.forEach((link) => {
            if (link === currentLink) {
              link.setAttribute('aria-current', 'true');
            } else {
              link.removeAttribute('aria-current');
            }
          });
        };

        if ('onscrollend' in window) {
          document.addEventListener('scrollend', syncAriaCurrent, { passive: true });
        } else {
          let spyTimer = null;
          window.addEventListener('scroll', () => {
            clearTimeout(spyTimer);
            spyTimer = setTimeout(syncAriaCurrent, 120);
          }, { passive: true });
        }
      } else if ('IntersectionObserver' in window) {
        const linkMap = new Map();
        navLinks.forEach((l) => {
          const href = l.getAttribute('href');
          if (href && href.startsWith('#')) {
            linkMap.set(href.slice(1), l);
          }
        });

        const setActiveNav = (id) => {
          const targetLink = linkMap.get(id);
          navLinks.forEach((l) => {
            const active = l === targetLink;
            l.classList.toggle('active', active);
            if (active) {
              l.setAttribute('aria-current', 'true');
            } else {
              l.removeAttribute('aria-current');
            }
          });
        };

        const visibleSections = new Set();
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            const id = entry.target.id || (entry.target.tagName === 'FOOTER' ? 'connect' : '');
            if (!id) return;
            if (entry.isIntersecting) {
              visibleSections.add(id);
            } else {
              visibleSections.delete(id);
            }
          });

          for (const sec of sections) {
            if (visibleSections.has(sec.id)) {
              setActiveNav(sec.id);
              break;
            }
          }
          if (visibleSections.has('connect')) {
            setActiveNav('connect');
          }
        }, {
          rootMargin: '-15% 0px -55% 0px',
          threshold: [0, 0.2]
        });

        sections.forEach((s) => observer.observe(s));
        const footer = document.querySelector('footer');
        if (footer) observer.observe(footer);
      }
    }

    // 5. CSS Scroll-Snap Carousel Controls & Accessible Status Sync
    const desktopMediaQuery = window.matchMedia('(min-width: 641px)');
    const mobileMediaQuery = window.matchMedia('(max-width: 640px)');
    const sliderInstances = [];
    const slidersById = {};

    function setupCarousel(wrapper) {
      const mode = wrapper.dataset.carouselMode || 'always';
      const carouselId = wrapper.dataset.carouselId || '';
      const track = wrapper.querySelector('.slider-track');
      const prevBtn = wrapper.querySelector('[data-carousel-prev]');
      const nextBtn = wrapper.querySelector('[data-carousel-next]');
      const statusEl = wrapper.querySelector('[data-carousel-status]');
      if (!track || !prevBtn || !nextBtn) return null;

      const slides = Array.from(track.children);
      const totalItems = slides.length;
      let pendingIndex = 0;
      let lastSettledIndex = 0;
      let hasInteracted = false;

      function isCarouselActive() {
        return mode === 'always' || !desktopMediaQuery.matches;
      }

      function getItemsPerView() {
        return (mode === 'always' && desktopMediaQuery.matches) ? 2 : 1;
      }

      function getMaxIndex() {
        return Math.max(0, totalItems - getItemsPerView());
      }

      function syncButtons(index) {
        if (!isCarouselActive()) {
          prevBtn.disabled = true;
          nextBtn.disabled = true;
          return;
        }
        const maxIndex = getMaxIndex();
        const clamped = Math.min(Math.max(0, index), maxIndex);
        const prevWasFocused = document.activeElement === prevBtn;
        const nextWasFocused = document.activeElement === nextBtn;

        prevBtn.disabled = clamped <= 0;
        nextBtn.disabled = clamped >= maxIndex;

        if (prevWasFocused && prevBtn.disabled && !nextBtn.disabled) {
          nextBtn.focus({ preventScroll: true });
        } else if (nextWasFocused && nextBtn.disabled && !prevBtn.disabled) {
          prevBtn.focus({ preventScroll: true });
        }
      }

      function getPadLeft() {
        return parseFloat(getComputedStyle(track).paddingLeft) || 0;
      }

      function getNearestIndex() {
        if (!isCarouselActive() || slides.length === 0) return 0;
        const padLeft = getPadLeft();
        const scrollLeft = track.scrollLeft;
        const maxIndex = getMaxIndex();
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i <= maxIndex; i++) {
          const dist = Math.abs((slides[i].offsetLeft - padLeft) - scrollLeft);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
          }
        }
        return bestIdx;
      }

      function announceSlide(index) {
        if (!statusEl || !hasInteracted) return;
        const perView = getItemsPerView();
        const start = index + 1;
        if (perView > 1) {
          const end = Math.min(totalItems, index + perView);
          statusEl.textContent = `Showing items ${start} to ${end} of ${totalItems}`;
        } else {
          statusEl.textContent = `Slide ${start} of ${totalItems}`;
        }
      }

      function goToIndex(targetIndex, animate = true) {
        if (!isCarouselActive() || slides.length === 0) return;
        const maxIndex = getMaxIndex();
        pendingIndex = Math.min(Math.max(0, targetIndex), maxIndex);
        hasInteracted = true;
        syncButtons(pendingIndex);

        const padLeft = getPadLeft();
        const targetLeft = Math.max(0, slides[pendingIndex].offsetLeft - padLeft);
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        track.scrollTo({
          left: targetLeft,
          behavior: (animate && !reduceMotion) ? 'smooth' : 'instant'
        });
      }

      function onSettled() {
        if (!isCarouselActive()) {
          pendingIndex = 0;
          lastSettledIndex = 0;
          syncButtons(0);
          return;
        }
        const settled = getNearestIndex();
        pendingIndex = settled;
        syncButtons(settled);
        if (settled !== lastSettledIndex) {
          lastSettledIndex = settled;
          announceSlide(settled);
        }
      }

      prevBtn.addEventListener('click', () => {
        goToIndex(pendingIndex - 1, true);
      });

      nextBtn.addEventListener('click', () => {
        goToIndex(pendingIndex + 1, true);
      });

      if ('onscrollend' in window) {
        track.addEventListener('scrollend', () => {
          hasInteracted = true;
          onSettled();
        }, { passive: true });
      } else {
        let scrollSettleTimer = null;
        track.addEventListener('scroll', () => {
          hasInteracted = true;
          clearTimeout(scrollSettleTimer);
          scrollSettleTimer = setTimeout(onSettled, 120);
        }, { passive: true });
      }

      // Initialize button disabled state with ZERO forced reflow on DOMContentLoaded
      if (!isCarouselActive()) {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
      } else {
        prevBtn.disabled = true;
        nextBtn.disabled = getMaxIndex() === 0;
      }

      const instance = {
        sync() {
          if (!isCarouselActive()) {
            pendingIndex = 0;
            lastSettledIndex = 0;
            syncButtons(0);
            return;
          }
          const idx = getNearestIndex();
          pendingIndex = idx;
          lastSettledIndex = idx;
          syncButtons(idx);
        },
        reset() {
          pendingIndex = 0;
          lastSettledIndex = 0;
          if (isCarouselActive()) {
            track.scrollTo({ left: 0, behavior: 'instant' });
          }
          syncButtons(0);
        }
      };

      sliderInstances.push(instance);
      if (carouselId) slidersById[carouselId] = instance;
      return instance;
    }

    document.querySelectorAll('[data-carousel]').forEach(setupCarousel);

    const clientSlider = slidersById.testimonials;
    const colleagueSlider = slidersById.colleagueTestimonials;

    // 6. Testimonials Modal & Lazy Mobile-Only Overflow / Legacy Scroll-Fade Fallback
    const testimonialsSection = document.getElementById('testimonials');
    const testimonialCards = Array.from(document.querySelectorAll('#testimonials .testimonial-card'));
    const testimonialModal = document.getElementById('testimonialModal');
    const testimonialModalQuote = document.getElementById('testimonialModalQuote');
    const testimonialModalAuthor = document.getElementById('testimonialModalAuthor');
    const testimonialModalRole = document.getElementById('testimonialModalRole');
    const testimonialModalContext = document.getElementById('testimonialModalContext');
    const supportsUntilFound = 'onbeforematch' in HTMLElement.prototype;

    let testimonialsInView = false;
    let fadeMaskInitialized = false;

    function syncMobileExpandButtons() {
      if (!testimonialsInView || !mobileMediaQuery.matches) return;
      const clientPanel = document.getElementById('clientTestimonialsPanel');
      const colleaguePanel = document.getElementById('colleagueTestimonialsPanel');
      const activePanel = (colleaguePanel && colleaguePanel.classList.contains('is-active'))
        ? colleaguePanel
        : clientPanel;
      const cards = activePanel
        ? Array.from(activePanel.querySelectorAll('.testimonial-card'))
        : testimonialCards;

      const measurements = cards.map((card) => {
        const bq = card.querySelector('blockquote');
        if (!bq || bq.clientHeight === 0) return null;
        return { card, hasOverflow: bq.scrollHeight > bq.clientHeight + 2 };
      });
      measurements.forEach((m) => {
        if (m) m.card.classList.toggle('has-overflow', m.hasOverflow);
      });
    }

    function initOverflowFadeMasks() {
      if (fadeMaskInitialized || !('IntersectionObserver' in window)) return;
      fadeMaskInitialized = true;
      testimonialCards.forEach((card) => {
        const bq = card.querySelector('blockquote');
        if (!bq) return;
        const endSentinel = document.createElement('span');
        endSentinel.setAttribute('aria-hidden', 'true');
        endSentinel.style.cssText = 'display:block;width:1px;height:1px;pointer-events:none;';
        bq.appendChild(endSentinel);
        const obs = new IntersectionObserver((entries) => {
          const entry = entries[entries.length - 1];
          bq.classList.toggle('more-end', !entry.isIntersecting);
        }, { root: bq, threshold: 0.1 });
        obs.observe(endSentinel);
      });
    }

    if (testimonialsSection && 'IntersectionObserver' in window) {
      const sectionObserver = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          testimonialsInView = true;
          sectionObserver.disconnect();
          requestAnimationFrame(() => {
            syncMobileExpandButtons();
            initOverflowFadeMasks();
          });
        }
      }, { rootMargin: '200px 0px' });
      sectionObserver.observe(testimonialsSection);
    }

    testimonialCards.forEach((card) => {
      const bq = card.querySelector('blockquote');
      const expandBtn = card.querySelector('.testimonial-expand-btn');

      if (expandBtn && testimonialModal) {
        expandBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const nameLink = card.querySelector('.testimonial-attr .name a');
          const nameEl = card.querySelector('.testimonial-attr .name');
          const roleEl = card.querySelector('.testimonial-attr .role');
          const contextEl = card.querySelector('.testimonial-attr .context');

          if (testimonialModalQuote && bq) testimonialModalQuote.textContent = bq.textContent;
          if (testimonialModalAuthor) {
            testimonialModalAuthor.textContent = '';
            if (nameLink) {
              testimonialModalAuthor.appendChild(nameLink.cloneNode(true));
            } else if (nameEl) {
              testimonialModalAuthor.textContent = nameEl.textContent;
            }
          }
          if (testimonialModalRole && roleEl) testimonialModalRole.textContent = roleEl.textContent;
          if (testimonialModalContext) {
            if (contextEl && contextEl.textContent) {
              testimonialModalContext.textContent = contextEl.textContent;
              testimonialModalContext.hidden = false;
            } else {
              testimonialModalContext.textContent = '';
              testimonialModalContext.hidden = true;
            }
          }
          testimonialModal.showModal();
        });
      }
    });

    if (testimonialModal && !('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (e, dialog) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      testimonialModal.addEventListener('pointerdown', (e) => {
        pressedOutside = outside(e, testimonialModal);
      });
      testimonialModal.addEventListener('pointerup', (e) => {
        if (pressedOutside && outside(e, testimonialModal)) testimonialModal.close();
      });
    }

    let resizeTimeout = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        sliderInstances.forEach((s) => s.sync());
        syncMobileExpandButtons();
      }, 100);
    }, { passive: true });

    if (typeof desktopMediaQuery.addEventListener === 'function') {
      desktopMediaQuery.addEventListener('change', () => {
        sliderInstances.forEach((s) => s.sync());
        syncMobileExpandButtons();
      });
    }

    // 7. Testimonials Section Tabs, hidden="until-found" beforematch & Mobile Switcher
    const clientTab = document.getElementById('clientTab');
    const colleagueTab = document.getElementById('colleagueTab');
    const clientPanel = document.getElementById('clientTestimonialsPanel');
    const colleaguePanel = document.getElementById('colleagueTestimonialsPanel');
    const testimonialsBurgerBtn = document.getElementById('testimonialsBurgerBtn');
    const testimonialsActiveHeading = document.getElementById('testimonialsActiveHeading');

    if (clientTab && colleagueTab && clientPanel && colleaguePanel) {
      const tabs = [clientTab, colleagueTab];

      function hidePanel(panel) {
        if (supportsUntilFound) {
          panel.setAttribute('hidden', 'until-found');
        } else {
          panel.hidden = true;
        }
      }

      function activateTestimonialsTab(targetTab, focusTab = false) {
        const isColleague = targetTab === colleagueTab;

        tabs.forEach((tab) => {
          const active = tab === targetTab;
          tab.classList.toggle('is-active', active);
          tab.setAttribute('aria-selected', active ? 'true' : 'false');
          tab.setAttribute('tabindex', active ? '0' : '-1');
        });

        clientPanel.classList.toggle('is-active', !isColleague);
        if (isColleague) {
          hidePanel(clientPanel);
          colleaguePanel.removeAttribute('hidden');
        } else {
          clientPanel.removeAttribute('hidden');
          hidePanel(colleaguePanel);
        }
        colleaguePanel.classList.toggle('is-active', isColleague);

        if (testimonialsActiveHeading) {
          testimonialsActiveHeading.textContent = isColleague
            ? 'Colleagues'
            : 'Client Testimonials';
        }

        if (testimonialsBurgerBtn) {
          testimonialsBurgerBtn.setAttribute(
            'aria-label',
            isColleague ? 'Switch to Client Testimonials' : 'Switch to Colleagues testimonials'
          );
        }

        if (isColleague && colleagueSlider) {
          colleagueSlider.sync();
        } else if (!isColleague && clientSlider) {
          clientSlider.sync();
        }

        requestAnimationFrame(syncMobileExpandButtons);

        if (focusTab) {
          targetTab.focus();
        }
      }

      clientPanel.addEventListener('beforematch', () => activateTestimonialsTab(clientTab, false));
      colleaguePanel.addEventListener('beforematch', () => activateTestimonialsTab(colleagueTab, false));

      tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          activateTestimonialsTab(tab, false);
        });

        tab.addEventListener('keydown', (e) => {
          const idx = tabs.indexOf(tab);
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const nextIdx = e.key === 'ArrowRight'
              ? (idx + 1) % tabs.length
              : (idx - 1 + tabs.length) % tabs.length;
            activateTestimonialsTab(tabs[nextIdx], true);
          } else if (e.key === 'Home') {
            e.preventDefault();
            activateTestimonialsTab(tabs[0], true);
          } else if (e.key === 'End') {
            e.preventDefault();
            activateTestimonialsTab(tabs[tabs.length - 1], true);
          }
        });
      });

      if (testimonialsBurgerBtn) {
        testimonialsBurgerBtn.addEventListener('click', () => {
          const isColleague = colleagueTab.classList.contains('is-active');
          activateTestimonialsTab(isColleague ? clientTab : colleagueTab, false);
        });
      }

      function handleTestimonialsHash() {
        if (window.location.hash === '#colleague-testimonials') {
          activateTestimonialsTab(colleagueTab, false);
          const sec = document.getElementById('testimonials');
          if (sec) sec.scrollIntoView({ behavior: prefersReducedMotion ? 'instant' : 'smooth' });
        }
      }

      handleTestimonialsHash();
      window.addEventListener('hashchange', handleTestimonialsHash);
    }

    // 8. Click-to-Reveal Email & Accessible Copy Button (Spam-Hardened Tier A)
    const revealEmailBtn = document.getElementById('revealEmailBtn');
    const emailRevealPanel = document.getElementById('emailRevealPanel');
    const revealedEmailAddress = document.getElementById('revealedEmailAddress');
    const openEmailLink = document.getElementById('openEmailLink');
    const copyEmailBtn = document.getElementById('copyEmailBtn');

    if (revealEmailBtn && emailRevealPanel && revealedEmailAddress && openEmailLink) {
      let supportsDisplayTransition;
      function canTransitionDisplay() {
        if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
        if (!window.CSS?.supports?.('transition-behavior', 'allow-discrete') || !document.body) {
          return false;
        }
        const probe = document.createElement('div');
        probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
        document.body.appendChild(probe);
        getComputedStyle(probe).display;
        probe.style.display = 'none';
        supportsDisplayTransition = getComputedStyle(probe).display === 'block';
        probe.remove();
        return supportsDisplayTransition;
      }

      const copyTimers = new WeakMap();
      let lastCopyMessage = '';

      function clearCopyFeedback(button) {
        if (!button) return;
        clearTimeout(copyTimers.get(button));
        button.removeAttribute('data-copied');
        button.removeAttribute('data-failed');
        const tip = button.nextElementSibling;
        if (tip) tip.textContent = '';
      }

      function reportCopy(button, ok) {
        const tip = button.nextElementSibling;
        clearTimeout(copyTimers.get(button));
        button.removeAttribute('data-copied');
        button.removeAttribute('data-failed');
        let message = ok ? 'Copied' : 'Copy failed';
        if (message === lastCopyMessage) message += '\u00A0';
        lastCopyMessage = message;
        if (tip) tip.textContent = '';
        void button.offsetWidth;
        button.setAttribute(ok ? 'data-copied' : 'data-failed', '');
        requestAnimationFrame(() => {
          if (tip) tip.textContent = message;
        });
        copyTimers.set(button, setTimeout(() => {
          button.removeAttribute('data-copied');
          button.removeAttribute('data-failed');
          if (tip) tip.textContent = '';
        }, 2000));
      }

      async function copyTargetText(button, target) {
        const text = target.matches('input, textarea')
          ? target.value
          : target.innerText.trim();
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          reportCopy(button, true);
        } catch {
          reportCopy(button, false);
        }
      }

      // Register only one path (Invoker Commands or click fallback) so a click never copies twice
      if ('CommandEvent' in window) {
        document.addEventListener('command', (event) => {
          if (event.command === '--copy' && event.source && event.target) {
            copyTargetText(event.source, event.target);
          }
        }, true);
      } else {
        document.addEventListener('click', (event) => {
          const button = event.target.closest('button[command="--copy"]');
          if (!button) return;
          const target = document.getElementById(button.getAttribute('commandfor'));
          if (target) copyTargetText(button, target);
        });
      }

      // Encoded address segments decoded strictly on user interaction (never on load)
      const decodeSegment = (codes, mask) =>
        codes.map((n) => String.fromCharCode(n ^ mask)).join('');

      function assembleAddress() {
        const mask = 42;
        const local = [73, 69, 68, 94, 75, 73, 94];
        const domain = [88, 75, 78, 95, 89, 94, 69, 67, 75, 68, 4, 73, 69, 71];
        return decodeSegment(local, mask) + String.fromCharCode(64) + decodeSegment(domain, mask);
      }

      let isEmailOpen = false;

      function showEmailPanel() {
        const address = assembleAddress();
        revealedEmailAddress.textContent = address;
        openEmailLink.setAttribute('href', ['mai', 'lto:'].join('') + address);
        emailRevealPanel.removeAttribute('data-closing');
        emailRevealPanel.hidden = false;
        isEmailOpen = true;
        revealEmailBtn.setAttribute('aria-expanded', 'true');
      }

      async function hideEmailPanel() {
        isEmailOpen = false;
        revealEmailBtn.setAttribute('aria-expanded', 'false');
        clearCopyFeedback(copyEmailBtn);

        if (canTransitionDisplay()) {
          emailRevealPanel.hidden = true;
        } else {
          emailRevealPanel.setAttribute('data-closing', '');
        }

        const animations = typeof emailRevealPanel.getAnimations === 'function'
          ? emailRevealPanel.getAnimations()
          : [];
        if (animations.length > 0) {
          await Promise.race([
            Promise.allSettled(animations.map((a) => a.finished)),
            new Promise((r) => setTimeout(r, 600))
          ]);
        }

        if (emailRevealPanel.hasAttribute('data-closing')) {
          emailRevealPanel.removeAttribute('data-closing');
          emailRevealPanel.hidden = true;
        }

        if (!isEmailOpen && emailRevealPanel.hidden) {
          revealedEmailAddress.textContent = '';
          openEmailLink.removeAttribute('href');
        }
      }

      revealEmailBtn.addEventListener('click', () => {
        if (isEmailOpen) {
          hideEmailPanel();
        } else {
          showEmailPanel();
        }
      });

      const handleEmailEscape = (event) => {
        if (event.key === 'Escape' && isEmailOpen) {
          hideEmailPanel();
          revealEmailBtn.focus();
        }
      };
      revealEmailBtn.addEventListener('keydown', handleEmailEscape);
      emailRevealPanel.addEventListener('keydown', handleEmailEscape);
    }
  });
})();
