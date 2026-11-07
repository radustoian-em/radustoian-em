document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // 1. Global Image Error Handler (replaces inline onerror with cached fallbacks)
  document.querySelectorAll('img').forEach(img => {
    img.addEventListener('error', function() {
      if (this.dataset.fallbackSrc && this.src !== this.dataset.fallbackSrc) {
        this.src = this.dataset.fallbackSrc;
      } else {
        this.style.display = 'none';
        const fallback = this.closest('.hero-portrait')?.querySelector('.fallback') || (this.nextElementSibling && this.nextElementSibling.classList.contains('fallback') ? this.nextElementSibling : null);
        if (fallback) {
          fallback.style.display = 'flex';
        }
      }
    }, { once: true });
  });

  // 2. Desktop-only Cursor Glow (GPU translate3d + requestAnimationFrame, disabled on mobile/touch)
  const cursorGlow = document.getElementById('cursorGlow');
  if (cursorGlow) {
    if (!isFinePointer || prefersReducedMotion) {
      cursorGlow.style.display = 'none';
    } else {
      let mouseX = -1000;
      let mouseY = -1000;
      let glowTicking = false;

      window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (!glowTicking) {
          glowTicking = true;
          requestAnimationFrame(() => {
            cursorGlow.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
            glowTicking = false;
          });
        }
      }, { passive: true });
    }
  }

  // Track scroll/slider layout invalidation epoch (O(1) on scroll, zero forced reflow)
  let layoutEpoch = 0;
  window.addEventListener('scroll', () => {
    layoutEpoch++;
  }, { passive: true });

  // 3. Desktop-only 3D Glass Tilt & Sheen (Cached rect invalidated on scroll/slide, throttled via rAF)
  if (isFinePointer && !prefersReducedMotion) {
    const cards = document.querySelectorAll('.card-3d, .panel');
    cards.forEach(card => {
      let rect = null;
      let rectEpoch = -1;
      let isTicking = false;
      let mouseX = 0;
      let mouseY = 0;
      const isCard3d = card.classList.contains('card-3d');

      card.addEventListener('mouseenter', () => {
        rect = card.getBoundingClientRect();
        rectEpoch = layoutEpoch;
      }, { passive: true });

      card.addEventListener('mousemove', (e) => {
        if (card.closest('.is-dragging')) return;
        if (!rect || rectEpoch !== layoutEpoch) {
          rect = card.getBoundingClientRect();
          rectEpoch = layoutEpoch;
        }
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;

        if (!isTicking) {
          isTicking = true;
          requestAnimationFrame(() => {
            if (rect && rect.width && rect.height && !card.closest('.is-dragging')) {
              const xPercent = (mouseX / rect.width) * 100;
              const yPercent = (mouseY / rect.height) * 100;
              card.style.setProperty('--mouse-x', `${xPercent.toFixed(1)}%`);
              card.style.setProperty('--mouse-y', `${yPercent.toFixed(1)}%`);

              if (isCard3d) {
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = ((mouseY - centerY) / centerY) * -4;
                const rotateY = ((mouseX - centerX) / centerX) * 4;
                card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;
              }
            }
            isTicking = false;
          });
        }
      }, { passive: true });

      card.addEventListener('mouseleave', () => {
        rect = null;
        if (isCard3d) {
          card.style.transform = '';
        }
      }, { passive: true });
    });
  }

  // 4. Mobile Navigation Menu Toggle (with body scroll lock, backdrop & a11y Escape handler)
  const navToggle = document.getElementById('navToggle');
  const navbar = document.getElementById('navbar');
  const navLinks = document.getElementById('navLinks');
  const navBackdrop = document.getElementById('navBackdrop');

  if (navToggle && navbar) {
    const closeMobileNav = () => {
      navbar.classList.remove('mobile-open');
      document.body.classList.remove('menu-open');
      if (navBackdrop) navBackdrop.classList.remove('active');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.style.transform = 'rotate(0)';
      navToggle.innerHTML = '<svg viewBox="0 0 24 24"><use href="icons.svg#icon-menu"></use></svg>';
    };

    const openMobileNav = () => {
      navbar.classList.add('mobile-open');
      document.body.classList.add('menu-open');
      if (navBackdrop) navBackdrop.classList.add('active');
      navToggle.setAttribute('aria-expanded', 'true');
      navToggle.style.transform = 'rotate(90deg)';
      navToggle.innerHTML = '<svg viewBox="0 0 24 24"><use href="icons.svg#icon-close"></use></svg>';
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
      if (navbar.classList.contains('mobile-open') && !navbar.contains(e.target) && !navToggle.contains(e.target)) {
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

    navbar.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        if (window.innerWidth <= 960) {
          closeMobileNav();
        }
      });
    });
  }

  // 5. High-Performance Active Section Tracking via IntersectionObserver (Zero layout thrashing, no forced reflows)
  const sections = document.querySelectorAll('section[id]');
  const links = document.querySelectorAll('.nav-links a');
  const linkMap = new Map();
  links.forEach(l => {
    const href = l.getAttribute('href');
    if (href && href.startsWith('#')) {
      linkMap.set(href.slice(1), l);
    }
  });

  const setActiveNav = (id) => {
    links.forEach(l => l.classList.remove('active'));
    const activeLink = linkMap.get(id);
    if (activeLink) activeLink.classList.add('active');
  };

  if ('IntersectionObserver' in window) {
    const visibleSections = new Set();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
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

    sections.forEach(s => observer.observe(s));
    const footer = document.querySelector('footer');
    if (footer) observer.observe(footer);
  }

  // 6. Unified Responsive Carousel Manager (Handles 'always' and 'mobile-only' sliders)
  const desktopMediaQuery = window.matchMedia('(min-width: 641px)');
  const sliderInstances = [];
  const slidersById = {};

  function setupCarousel(wrapper) {
    const mode = wrapper.dataset.carouselMode || 'always';
    const carouselId = wrapper.dataset.carouselId || '';
    const track = wrapper.querySelector('.slider-track');
    const viewport = wrapper.querySelector('.slider-viewport');
    const prevBtn = wrapper.querySelector('[data-carousel-prev]');
    const nextBtn = wrapper.querySelector('[data-carousel-next]');
    if (!track || !prevBtn || !nextBtn) return null;

    let currentIndex = 0;
    const items = track.children;
    const totalItems = items.length;

    let isDragging = false;
    let isDraggingAction = false;
    let startX = 0;
    let startY = 0;
    let draggedX = 0;
    let dragInScrollable = false;
    let dragDirectionLocked = null;
    let cachedStep = 0;
    let cachedMaxIndex = 0;
    let rAFId = null;

    function isCarouselActive() {
      return mode === 'always' || !desktopMediaQuery.matches;
    }

    function getItemsPerView() {
      return (mode === 'always' && desktopMediaQuery.matches) ? 2 : 1;
    }

    function getMaxIndex() {
      return Math.max(0, totalItems - getItemsPerView());
    }

    function getStep() {
      if (items.length > 1 && items[0] && items[1]) {
        const step = items[1].offsetLeft - items[0].offsetLeft;
        if (step > 0) return step;
      }
      const itemsPerView = getItemsPerView();
      const vw = viewport ? viewport.clientWidth : track.clientWidth;
      return itemsPerView === 1 ? (vw + 20) : ((vw + 20) / 2);
    }

    function updateSlider(animate = true) {
      if (!isCarouselActive()) {
        currentIndex = 0;
        track.style.transition = '';
        track.style.transform = '';
        track.style.cursor = '';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
      }

      const maxIndex = getMaxIndex();
      currentIndex = Math.min(Math.max(0, currentIndex), maxIndex);
      layoutEpoch++;

      track.style.cursor = 'grab';
      track.style.transition = (animate && !prefersReducedMotion) ? 'transform 0.35s var(--ease)' : 'none';

      if (currentIndex === 0) {
        track.style.transform = 'translate3d(0px, 0, 0)';
      } else {
        const step = getStep();
        track.style.transform = `translate3d(-${currentIndex * step}px, 0, 0)`;
      }

      prevBtn.disabled = currentIndex === 0;
      nextBtn.disabled = currentIndex >= maxIndex;
    }

    function getPositionX(e) {
      return e.type.includes('mouse') ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    }

    function getPositionY(e) {
      return e.type.includes('mouse') ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    }

    function dragStart(e) {
      if (!isCarouselActive()) return;
      if (e.type === 'mousedown' && e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('.testimonial-expand-btn')) {
        isDraggingAction = false;
        return;
      }

      const scrollableBq = e.target && e.target.closest ? e.target.closest('blockquote') : null;
      dragInScrollable = !!(scrollableBq && scrollableBq.scrollHeight > scrollableBq.clientHeight + 2);
      dragDirectionLocked = null;

      isDragging = true;
      isDraggingAction = false;
      startX = getPositionX(e);
      startY = getPositionY(e);
      draggedX = 0;
      cachedStep = getStep();
      cachedMaxIndex = getMaxIndex();
      track.style.transition = 'none';
      track.style.cursor = 'grabbing';
      track.classList.add('is-dragging');

      window.addEventListener('mousemove', dragMove, { passive: true });
      window.addEventListener('mouseup', dragEnd);
      window.addEventListener('touchmove', dragMove, { passive: true });
      window.addEventListener('touchend', dragEnd);
      window.addEventListener('touchcancel', dragEnd);
      window.addEventListener('blur', dragEnd);
    }

    function dragMove(e) {
      if (!isDragging) return;
      const currentX = getPositionX(e);
      if (dragInScrollable && !dragDirectionLocked) {
        const deltaX = Math.abs(currentX - startX);
        const deltaY = Math.abs(getPositionY(e) - startY);
        if (deltaX > 6 || deltaY > 6) {
          if (deltaY >= deltaX) {
            dragDirectionLocked = 'y';
            draggedX = 0;
            dragEnd();
            return;
          }
          dragDirectionLocked = 'x';
        } else {
          return;
        }
      }

      draggedX = currentX - startX;
      if (Math.abs(draggedX) > 8) isDraggingAction = true;

      if (!rAFId) {
        rAFId = requestAnimationFrame(() => {
          const baseOffset = currentIndex * cachedStep;
          let effectiveDrag = draggedX;
          if ((currentIndex === 0 && draggedX > 0) || (currentIndex >= cachedMaxIndex && draggedX < 0)) {
            effectiveDrag = draggedX * 0.25;
          }
          track.style.transform = `translate3d(-${baseOffset - effectiveDrag}px, 0, 0)`;
          rAFId = null;
        });
      }
    }

    function dragEnd() {
      if (!isDragging) return;
      isDragging = false;
      if (rAFId) {
        cancelAnimationFrame(rAFId);
        rAFId = null;
      }
      track.style.cursor = isCarouselActive() ? 'grab' : '';
      track.classList.remove('is-dragging');

      window.removeEventListener('mousemove', dragMove);
      window.removeEventListener('mouseup', dragEnd);
      window.removeEventListener('touchmove', dragMove);
      window.removeEventListener('touchend', dragEnd);
      window.removeEventListener('touchcancel', dragEnd);
      window.removeEventListener('blur', dragEnd);

      const threshold = 40;
      if (Math.abs(draggedX) > threshold && cachedStep > 0) {
        const cardsMoved = Math.max(1, Math.round(Math.abs(draggedX) / cachedStep));
        if (draggedX < -threshold) currentIndex += cardsMoved;
        else if (draggedX > threshold) currentIndex -= cardsMoved;
      }

      setTimeout(() => {
        isDraggingAction = false;
      }, 60);

      updateSlider(true);
    }

    prevBtn.addEventListener('click', () => {
      if (!isCarouselActive()) return;
      currentIndex--;
      updateSlider(true);
    });

    nextBtn.addEventListener('click', () => {
      if (!isCarouselActive()) return;
      currentIndex++;
      updateSlider(true);
    });

    track.addEventListener('mousedown', dragStart);
    track.addEventListener('touchstart', dragStart, { passive: true });
    track.addEventListener('dragstart', e => {
      if (isCarouselActive()) e.preventDefault();
    });

    if (viewport) {
      let wheelAccum = 0;
      let wheelCooldown = false;
      let wheelResetTimer = null;

      viewport.addEventListener('wheel', (e) => {
        if (!isCarouselActive()) return;
        const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
        const isShiftWheel = e.shiftKey && Math.abs(e.deltaY) > 0;
        if (!isHorizontal && !isShiftWheel) return;

        const delta = isHorizontal ? e.deltaX : e.deltaY;
        const maxIndex = getMaxIndex();
        if ((delta < 0 && currentIndex <= 0) || (delta > 0 && currentIndex >= maxIndex)) {
          return;
        }

        e.preventDefault();
        clearTimeout(wheelResetTimer);
        wheelResetTimer = setTimeout(() => { wheelAccum = 0; }, 150);

        if (wheelCooldown) return;
        wheelAccum += delta;

        if (Math.abs(wheelAccum) > 30) {
          if (wheelAccum > 0) currentIndex++;
          else currentIndex--;
          wheelAccum = 0;
          wheelCooldown = true;
          updateSlider(true);
          setTimeout(() => { wheelCooldown = false; }, 220);
        }
      }, { passive: false });
    }

    track.addEventListener('click', (e) => {
      if (e.target && e.target.closest && e.target.closest('.testimonial-expand-btn')) {
        isDraggingAction = false;
        return;
      }
      if (isDraggingAction) {
        e.preventDefault();
        e.stopPropagation();
        isDraggingAction = false;
      }
    }, true);

    updateSlider(false);
    const instance = { updateSlider };
    sliderInstances.push(instance);
    if (carouselId) slidersById[carouselId] = instance;
    return instance;
  }

  document.querySelectorAll('[data-carousel]').forEach(setupCarousel);

  const clientSlider = slidersById.testimonials;
  const colleagueSlider = slidersById.colleagueTestimonials;

  const testimonialCards = Array.from(document.querySelectorAll('#testimonials .testimonial-card'));
  const testimonialModal = document.getElementById('testimonialModal');
  const testimonialModalQuote = document.getElementById('testimonialModalQuote');
  const testimonialModalAuthor = document.getElementById('testimonialModalAuthor');
  const testimonialModalRole = document.getElementById('testimonialModalRole');
  const testimonialModalContext = document.getElementById('testimonialModalContext');

  let syncOverflowRaf = null;
  function syncTestimonialOverflows() {
    if (syncOverflowRaf) cancelAnimationFrame(syncOverflowRaf);
    syncOverflowRaf = requestAnimationFrame(() => {
      syncOverflowRaf = null;
      const measurements = testimonialCards.map((card) => {
        const bq = card.querySelector('blockquote');
        if (!bq) return null;
        const clientH = bq.clientHeight;
        if (clientH === 0) return null;
        const scrollH = bq.scrollHeight;
        const scrollT = bq.scrollTop;
        const hasOverflow = scrollH > clientH + 2;
        const isAtBottom = !hasOverflow || (scrollT + clientH >= scrollH - 2);
        return { card, bq, hasOverflow, isAtBottom };
      });

      measurements.forEach((m) => {
        if (!m) return;
        m.card.classList.toggle('has-overflow', m.hasOverflow);
        m.bq.classList.toggle('has-overflow', m.hasOverflow);
        m.bq.classList.toggle('is-at-bottom', m.isAtBottom);
      });
    });
  }

  testimonialCards.forEach((card) => {
    const bq = card.querySelector('blockquote');
    const expandBtn = card.querySelector('.testimonial-expand-btn');

    if (bq) {
      bq.addEventListener('scroll', () => {
        const isAtBottom = bq.scrollTop + bq.clientHeight >= bq.scrollHeight - 2;
        bq.classList.toggle('is-at-bottom', isAtBottom);
      }, { passive: true });
    }

    if (expandBtn && testimonialModal) {
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nameEl = card.querySelector('.testimonial-attr .name');
        const roleEl = card.querySelector('.testimonial-attr .role');
        const contextEl = card.querySelector('.testimonial-attr .context');

        if (testimonialModalQuote && bq) testimonialModalQuote.textContent = bq.textContent;
        if (testimonialModalAuthor && nameEl) testimonialModalAuthor.textContent = nameEl.textContent;
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
    testimonialModal.addEventListener('pointerdown', (e) => { pressedOutside = outside(e, testimonialModal); });
    testimonialModal.addEventListener('pointerup', (e) => { if (pressedOutside && outside(e, testimonialModal)) testimonialModal.close(); });
  }

  syncTestimonialOverflows();

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      sliderInstances.forEach(s => s.updateSlider(false));
      syncTestimonialOverflows();
    }, 80);
  }, { passive: true });

  if (typeof desktopMediaQuery.addEventListener === 'function') {
    desktopMediaQuery.addEventListener('change', () => {
      sliderInstances.forEach(s => s.updateSlider(false));
      syncTestimonialOverflows();
    });
  }

  // 7. Testimonials Section Tabs & Mobile Mini Burger Switcher
  const clientTab = document.getElementById('clientTab');
  const colleagueTab = document.getElementById('colleagueTab');
  const clientPanel = document.getElementById('clientTestimonialsPanel');
  const colleaguePanel = document.getElementById('colleagueTestimonialsPanel');
  const testimonialsBurgerBtn = document.getElementById('testimonialsBurgerBtn');
  const testimonialsActiveHeading = document.getElementById('testimonialsActiveHeading');

  if (clientTab && colleagueTab && clientPanel && colleaguePanel) {
    const tabs = [clientTab, colleagueTab];

    function activateTestimonialsTab(targetTab, focusTab = false) {
      const isColleague = targetTab === colleagueTab;

      tabs.forEach((tab) => {
        const active = tab === targetTab;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.setAttribute('tabindex', active ? '0' : '-1');
      });

      clientPanel.classList.toggle('is-active', !isColleague);
      clientPanel.hidden = isColleague;

      colleaguePanel.classList.toggle('is-active', isColleague);
      colleaguePanel.hidden = !isColleague;

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
        colleagueSlider.updateSlider(false);
      } else if (!isColleague && clientSlider) {
        clientSlider.updateSlider(false);
      }
      syncTestimonialOverflows();
      layoutEpoch++;

      if (focusTab) {
        targetTab.focus();
      }
    }

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
        if (sec) sec.scrollIntoView({ behavior: 'smooth' });
      }
    }

    handleTestimonialsHash();
    window.addEventListener('hashchange', handleTestimonialsHash);
  }
});
