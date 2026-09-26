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
        if (this.nextElementSibling && this.nextElementSibling.classList.contains('fallback')) {
          this.nextElementSibling.style.display = 'flex';
        }
      }
    }, { once: true });
  });

  // 2. Typewriter AI effect (deferred to post-paint to prevent initial style invalidation and forced reflow)
  const roleEl = document.querySelector('.hero .role');
  const isCrawler = /Googlebot|Google-InspectionTool|GoogleOther|Google-Extended|Storebot-Google|AdsBot-Google|Mediapartners-Google/i.test(navigator.userAgent);
  
  if (roleEl && !isCrawler && !prefersReducedMotion) {
    const originalHTML = roleEl.innerHTML.trim().replace(/\s+/g, ' ');
    
    // Run after initial page load & paint are completed
    setTimeout(() => {
      roleEl.innerHTML = '';
      let i = 0;
      let isTag = false;
      let currentHTML = '';
      
      function typeWriter() {
        if (i < originalHTML.length) {
          const char = originalHTML.charAt(i);
          currentHTML += char;
          
          if (char === '<') isTag = true;
          if (char === '>') {
            isTag = false;
            i++;
            typeWriter();
            return;
          }
          
          if (isTag) {
            i++;
            typeWriter(); 
          } else {
            roleEl.innerHTML = currentHTML + '<span class="ai-cursor"></span>';
            i++;
            setTimeout(typeWriter, 35);
          }
        } else {
          roleEl.innerHTML = currentHTML + '<span class="ai-cursor" style="animation: none; opacity: 0.5; transition: opacity 1.5s;"></span>';
          setTimeout(() => {
            const cursor = roleEl.querySelector('.ai-cursor');
            if (cursor) cursor.remove();
          }, 1500);
        }
      }
      typeWriter();
    }, 400);
  }

  // 3. Desktop-only Cursor Glow (GPU translate3d + requestAnimationFrame, disabled on mobile/touch)
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

  // 4. Desktop-only 3D Glass Tilt & Sheen (Cached rect on mouseenter, throttled via rAF, zero reflow on load)
  if (isFinePointer && !prefersReducedMotion) {
    const cards = document.querySelectorAll('.card-3d, .panel');
    cards.forEach(card => {
      let rect = null;
      let isTicking = false;
      let mouseX = 0;
      let mouseY = 0;
      const isCard3d = card.classList.contains('card-3d');

      card.addEventListener('mouseenter', () => {
        rect = card.getBoundingClientRect();
      }, { passive: true });

      card.addEventListener('mousemove', (e) => {
        if (!rect) rect = card.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;

        if (!isTicking) {
          isTicking = true;
          requestAnimationFrame(() => {
            if (rect && rect.width && rect.height) {
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

  // 5. Mobile Navigation Menu Toggle
  const navToggle = document.getElementById('navToggle');
  const navbar = document.getElementById('navbar');
  const navLinks = document.getElementById('navLinks');

  if (navToggle && navbar) {
    const closeMobileNav = () => {
      navbar.classList.remove('mobile-open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.style.transform = 'rotate(0)';
      navToggle.innerHTML = '<svg viewBox="0 0 24 24"><use href="#icon-menu"></use></svg>';
    };

    navToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navbar.classList.toggle('mobile-open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      navToggle.style.transform = isOpen ? 'rotate(90deg)' : 'rotate(0)';
      navToggle.innerHTML = isOpen 
        ? '<svg viewBox="0 0 24 24"><use href="#icon-close"></use></svg>' 
        : '<svg viewBox="0 0 24 24"><use href="#icon-menu"></use></svg>';
    });

    document.addEventListener('click', (e) => {
      if (navbar.classList.contains('mobile-open') && !navbar.contains(e.target) && !navToggle.contains(e.target)) {
        closeMobileNav();
      }
    });

    if (navLinks) {
      navLinks.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
          if (window.innerWidth <= 960) {
            closeMobileNav();
          }
        });
      });
    }
  }

  // 6. High-Performance Active Section Tracking via IntersectionObserver (Zero layout thrashing, no forced reflows)
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

  // 7. Flattened Responsive Slider (Pixel-accurate card steps, zero reflow on load)
  function setupSlider(trackId, prevBtnId, nextBtnId) {
    const track = document.getElementById(trackId);
    const prevBtn = document.getElementById(prevBtnId);
    const nextBtn = document.getElementById(nextBtnId);
    if (!track || !prevBtn || !nextBtn) return;

    let currentIndex = 0;
    const items = track.children; 
    const totalItems = items.length;
    
    let isDragging = false;
    let isDraggingAction = false;
    let startX = 0;
    let draggedX = 0;
    let rAFId = null;

    function getItemsPerView() {
      return window.matchMedia('(min-width: 641px)').matches ? 2 : 1;
    }

    function getStep() {
      if (items.length > 1 && items[0] && items[1]) {
        const step = items[1].offsetLeft - items[0].offsetLeft;
        if (step > 0) return step;
      }
      const itemsPerView = getItemsPerView();
      const vw = track.parentElement ? track.parentElement.clientWidth : track.clientWidth;
      return itemsPerView === 1 ? (vw + 20) : ((vw + 20) / 2);
    }

    function updateSlider(animate = true) {
      const itemsPerView = getItemsPerView();
      const maxIndex = Math.max(0, totalItems - itemsPerView);
      currentIndex = Math.min(Math.max(0, currentIndex), maxIndex);

      track.style.transition = animate ? 'transform 0.45s var(--ease)' : 'none';

      if (currentIndex === 0) {
        track.style.transform = 'translateX(0px)';
      } else {
        const step = getStep();
        track.style.transform = `translateX(-${currentIndex * step}px)`;
      }

      prevBtn.disabled = currentIndex === 0;
      nextBtn.disabled = currentIndex >= maxIndex;
    }

    function getPositionX(e) {
      return e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
    }

    function dragStart(e) {
      isDragging = true;
      isDraggingAction = false;
      startX = getPositionX(e);
      draggedX = 0;
      track.style.transition = 'none'; 
      track.style.cursor = 'grabbing';
    }

    function dragMove(e) {
      if (!isDragging) return;
      const currentX = getPositionX(e);
      draggedX = currentX - startX;
      if (Math.abs(draggedX) > 8) isDraggingAction = true;
      
      if (!rAFId) {
        rAFId = requestAnimationFrame(() => {
          const step = getStep();
          const baseOffset = currentIndex * step;
          track.style.transform = `translateX(-${baseOffset - draggedX}px)`;
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
      track.style.cursor = 'grab';

      const threshold = 40;
      if (draggedX < -threshold) currentIndex++;
      else if (draggedX > threshold) currentIndex--;
      
      updateSlider(true);
    }

    prevBtn.addEventListener('click', () => { 
      currentIndex--; 
      updateSlider(true); 
    });

    nextBtn.addEventListener('click', () => { 
      currentIndex++; 
      updateSlider(true); 
    });

    track.style.cursor = 'grab';
    track.addEventListener('mousedown', dragStart);
    track.addEventListener('touchstart', dragStart, { passive: true });
    window.addEventListener('mousemove', dragMove, { passive: true });
    window.addEventListener('mouseup', dragEnd);
    track.addEventListener('touchmove', dragMove, { passive: true });
    window.addEventListener('touchend', dragEnd);

    track.addEventListener('click', (e) => {
      if (isDraggingAction) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    track.querySelectorAll('img').forEach(img => {
      img.addEventListener('dragstart', e => e.preventDefault());
    });

    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        updateSlider(false);
      }, 80);
    }, { passive: true });

    updateSlider(false);
  }

  setupSlider('expTrack', 'expPrev', 'expNext');
  setupSlider('testTrack', 'testPrev', 'testNext');
});