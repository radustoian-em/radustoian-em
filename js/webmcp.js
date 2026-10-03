/**
 * WebMCP tool declarations for radustoian.com
 * Spec: https://webmachinelearning.github.io/webmcp/
 *
 * Load from index.html (after js/script.js):
 *   <script src="js/webmcp.js" defer></script>
 */
(function initWebMCP() {
  'use strict';

  // Current spec exposes document.modelContext; older Chrome builds used navigator.modelContext.
  const modelContext = document.modelContext || navigator.modelContext;
  if (!modelContext || typeof modelContext.registerTool !== 'function') return;

  // Tools live for the lifetime of this single-page site. The controller lets you
  // unregister them if ever needed. Do NOT abort on `beforeunload`: when the page is
  // restored from the back/forward cache the tools would be gone and never re-registered.
  const controller = new AbortController();

  // ---------- Helpers ----------
  const ok = (data) => ({
    content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }]
  });
  const fail = (message) => ({ content: [{ type: 'text', text: message }], isError: true });
  const clean = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

  // `html { scroll-behavior: smooth }` makes 'auto' smooth too, so use 'instant' for reduced motion.
  const scrollBehavior = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';

  const waitFor = (target, eventName, timeoutMs, filter = () => true) =>
    new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        target.removeEventListener(eventName, onEvent);
        resolve();
      };
      const onEvent = (e) => { if (filter(e)) finish(); };
      const timer = setTimeout(finish, timeoutMs);
      target.addEventListener(eventName, onEvent);
    });

  const closeMobileNav = () => {
    const navbar = document.getElementById('navbar');
    const toggle = document.getElementById('navToggle');
    if (navbar && toggle && navbar.classList.contains('mobile-open')) toggle.click();
  };

  const scrollToElement = async (el) => {
    closeMobileNav();
    const behavior = scrollBehavior();
    if (el === document.body) window.scrollTo({ top: 0, behavior });
    else el.scrollIntoView({ behavior, block: 'start' });

    if (behavior === 'smooth') {
      // Resolve once scrolling has finished so the agent doesn't act mid-scroll.
      await ('onscrollend' in window
        ? waitFor(window, 'scrollend', 1200)
        : new Promise((r) => setTimeout(r, 700)));
    }
  };

  const register = (tool) => {
    try {
      Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal }))
        .catch((err) => console.warn(`[WebMCP] Could not register "${tool.name}":`, err));
    } catch (err) {
      // One failing tool must not prevent the others from registering.
      console.warn(`[WebMCP] Could not register "${tool.name}":`, err);
    }
  };

  // ---------- Page model ----------
  const SECTION_IDS = ['top', 'about', 'expertise', 'insights', 'projects', 'testimonials', 'speaking', 'skills', 'connect']
    .filter((id) => id === 'top' || document.getElementById(id));

  const serializeCaseStudy = (card, i, total) => ({
    position: `${i + 1} of ${total}`,
    client: card.querySelector('img')?.alt || '',
    title: clean(card.querySelector('h3')),
    highlights: Array.from(card.querySelectorAll('li')).map(clean),
    url: card.querySelector('a.case-link')?.href || null
  });

  const serializeTestimonial = (card, i, total) => ({
    position: `${i + 1} of ${total}`,
    name: clean(card.querySelector('.name')),
    role: clean(card.querySelector('.role')),
    quote: clean(card.querySelector('blockquote'))
  });

  const CAROUSELS = {
    caseStudies: {
      sectionId: 'projects', viewportId: 'expViewport', trackId: 'expTrack',
      prevId: 'expPrev', nextId: 'expNext', serialize: serializeCaseStudy
    },
    testimonials: {
      sectionId: 'testimonials', viewportId: 'testViewport', trackId: 'testTrack',
      prevId: 'testPrev', nextId: 'testNext', serialize: serializeTestimonial
    }
  };

  const getSlides = (cfg) => Array.from(document.getElementById(cfg.trackId)?.children || []);

  // Slides that are >50% inside the viewport (1 on mobile, 2 on desktop).
  const getVisibleIndexes = (cfg) => {
    const viewport = document.getElementById(cfg.viewportId);
    if (!viewport) return [];
    const v = viewport.getBoundingClientRect();
    return getSlides(cfg).reduce((acc, slide, i) => {
      const r = slide.getBoundingClientRect();
      const overlap = Math.min(r.right, v.right) - Math.max(r.left, v.left);
      if (r.width && overlap / r.width > 0.5) acc.push(i);
      return acc;
    }, []);
  };

  const clientNames = getSlides(CAROUSELS.caseStudies)
    .map((card) => card.querySelector('img')?.alt)
    .filter(Boolean)
    .join(', ');

  // ---------- Tool 1: Section navigation ----------
  register({
    name: 'navigateToSection',
    title: 'Go to page section',
    description:
      'Scrolls the page to a section of Radu Stoian\'s profile and returns that section\'s heading and text. ' +
      'Sections: top (intro), about, expertise, insights (articles), projects (case studies), testimonials, ' +
      'speaking (talks & podcasts), skills (certifications), connect (contact).',
    inputSchema: {
      type: 'object',
      properties: {
        section: { type: 'string', enum: SECTION_IDS, description: 'ID of the section to bring into view.' }
      },
      required: ['section']
    },
    annotations: { readOnlyHint: true },
    execute: async ({ section } = {}) => {
      // Browsers do not guarantee schema validation, so validate against the allowlist.
      if (!SECTION_IDS.includes(section)) {
        return fail(`Unknown section "${section}". Use one of: ${SECTION_IDS.join(', ')}.`);
      }

      const el = section === 'top' ? document.body : document.getElementById(section);
      await scrollToElement(el);

      const container = section === 'top' ? document.querySelector('header.hero') : el;
      return ok({
        section,
        heading: clean(container.querySelector('h1, h2')),
        text: clean(container).slice(0, 1500)
      });
    }
  });

  // ---------- Tool 2: Carousel control ----------
  register({
    name: 'showCarouselSlide',
    title: 'Browse case studies or testimonials',
    description:
      'Moves the "caseStudies" or "testimonials" carousel (next, previous, or go to a 1-based slide index), ' +
      'scrolls it into view, and returns the slides now visible plus whether the start/end has been reached.',
    inputSchema: {
      type: 'object',
      properties: {
        carousel: { type: 'string', enum: Object.keys(CAROUSELS), description: 'Which carousel to control.' },
        action: { type: 'string', enum: ['next', 'previous', 'goto'], description: 'How to move the carousel.' },
        index: { type: 'integer', minimum: 1, description: '1-based slide number. Required when action is "goto".' }
      },
      required: ['carousel', 'action']
    },
    annotations: { readOnlyHint: true },
    execute: async ({ carousel, action, index } = {}) => {
      const cfg = CAROUSELS[carousel];
      if (!cfg) return fail(`Unknown carousel "${carousel}". Use one of: ${Object.keys(CAROUSELS).join(', ')}.`);

      const track = document.getElementById(cfg.trackId);
      const prev = document.getElementById(cfg.prevId);
      const next = document.getElementById(cfg.nextId);
      const slides = getSlides(cfg);
      if (!track || !prev || !next || !slides.length) return fail(`Carousel "${carousel}" is not available.`);

      // Let the user see what the agent is doing.
      await scrollToElement(document.getElementById(cfg.sectionId));

      let button = null;
      let clicks = 0;

      if (action === 'next' || action === 'previous') {
        button = action === 'next' ? next : prev;
        clicks = 1;
      } else if (action === 'goto') {
        const target = Number(index) - 1;
        if (!Number.isInteger(target) || target < 0 || target >= slides.length) {
          return fail(`"index" must be an integer between 1 and ${slides.length}.`);
        }
        const visible = getVisibleIndexes(cfg);
        const first = visible.length ? visible[0] : 0;
        const last = visible.length ? visible[visible.length - 1] : 0;
        if (target > last) { button = next; clicks = target - last; }
        else if (target < first) { button = prev; clicks = first - target; }
      } else {
        return fail('"action" must be "next", "previous" or "goto".');
      }

      // script.js updates `disabled` synchronously on each click, so this stops cleanly at either end.
      let moved = 0;
      for (let i = 0; i < clicks && button && !button.disabled; i++) {
        button.click();
        moved++;
      }

      if (moved) {
        // Slide animation is 0.45s; wait for it so we read the final positions.
        await waitFor(track, 'transitionend', 800, (e) => e.target === track && e.propertyName === 'transform');
      }

      const visible = getVisibleIndexes(cfg);
      return ok({
        carousel,
        moved: moved > 0,
        message: clicks > 0 && moved === 0
          ? `Did not move: already at the ${button === next ? 'end' : 'start'} of the carousel.`
          : undefined,
        atStart: prev.disabled,
        atEnd: next.disabled,
        totalSlides: slides.length,
        visibleSlides: visible.map((i) => cfg.serialize(slides[i], i, slides.length))
      });
    }
  });

  // ---------- Tool 3: Case study data ----------
  register({
    name: 'listCaseStudies',
    title: 'List client case studies',
    description:
      `Returns every client case study on the page${clientNames ? ` (${clientNames})` : ''} ` +
      'with title, key results and a link to the full case study. Does not change the page.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      const slides = getSlides(CAROUSELS.caseStudies);
      return ok(slides.map((card, i) => serializeCaseStudy(card, i, slides.length)));
    }
  });

  // ---------- Tool 4: Testimonial data ----------
  register({
    name: 'listTestimonials',
    title: 'List client testimonials',
    description:
      'Returns every client testimonial on the page with the person\'s name, role/company and full quote. ' +
      'Does not change the page.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      const slides = getSlides(CAROUSELS.testimonials);
      return ok(slides.map((card, i) => serializeTestimonial(card, i, slides.length)));
    }
  });

  // ---------- Tool 5: Contact links ----------
  register({
    name: 'getContactLinks',
    title: 'Get contact & profile links',
    description:
      'Returns Radu Stoian\'s contact and profile links (LinkedIn, X, Substack, GitHub). ' +
      'LinkedIn is the preferred channel for enquiries, speaking and podcast invitations.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      const seen = new Set();
      const links = Array.from(document.querySelectorAll('.hero-links a, #connect a'))
        .map((a) => ({ label: clean(a), url: a.href }))
        .filter((l) => l.url && !seen.has(l.url) && seen.add(l.url));
      return ok(links);
    }
  });
})();
