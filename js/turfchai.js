/* TurfChai prototype interactions */
(function () {
  'use strict';

  /* ---------- Theme ---------- */
  const saved = localStorage.getItem('tc-theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);

  function bindThemeToggles() {
    document.querySelectorAll('[data-toggle-theme]').forEach(btn => {
      const sync = () => {
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        btn.textContent = dark ? '☀️' : '🌙';
        btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
      };
      sync();
      btn.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('tc-theme', next);
        document.querySelectorAll('[data-toggle-theme]').forEach(b => {
          b.textContent = next === 'dark' ? '☀️' : '🌙';
        });
      });
    });
  }

  /* ---------- Tabs ---------- */
  function bindTabs() {
    document.querySelectorAll('[data-tabs]').forEach(group => {
      const tabs = group.querySelectorAll('.tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('on'));
          tab.classList.add('on');
          const scope = group.getAttribute('data-tabs');
          document.querySelectorAll(`[data-panel-group="${scope}"]`).forEach(p => {
            p.classList.toggle('on', p.getAttribute('data-panel') === tab.getAttribute('data-tab'));
          });
        });
      });
    });
    document.querySelectorAll('.seg').forEach(seg => {
      seg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        seg.querySelectorAll('button').forEach(x => {
          x.classList.remove('on');
          if (x.hasAttribute('aria-selected')) x.setAttribute('aria-selected', 'false');
        });
        b.classList.add('on');
        if (b.hasAttribute('aria-selected')) b.setAttribute('aria-selected', 'true');
        const scope = seg.getAttribute('data-tabs');
        if (scope && b.hasAttribute('data-tab')) {
          document.querySelectorAll(`[data-panel-group="${scope}"]`).forEach(p => {
            p.classList.toggle('on', p.getAttribute('data-panel') === b.getAttribute('data-tab'));
          });
        }
      }));
    });
  }

  /* ---------- Overlays (modal / sheet / drawer) ---------- */
  function bindOverlays() {
    document.querySelectorAll('[data-open]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        const target = document.querySelector(el.getAttribute('data-open'));
        if (target) target.classList.add('open');
      });
    });
    document.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', () => {
        el.closest('.overlay')?.classList.remove('open');
      });
    });
    document.querySelectorAll('.overlay').forEach(ov => {
      ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open'));
    });
  }

  /* ---------- Toast ---------- */
  let toastEl, toastTimer;
  window.showToast = function (msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
  };
  function bindToasts() {
    document.querySelectorAll('[data-toast]').forEach(el => {
      el.addEventListener('click', () => showToast(el.getAttribute('data-toast')));
    });
  }

  /* ---------- Slot selection ---------- */
  function bindSlots() {
    document.querySelectorAll('.slotgrid').forEach(grid => {
      grid.querySelectorAll('.slot.available').forEach(slot => {
        slot.addEventListener('click', () => {
          grid.querySelectorAll('.slot.selected').forEach(s => {
            s.classList.remove('selected'); s.classList.add('available');
          });
          slot.classList.remove('available');
          slot.classList.add('selected');
          const out = document.querySelector('[data-slot-out]');
          if (out) out.textContent = slot.querySelector('b')?.textContent || '';
          const cta = document.querySelector('[data-slot-cta]');
          if (cta) cta.removeAttribute('disabled');
        });
      });
    });
    // date strip
    document.querySelectorAll('.datestrip').forEach(strip => {
      strip.querySelectorAll('.datebox').forEach(d => d.addEventListener('click', () => {
        strip.querySelectorAll('.datebox').forEach(x => x.classList.remove('on'));
        d.classList.add('on');
      }));
    });
    // filter chips (toggle)
    document.querySelectorAll('.chip[data-filter]').forEach(c => {
      c.addEventListener('click', e => { e.preventDefault(); c.classList.toggle('on'); });
    });
  }

  /* ---------- Countdown (slot lock) ---------- */
  function bindCountdowns() {
    document.querySelectorAll('[data-countdown]').forEach(el => {
      let s = parseInt(el.getAttribute('data-countdown'), 10);
      const render = () => {
        const m = Math.floor(s / 60), sec = s % 60;
        el.textContent = `${m}:${String(sec).padStart(2, '0')}`;
      };
      render();
      const t = setInterval(() => {
        s -= 1;
        if (s < 0) { clearInterval(t); el.textContent = '0:00'; return; }
        render();
      }, 1000);
    });
  }

  /* ---------- Site navigator (global, injected on every page) ---------- */
  function injectSiteNav() {
    const path = location.pathname.replace(/\\/g, '/');
    const inSub = /\/(player|solo|owner|admin|host)\//.test(path);
    const p = inSub ? '../' : '';

    const map = [
      ['Start here', [
        ['player/landing.html', 'Landing page'],
        ['index.html', 'Prototype hub'],
        ['player/auth.html', 'Sign in / Sign up'],
        ['design-system.html', 'Design system'],
        ['states.html', 'States & edge cases'],
      ]],
      ['Players', [
        ['player/home.html', 'Player home'],
        ['player/explore.html', 'Explore venues'],
        ['player/venue.html', 'Venue detail'],
        ['player/checkout.html', 'Checkout'],
        ['player/bookings.html', 'My bookings'],
        ['player/split-payment.html', 'Split payment'],
        ['player/matchday.html', 'Match day ticket'],
        ['player/review.html', 'Leave a review'],
      ]],
      ['Solo players', [
        ['solo/open-games.html', 'Open games'],
        ['solo/game-detail.html', 'Game detail & join'],
        ['solo/lfg-alert.html', 'Availability alerts'],
        ['solo/ticket.html', 'Game ticket'],
      ]],
      ['Turf owners', [
        ['owner/dashboard.html', 'Owner dashboard'],
        ['owner/calendar.html', 'Calendar'],
        ['owner/bookings.html', 'Bookings'],
        ['owner/payments.html', 'Payments & reports'],
        ['owner/promotions.html', 'Promotions'],
        ['owner/reviews.html', 'Reviews'],
        ['owner/staff.html', 'Staff & shifts'],
        ['owner/onboarding.html', 'List your venue'],
      ]],
      ['Tournament hosts', [
        ['player/home.html#host', 'Tournament hub'],
        ['host/multi-pitch.html', 'Multi-pitch booking'],
        ['host/reserve.html', 'Reserve & pay'],
      ]],
      ['Admin console', [
        ['admin/login.html', 'Admin sign in'],
        ['admin/dashboard.html', 'Admin dashboard'],
        ['admin/turf-requests.html', 'Turf requests'],
        ['admin/turfs.html', 'Turfs'],
        ['admin/users.html', 'Users & players'],
        ['admin/activity.html', 'Activity log'],
      ]],
    ];

    const cols = map.map(([title, links]) => {
      const items = links.map(([href, label]) => {
        const cls = path.endsWith('/' + href) ? ' class="here"' : '';
        return `<a href="${p}${href}"${cls}>${label}</a>`;
      }).join('');
      return `<div><h4>${title}</h4>${items}</div>`;
    }).join('');

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'tcSiteNav';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Site navigation');
    overlay.innerHTML =
      `<div class="modal sitenav-panel">
        <div class="between"><h3 style="margin:0">Go anywhere</h3><button class="icon-btn" data-close aria-label="Close">✕</button></div>
        <p class="subtle" style="margin:2px 0 0">Every screen of the TurfChai prototype, one tap away.</p>
        <div class="sitenav-grid">${cols}</div>
      </div>`;
    document.body.appendChild(overlay);

    const fab = document.createElement('button');
    fab.className = 'sitenav-fab';
    fab.setAttribute('data-open', '#tcSiteNav');
    fab.setAttribute('aria-label', 'Open site navigation');
    fab.innerHTML = '<span aria-hidden="true">🧭</span> Menu';
    document.body.appendChild(fab);
  }

  /* ---------- Favicon (injected so all 43 pages get it) ---------- */
  function injectFavicon() {
    if (document.querySelector('link[rel="icon"]')) return;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M16 2.5C9.6 2.5 4.5 7.6 4.5 14c0 8.2 11.5 15.5 11.5 15.5S27.5 22.2 27.5 14C27.5 7.6 22.4 2.5 16 2.5z" fill="%2312A150"/><rect x="10" y="8.5" width="12" height="11" rx="2" fill="none" stroke="%23fff" stroke-width="1.5"/><line x1="16" y1="8.5" x2="16" y2="19.5" stroke="%23fff" stroke-width="1.5"/><circle cx="16" cy="14" r="2.2" fill="none" stroke="%23fff" stroke-width="1.5"/></svg>';
    const l = document.createElement('link');
    l.rel = 'icon';
    l.type = 'image/svg+xml';
    l.href = 'data:image/svg+xml,' + svg;
    document.head.appendChild(l);
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectFavicon();
    injectSiteNav();
    bindThemeToggles();
    bindTabs();
    bindOverlays();
    bindToasts();
    bindSlots();
    bindCountdowns();
    
    // Responsive sidebar drawer
    document.querySelectorAll('[data-toggle-sidebar]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        document.body.classList.toggle('sidebar-open');
      });
    });
  });
})();
