// ============================
// SCROLL REVEAL
// ============================
const revealEls = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
revealEls.forEach(el => revealObserver.observe(el));

// ============================
// QUADRANT: click a star, popup anchored near it inside the quadrant
// ============================
const quadrantWrap = document.querySelector('.quadrant-wrap');
const quadrantSvg = document.getElementById('quadrant');
const tooltip = document.getElementById('tooltip');
const tooltipTag = tooltip.querySelector('.tooltip-tag');
const tooltipTitle = tooltip.querySelector('.tooltip-title');
const tooltipBlurb = tooltip.querySelector('.tooltip-blurb');

// viewBox is 1000 x 500
const VB_W = 1000, VB_H = 500;
const TOOLTIP_W = 230, TOOLTIP_H = 130, GAP = 22;
let activeStar = null;

function hideTooltip() {
  if (activeStar) activeStar.classList.remove('is-active');
  activeStar = null;
  tooltip.hidden = true;
}

function showTooltipFor(group) {
  activeStar = group;
  group.classList.add('is-active');

  tooltipTag.textContent = group.dataset.tag;
  tooltipTitle.textContent = group.dataset.title;
  tooltipBlurb.textContent = group.dataset.blurb;

  const cx = parseFloat(group.dataset.cx);
  const cy = parseFloat(group.dataset.cy);
  const wrapRect = quadrantWrap.getBoundingClientRect();

  // Star's actual pixel position inside the wrapper.
  const starX = (cx / VB_W) * wrapRect.width;
  const starY = (cy / VB_H) * wrapRect.height;

  // Prefer placing the tooltip on the "outward" side of the star (away from
  // the center axes), but only if there's genuinely room — otherwise flip to
  // the other side. A fixed GAP keeps it from ever overlapping the star itself.
  let left = (starX - TOOLTIP_W - GAP >= 0)
    ? starX - TOOLTIP_W - GAP
    : starX + GAP;
  left = Math.max(0, Math.min(left, wrapRect.width - TOOLTIP_W));

  let top = (starY - TOOLTIP_H - GAP >= 0)
    ? starY - TOOLTIP_H - GAP
    : starY + GAP;
  top = Math.max(0, Math.min(top, wrapRect.height - TOOLTIP_H));

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.hidden = false;
}

if (quadrantSvg) {
  quadrantSvg.querySelectorAll('.star-group').forEach(group => {
    group.addEventListener('click', () => {
      if (activeStar === group) {
        hideTooltip();
      } else {
        if (activeStar) activeStar.classList.remove('is-active');
        showTooltipFor(group);
      }
    });
    group.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (activeStar === group) {
          hideTooltip();
        } else {
          if (activeStar) activeStar.classList.remove('is-active');
          showTooltipFor(group);
        }
      }
    });
  });
}

// ============================
// WORK FILTERS
// ============================
const filterBtns = document.querySelectorAll('.filter-btn');
const workCards = document.querySelectorAll('#work-grid .project-card');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    const filter = btn.dataset.filter;
    workCards.forEach(card => {
      const match = filter === 'all' || card.dataset.category === filter;
      card.classList.toggle('is-hidden', !match);
    });
  });
});

// ============================
// HORIZONTAL TIMELINE — focus the item nearest the center
// ============================
const timelineScroll = document.getElementById('timeline-scroll');
const timelineTrack = document.querySelector('.timeline-track');
const timelineItems = document.querySelectorAll('.timeline-item');
const timelineSpacers = document.querySelectorAll('.timeline-spacer');
const TIMELINE_ITEM_W = 260; // must match the flex-basis set in styles.css

function setTimelinePadding() {
  if (!timelineScroll || timelineSpacers.length !== 2) return;
  const pad = Math.max(0, (timelineScroll.clientWidth - TIMELINE_ITEM_W) / 2);
  timelineSpacers.forEach(spacer => { spacer.style.width = `${pad}px`; });
}

function updateTimelineFocus() {
  if (!timelineScroll) return;

  const scrollRect = timelineScroll.getBoundingClientRect();
  const center = scrollRect.left + scrollRect.width / 2;

  let closest = null;
  let closestDist = Infinity;

  timelineItems.forEach(item => {
    const r = item.getBoundingClientRect();
    const itemCenter = r.left + r.width / 2;
    const dist = Math.abs(itemCenter - center);
    if (dist < closestDist) {
      closestDist = dist;
      closest = item;
    }
  });

  timelineItems.forEach(item => item.classList.toggle('is-focused', item === closest));
}

let ticking = false;
if (timelineScroll) {
  timelineScroll.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateTimelineFocus();
        ticking = false;
      });
      ticking = true;
    }
  });

  // ResizeObserver catches every real reason the container's width could
  // change — not just window resize, but late web-font swaps or the page's
  // own scrollbar appearing/disappearing — any of which would silently
  // throw off a padding value computed only once at 'load'.
  if ('ResizeObserver' in window) {
    const timelineResizeObserver = new ResizeObserver(() => {
      setTimelinePadding();
      updateTimelineFocus();
    });
    timelineResizeObserver.observe(timelineScroll);
  } else {
    setTimelinePadding();
    updateTimelineFocus();
    window.addEventListener('resize', () => {
      setTimelinePadding();
      updateTimelineFocus();
    });
  }
}

// ============================
// PASSWORD GATE
// ------------------------------------------------------------------
// IMPORTANT: this is a client-side check only. It is a *deterrent*,
// not real security — anyone who opens dev tools can read the
// password in this file. Fine for keeping casual visitors and
// search engines out; not fine for anything genuinely sensitive.
// ============================

const siteGate = document.getElementById('site-gate');
const siteContent = document.getElementById('site-content');
const siteGateForm = document.getElementById('site-gate-form');
const siteGateError = document.getElementById('site-gate-error');

const SITE_PASSWORD_HASH = '69f4a35679c3c12745633235f9dc5834ec7bd9bd1f615b826fe85913c567a98d'; // <-- your hash goes here

async function checkPassword(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('') === SITE_PASSWORD_HASH;
}

if (siteGateForm) {
  siteGateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('site-gate-password').value;
    if (await checkPassword(input)) {
      siteGate.style.display = 'none';
      siteContent.classList.add('is-unlocked');
    } else {
      siteGateError.hidden = false;
    }
  });
}

// ============================
// NAV SCROLL-SPY — highlight the nav link for whichever section is
// currently near the center of the viewport, and on click
// ============================
const navLinks = document.querySelectorAll('.site-nav a');
const navSectionIds = ['work', 'timeline', 'crafts', 'about'];
const navSections = navSectionIds
  .map(id => document.getElementById(id))
  .filter(Boolean);

function setActiveNav(id) {
  navLinks.forEach(link => {
    link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
  });
}

if (navSections.length) {
  const navObserver = new IntersectionObserver((entries) => {
    let best = null;
    entries.forEach(entry => {
      if (entry.isIntersecting && (!best || entry.intersectionRatio > best.intersectionRatio)) {
        best = entry;
      }
    });
    if (best) setActiveNav(best.target.id);
  }, { threshold: [0.15, 0.3, 0.5], rootMargin: '-35% 0px -35% 0px' });

  navSections.forEach(sec => navObserver.observe(sec));
}

navLinks.forEach(link => {
  link.addEventListener('click', () => {
    const id = link.getAttribute('href').replace('#', '');
    setActiveNav(id);
  });
});
