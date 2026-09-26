document.addEventListener('DOMContentLoaded', () => {

  // Global Image Error Handler (Removes need for inline onerror)
  document.querySelectorAll('img').forEach(img => {
    img.addEventListener('error', function() {
      // Check for fallback source
      if (this.dataset.fallbackSrc && this.src !== this.dataset.fallbackSrc) {
        this.src = this.dataset.fallbackSrc;
      } 
      // Check for structural fallbacks
      else {
        this.style.display = 'none';
        if (this.nextElementSibling && this.nextElementSibling.classList.contains('fallback')) {
          this.nextElementSibling.style.display = 'flex';
        }
      }
    });
  });

  // Typewriter AI generation effect for hero role
  const roleEl = document.querySelector('.hero .role');
  const isGoogleCrawler = /Googlebot|Google-InspectionTool|GoogleOther|Google-Extended|Storebot-Google|AdsBot-Google|Mediapartners-Google/i.test(navigator.userAgent);
  
  if (roleEl && !isGoogleCrawler) {
    const originalHTML = roleEl.innerHTML.trim().replace(/\s+/g, ' ');
    roleEl.innerHTML = '';
    
    const style = document.createElement('style');
    style.innerHTML = '@keyframes ai-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } } .ai-cursor { display: inline-block; width: 6px; height: 1em; background-color: var(--p-400); margin-left: 4px; vertical-align: text-bottom; animation: ai-blink 1s step-end infinite; }';
    document.head.appendChild(style);

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
          setTimeout(typeWriter, Math.random() * 40 + 30);
        }
      } else {
        roleEl.innerHTML = currentHTML + '<span class="ai-cursor" style="animation: none; opacity: 0.5; transition: opacity 2s;"></span>';
        setTimeout(() => {
          const cursor = roleEl.querySelector('.ai-cursor');
          if (cursor) cursor.style.opacity = '0';
        }, 2000);
      }
    }
    setTimeout(typeWriter, 400); 
  }

  // Global Cursor Glow Logic
  const cursorGlow = document.getElementById('cursorGlow');
  document.addEventListener('mousemove', (e) => {
    cursorGlow.style.left = e.clientX + 'px';
    cursorGlow.style.top = e.clientY + 'px';
  });

  // 3D Glass Tilt and Sheen effect
  const cards = document.querySelectorAll('.card-3d, .panel');
  cards.forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${(x / rect.width) * 100}%`);
      card.style.setProperty('--mouse-y', `${(y / rect.height) * 100}%`);
      
      if (card.classList.contains('card-3d')) {
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -4;
        const rotateY = ((x - centerX) / centerX) * 4;
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
      }
    });

    card.addEventListener('mouseleave', () => {
      if (card.classList.contains('card-3d')) {
        card.style.transform = '';
      }
    });
  });

  // Mobile Menu Logic (Floating Dropdown)
  const navToggle = document.getElementById('navToggle');
  const navbar = document.getElementById('navbar');
  const navLinks = document.getElementById('navLinks');

  navToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = navbar.classList.toggle('mobile-open');
    navToggle.setAttribute('aria-expanded', isOpen);
    navToggle.style.transform = isOpen ? 'rotate(90deg)' : 'rotate(0)';
    navToggle.innerHTML = isOpen ? '<svg viewBox="0 0 24 24"><use href="#icon-close"></use></svg>' : '<svg viewBox="0 0 24 24"><use href="#icon-menu"></use></svg>';
  });

  document.addEventListener('click', (e) => {
    if(navbar.classList.contains('mobile-open') && !navbar.contains(e.target) && !navToggle.contains(e.target)) {
      navbar.classList.remove('mobile-open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.style.transform = 'rotate(0)';
      navToggle.innerHTML = '<svg viewBox="0 0 24 24"><use href="#icon-menu"></use></svg>';
    }
  });

  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      if(window.innerWidth <= 960) {
        navbar.classList.remove('mobile-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.style.transform = 'rotate(0)';
        navToggle.innerHTML = '<svg viewBox="0 0 24 24"><use href="#icon-menu"></use></svg>';
      }
    });
  });

  // Active section tracking logic for Navigation
  const sections = document.querySelectorAll('section[id]');
  const links = document.querySelectorAll('.nav-links a');
  const setActive = () => {
    let current = '';
    sections.forEach(sec => {
      const rect = sec.getBoundingClientRect();
      if (rect.top <= 150 && rect.bottom > 150) current = sec.id;
    });
    
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 50) {
      current = 'connect';
    }
    
    links.forEach(l => {
      l.style.background = '';
      l.style.color = '';
      l.style.boxShadow = '';
      if (l.getAttribute('href') === '#' + current) {
        l.style.background = 'rgba(192, 132, 252, 0.12)';
        l.style.color = 'var(--p-300)';
        l.style.boxShadow = 'inset 0 0 12px rgba(192, 132, 252, 0.1)';
      }
    });
  };
  document.addEventListener('scroll', setActive, { passive: true });
  setActive();

  // Flattened Slider Setup
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

    function getItemsPerView() {
      return window.innerWidth > 640 ? 2 : 1;
    }

    function updateSlider() {
      const itemsPerView = getItemsPerView();
      const maxIndex = Math.max(0, totalItems - itemsPerView);
      currentIndex = Math.min(currentIndex, maxIndex);
      currentIndex = Math.max(0, currentIndex);

      const slidePercent = currentIndex * (100 / itemsPerView);
      const gapOffset = currentIndex * (20 / itemsPerView);
      
      track.style.transform = `translateX(calc(-${slidePercent}% - ${gapOffset}px))`;
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
      if (Math.abs(draggedX) > 10) isDraggingAction = true;
      
      const itemsPerView = getItemsPerView();
      const slidePercent = currentIndex * (100 / itemsPerView);
      const gapOffset = currentIndex * (20 / itemsPerView);
      
      track.style.transform = `translateX(calc(-${slidePercent}% - ${gapOffset}px + ${draggedX}px))`;
    }

    function dragEnd() {
      if (!isDragging) return;
      isDragging = false;
      track.style.transition = 'transform 0.5s var(--ease)'; 
      track.style.cursor = 'grab';

      const threshold = 50;
      if (draggedX < -threshold) currentIndex++;
      else if (draggedX > threshold) currentIndex--;
      
      updateSlider();
    }

    prevBtn.addEventListener('click', () => { currentIndex--; updateSlider(); });
    nextBtn.addEventListener('click', () => { currentIndex++; updateSlider(); });

    track.style.cursor = 'grab';
    track.addEventListener('mousedown', dragStart);
    track.addEventListener('touchstart', dragStart, { passive: true });
    window.addEventListener('mousemove', dragMove);
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

    window.addEventListener('resize', () => setTimeout(updateSlider, 100));
    updateSlider();
  }

  setupSlider('expTrack', 'expPrev', 'expNext');
  setupSlider('testTrack', 'testPrev', 'testNext');

});