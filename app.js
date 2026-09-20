const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('#site-nav');
function setMenu(open) {
  if (!nav || !menuButton) return;
  nav.classList.toggle('is-open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
}
if (menuButton && nav) {
  menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('click', event => { if (!nav.contains(event.target) && !menuButton.contains(event.target)) setMenu(false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      menuButton.focus();
    }
  });
  const desktop = window.matchMedia('(min-width: 1001px)');
  desktop.addEventListener('change', event => { if (event.matches) setMenu(false); });
}
document.querySelector('#year').textContent = String(new Date().getFullYear());

// Scroll reveals enhance the existing page; content is visible without JavaScript.
function initSectionReveals() {
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motionPreference.matches || !('IntersectionObserver' in window)) return;

  const items = new Map();
  const groups = [
    ['.page-section', ':scope > .container > .section-divider'],
    ['#process .process-introduction', ':scope > *'],
    ['#process .process-timeline', ':scope > .process-connector, :scope > .process-steps > li'],
    ['#process .process-technologies', ':scope > .process-tech-note, :scope > .process-tech-grid > li'],
    ['.section-header', '.eyebrow, h2, :scope > p, :scope > a'],
    ['.service-grid', ':scope > .service-card'],
    ['.project-card', ':scope > .project-preview, :scope > .project-copy > *'],
    ['#work .work-project', ':scope > .work-preview, :scope > .work-copy'],
    ['.about', ':scope > .about-art, :scope > .about-copy > *'],
    ['.faq-frame', ':scope > *'],
    ['.contact', ':scope > div:first-child > *, :scope > .contact-links > *'],
    ['.footer-main', ':scope > *'],
    ['.footer-bottom', ':scope > *'],
  ];
  groups.forEach(([containerSelector, itemSelector]) => {
    document.querySelectorAll(containerSelector).forEach(group => {
      group.querySelectorAll(itemSelector).forEach(element => {
        const revealGroup = element.closest('#process') ? group : element.closest('.page-section') || group;
        items.set(element, { group: revealGroup, order: 0 });
      });
    });
  });
  if (!items.size) return;
  // The visible section label and heading lead its content in reading order.
  [...items.keys()]
    .sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)
    .forEach((element, order) => { items.get(element).order = order; });

  let observer;
  const reveal = (element, delay = 0) => {
    if (!element.classList.contains('scroll-reveal-pending')) return;
    element.style.setProperty('--reveal-delay', `${delay}ms`);
    element.classList.replace('scroll-reveal-pending', 'scroll-reveal-visible');
    observer?.unobserve(element);
  };
  const finishAll = () => {
    observer?.disconnect();
    items.forEach((_, element) => {
      element.classList.remove('scroll-reveal-pending', 'scroll-reveal-visible');
      element.style.removeProperty('--reveal-delay');
    });
  };

  try {
    observer = new IntersectionObserver(entries => {
      const visibleGroups = new Map();
      entries.forEach(entry => {
        if (!entry.isIntersecting || !entry.target.classList.contains('scroll-reveal-pending')) return;
        const item = items.get(entry.target);
        if (!item) return;
        if (!visibleGroups.has(item.group)) visibleGroups.set(item.group, []);
        visibleGroups.get(item.group).push({ element: entry.target, order: item.order });
      });
      // Stagger elements in the same section only when they enter the viewport.
      visibleGroups.forEach(batch => {
        batch.sort((a, b) => a.order - b.order).forEach(({ element }, index) => {
          const maxDelay = element.closest('#services') ? 425 : 340;
          reveal(element, Math.min(index * 85, maxDelay));
        });
      });
    }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });

    items.forEach((_, element) => {
      // Preserve content already passed when opening an anchor or restoring scroll.
      if (element.getBoundingClientRect().bottom <= 0) return;
      element.classList.add('scroll-reveal-pending');
      observer.observe(element);
    });
  } catch {
    finishAll();
    return;
  }

  const revealFocusedItem = event => {
    if (!(event.target instanceof Element)) return;
    const element = event.target.closest('.scroll-reveal-pending, .scroll-reveal-visible');
    if (!element) return;
    observer.unobserve(element);
    element.classList.remove('scroll-reveal-pending', 'scroll-reveal-visible');
    element.style.removeProperty('--reveal-delay');
  };
  document.addEventListener('focusin', revealFocusedItem);
  const focusedItem = document.activeElement;
  if (focusedItem) revealFocusedItem({ target: focusedItem });

  // Release the final animation transform so normal button hover effects resume.
  document.addEventListener('animationend', event => {
    if (!['section-content-in', 'process-line-in'].includes(event.animationName) || !(event.target instanceof Element)) return;
    event.target.classList.remove('scroll-reveal-visible');
    event.target.style.removeProperty('--reveal-delay');
  });

  motionPreference.addEventListener('change', event => {
    if (event.matches) finishAll();
  });
  // Browser Find and printing must be able to expose every section immediately.
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') finishAll();
  });
  window.addEventListener('beforeprint', finishAll);
}
initSectionReveals();

// All phrases occupy one grid cell, reserving the longest line before JS runs.
// Assistive technology reads the stable heading, without repeated announcements.
function initHeroRotation() {
  const hero = document.querySelector('.hero--text');
  const highlight = hero?.querySelector('.highlight');
  const phrases = [...(highlight?.querySelectorAll('[data-hero-phrase]') || [])];
  if (!highlight || phrases.length < 2) return;

  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const holdDuration = 4000;
  const phaseDuration = 200; // 200ms exit + 200ms entrance = 400ms total.
  const bounds = hero.getBoundingClientRect();
  let inViewport = bounds.bottom > 0 && bounds.top < window.innerHeight;
  let printing = false;
  let currentIndex = 0;
  let timer;

  const canRotate = () => !motionPreference.matches && !document.hidden && inViewport && !printing;
  const clearTimer = () => {
    window.clearTimeout(timer);
    timer = undefined;
  };

  const sync = () => {
    clearTimer();
    phrases.forEach(phrase => phrase.classList.remove('is-current', 'is-leaving'));
    const staticMode = motionPreference.matches || printing;
    highlight.classList.toggle('is-rotating', !staticMode);
    if (staticMode) {
      currentIndex = 0;
      return;
    }
    phrases[currentIndex].classList.add('is-current');
    if (canRotate()) timer = window.setTimeout(rotate, holdDuration);
  };

  const rotate = () => {
    if (!canRotate()) { sync(); return; }
    const outgoing = phrases[currentIndex];
    outgoing.classList.replace('is-current', 'is-leaving');
    timer = window.setTimeout(() => {
      if (!canRotate()) { sync(); return; }
      outgoing.classList.remove('is-leaving');
      currentIndex = (currentIndex + 1) % phrases.length;
      phrases[currentIndex].classList.add('is-current');
      // Wait until the entrance completes, then hold the fully visible phrase.
      timer = window.setTimeout(rotate, holdDuration + phaseDuration);
    }, phaseDuration);
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries[0].isIntersecting;
      if (visible === inViewport) return;
      inViewport = visible;
      sync();
    }, { threshold: 0 });
    observer.observe(hero);
  }
  motionPreference.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('beforeprint', () => { printing = true; sync(); });
  window.addEventListener('afterprint', () => { printing = false; sync(); });
  window.addEventListener('pagehide', clearTimer);
  window.addEventListener('pageshow', sync);
  sync();
}
initHeroRotation();

// Names are available on hover, keyboard focus, and tap without moving the icons.
function initProjectTooltips() {
  const section = document.querySelector('#work');
  if (!section) return;
  const triggers = [...section.querySelectorAll('[data-work-tooltip]')];
  const reset = trigger => {
    delete trigger.dataset.tooltipOpen;
    delete trigger.dataset.tooltipDismissed;
  };
  triggers.forEach(trigger => {
    if (trigger.tagName === 'BUTTON') {
      trigger.addEventListener('click', () => {
        const wasOpen = 'tooltipOpen' in trigger.dataset;
        triggers.forEach(reset);
        if (!wasOpen) trigger.dataset.tooltipOpen = '';
        else trigger.dataset.tooltipDismissed = '';
      });
    }
    trigger.addEventListener('blur', () => reset(trigger));
    trigger.addEventListener('pointerleave', () => { delete trigger.dataset.tooltipDismissed; });
  });
  document.addEventListener('click', event => {
    if (!triggers.some(trigger => trigger.contains(event.target))) triggers.forEach(reset);
  });
  section.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    triggers.forEach(trigger => {
      const visible = trigger === document.activeElement || trigger.matches(':hover') || 'tooltipOpen' in trigger.dataset;
      reset(trigger);
      if (visible) trigger.dataset.tooltipDismissed = '';
    });
  });
}
initProjectTooltips();

function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const statusEl = document.getElementById('form-status');

  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = form.elements['name']?.value?.trim() || '';
    const reach = form.elements['reach']?.value?.trim() || '';
    const service = form.querySelector('input[name="project_service"]:checked')?.value || 'مشروع جديد';
    const brief = form.elements['brief']?.value?.trim() || '';

    if (!name || !reach || !brief) {
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.className = 'form-status';
        statusEl.style.background = '#fef2f2';
        statusEl.style.color = '#991b1b';
        statusEl.textContent = 'يرجى ملء جميع الحقول المطلوبة قبل الإرسال.';
      }
      return;
    }

    const message = `مرحباً أبوبكر 👋\n\n*الاسم:* ${name}\n*وسيلة التواصل:* ${reach}\n*نوع المشروع:* ${service}\n\n*التفاصيل:*\n${brief}`;
    const whatsappUrl = `https://wa.me/971504991237?text=${encodeURIComponent(message)}`;

    if (statusEl) {
      statusEl.hidden = false;
      statusEl.className = 'form-status success';
      statusEl.innerHTML = `تم تجهيز التفاصيل بنجاح! جاري تحويلك إلى واتساب لبدء المحادثة مباشرة...<br><a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;text-decoration:underline;font-weight:700;color:#065f46;">اضغط هنا إذا لم يفتح واتساب تلقائياً ←</a>`;
    }
 
     window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  });
}
initContactForm();

// Mobile Bottom Navigation Dock Scroll Spy and Interactive State
function initMobileDock() {
  const dock = document.getElementById('mobile-dock');
  if (!dock) return;

  const items = Array.from(dock.querySelectorAll('.mobile-dock-item'));
  if (!items.length) return;

  const heroSection = document.getElementById('hero') || document.getElementById('top') || document.querySelector('.hero');
  const workSection = document.getElementById('work');
  const aboutSection = document.getElementById('about');
  const faqSection = document.getElementById('faq');
  const contactSection = document.getElementById('contact');

  const aboutItem = items.find(i => i.dataset.section === 'about');

  const sectionMap = [
    { id: 'contact', element: contactSection, item: items.find(i => i.dataset.section === 'contact') },
    { id: 'faq', element: faqSection, item: aboutItem },
    { id: 'about', element: aboutSection, item: aboutItem },
    { id: 'work', element: workSection, item: items.find(i => i.dataset.section === 'work') },
    { id: 'hero', element: heroSection, item: items.find(i => i.dataset.section === 'hero') },
  ];

  let isClickScrolling = false;
  let scrollTimeout;

  function setActive(activeItem) {
    items.forEach(item => {
      const isActive = item === activeItem;
      item.classList.toggle('is-active', isActive);
      if (isActive) {
        item.setAttribute('aria-current', 'page');
      } else {
        item.removeAttribute('aria-current');
      }
    });
  }

  function updateActiveOnScroll() {
    if (isClickScrolling) return;

    const scrollY = window.scrollY || window.pageYOffset;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;

    // Bottom of page (contact / footer)
    if (scrollY + windowHeight >= docHeight - 80) {
      const contactEntry = sectionMap.find(s => s.id === 'contact');
      if (contactEntry?.item) setActive(contactEntry.item);
      return;
    }

    // Top of page (Hero)
    if (scrollY < 200) {
      const heroEntry = sectionMap.find(s => s.id === 'hero');
      if (heroEntry?.item) setActive(heroEntry.item);
      return;
    }

    // Section trigger threshold line (middle-upper portion of viewport)
    const triggerLine = windowHeight * 0.38;

    for (const { element, item } of sectionMap) {
      if (!element || !item) continue;
      const rect = element.getBoundingClientRect();
      if (rect.top <= triggerLine) {
        setActive(item);
        break;
      }
    }
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateActiveOnScroll();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  items.forEach(item => {
    item.addEventListener('click', event => {
      const targetId = item.getAttribute('href');
      const targetEl = document.querySelector(targetId);
      if (!targetEl) return;

      event.preventDefault();
      setActive(item);

      isClickScrolling = true;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isClickScrolling = false;
      }, 800);

      targetEl.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Initial check on load
  updateActiveOnScroll();
}
initMobileDock();
