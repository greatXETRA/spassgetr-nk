(() => {
  'use strict';

  /* ---------------------------------------------------------------------
     Helpers
  --------------------------------------------------------------------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const formatEUR = (n) => `€${n.toFixed(2)}`;

  function trapFocus(container) {
    const focusable = $$(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      container
    );
    if (!focusable.length) return () => {};
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    function onKeydown(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    container.addEventListener('keydown', onKeydown);
    return () => container.removeEventListener('keydown', onKeydown);
  }

  /* ---------------------------------------------------------------------
     Mobile navigation
  --------------------------------------------------------------------- */
  const navToggle = $('#navToggle');
  const navClose = $('#navClose');
  const mobileNav = $('#mobileNav');
  const scrim = $('#scrim');
  let lastFocused = null;
  let releaseTrap = () => {};

  function openMobileNav() {
    lastFocused = document.activeElement;
    mobileNav.hidden = false;
    scrim.hidden = false;
    requestAnimationFrame(() => mobileNav.setAttribute('data-open', 'true'));
    navToggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    releaseTrap = trapFocus(mobileNav);
    navClose.focus();
  }

  function closeMobileNav() {
    mobileNav.removeAttribute('data-open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    releaseTrap();
    setTimeout(() => {
      mobileNav.hidden = true;
      scrim.hidden = true;
    }, 220);
    if (lastFocused) lastFocused.focus();
  }

  navToggle?.addEventListener('click', openMobileNav);
  navClose?.addEventListener('click', closeMobileNav);
  scrim?.addEventListener('click', closeMobileNav);
  $$('.mobile-nav-list a').forEach((a) => a.addEventListener('click', closeMobileNav));

  /* ---------------------------------------------------------------------
     Region / currency dropdown
  --------------------------------------------------------------------- */
  const regionBtn = $('#regionBtn');
  const regionMenu = $('#regionMenu');

  function closeRegionMenu() {
    regionMenu.hidden = true;
    regionBtn.setAttribute('aria-expanded', 'false');
  }

  regionBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = regionBtn.getAttribute('aria-expanded') === 'true';
    if (isOpen) {
      closeRegionMenu();
    } else {
      regionMenu.hidden = false;
      regionBtn.setAttribute('aria-expanded', 'true');
    }
  });

  $$('.region-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      $$('.region-option').forEach((o) => o.classList.remove('is-selected'));
      opt.classList.add('is-selected');
      const label = regionBtn.querySelector('span');
      if (label) label.textContent = opt.textContent.split('·')[0].trim().toUpperCase();
      closeRegionMenu();
    });
  });

  document.addEventListener('click', (e) => {
    if (!regionMenu.hidden && !regionMenu.contains(e.target) && e.target !== regionBtn) {
      closeRegionMenu();
    }
  });

  /* ---------------------------------------------------------------------
     Search overlay
  --------------------------------------------------------------------- */
  const searchToggle = $('#searchToggle');
  const searchOverlay = $('#searchOverlay');
  const searchClose = $('#searchClose');
  const searchInput = $('#searchInput');
  let releaseSearchTrap = () => {};

  function openSearch() {
    lastFocused = document.activeElement;
    searchOverlay.hidden = false;
    searchToggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    releaseSearchTrap = trapFocus(searchOverlay);
    setTimeout(() => searchInput.focus(), 10);
  }

  function closeSearch() {
    searchOverlay.hidden = true;
    searchToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    releaseSearchTrap();
    if (lastFocused) lastFocused.focus();
  }

  searchToggle?.addEventListener('click', openSearch);
  searchClose?.addEventListener('click', closeSearch);
  $('#searchForm')?.addEventListener('submit', (e) => e.preventDefault());

  /* ---------------------------------------------------------------------
     Cart (persisted to localStorage)
  --------------------------------------------------------------------- */
  const CART_KEY = 'spassgetraenk_cart_v1';
  const cartToggle = $('#cartToggle');
  const cartDrawer = $('#cartDrawer');
  const cartClose = $('#cartClose');
  const cartScrim = $('#cartScrim');
  const cartItemsEl = $('#cartItems');
  const cartEmptyEl = $('#cartEmpty');
  const cartFooterEl = $('#cartFooter');
  const cartTotalEl = $('#cartTotal');
  const cartCountEl = $('#cartCount');
  let releaseCartTrap = () => {};

  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveCart(cart) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      /* storage unavailable — cart still works for this session */
    }
  }

  let cart = loadCart();

  function renderCart() {
    cartItemsEl.innerHTML = '';
    const hasItems = cart.length > 0;
    cartEmptyEl.hidden = hasItems;
    cartFooterEl.hidden = !hasItems;

    let total = 0;
    let count = 0;

    cart.forEach((item) => {
      total += item.price * item.qty;
      count += item.qty;

      const li = document.createElement('li');
      li.className = 'cart-item';
      li.innerHTML = `
        <img src="${item.image}" alt="" width="72" height="72">
        <div>
          <p class="cart-item-name">${item.name}</p>
          <p class="cart-item-price">${formatEUR(item.price)}</p>
          <div class="cart-item-qty">
            <button type="button" data-action="dec" aria-label="Menge verringern">–</button>
            <span>${item.qty}</span>
            <button type="button" data-action="inc" aria-label="Menge erhöhen">+</button>
          </div>
        </div>
        <button type="button" class="cart-item-remove" data-action="remove">Entfernen</button>
      `;
      li.querySelector('[data-action="dec"]').addEventListener('click', () => changeQty(item.id, -1));
      li.querySelector('[data-action="inc"]').addEventListener('click', () => changeQty(item.id, 1));
      li.querySelector('[data-action="remove"]').addEventListener('click', () => removeItem(item.id));
      cartItemsEl.appendChild(li);
    });

    cartTotalEl.textContent = formatEUR(total);
    cartCountEl.textContent = String(count);
    cartCountEl.hidden = count === 0;
    cartToggle.setAttribute('aria-label', `Warenkorb öffnen, ${count} ${count === 1 ? 'Artikel' : 'Artikel'}`);
  }

  function changeQty(id, delta) {
    const item = cart.find((i) => i.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter((i) => i.id !== id);
    }
    saveCart(cart);
    renderCart();
  }

  function removeItem(id) {
    cart = cart.filter((i) => i.id !== id);
    saveCart(cart);
    renderCart();
  }

  function addItem(product) {
    const existing = cart.find((i) => i.id === product.id);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ ...product, qty: 1 });
    }
    saveCart(cart);
    renderCart();
  }

  function openCart() {
    lastFocused = document.activeElement;
    cartDrawer.hidden = false;
    cartScrim.hidden = false;
    requestAnimationFrame(() => cartDrawer.setAttribute('data-open', 'true'));
    cartToggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    releaseCartTrap = trapFocus(cartDrawer);
    cartClose.focus();
  }

  function closeCart() {
    cartDrawer.removeAttribute('data-open');
    cartToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    releaseCartTrap();
    setTimeout(() => {
      cartDrawer.hidden = true;
      cartScrim.hidden = true;
    }, 220);
    if (lastFocused) lastFocused.focus();
  }

  cartToggle?.addEventListener('click', openCart);
  cartClose?.addEventListener('click', closeCart);
  cartScrim?.addEventListener('click', closeCart);

  $$('.product-card').forEach((card) => {
    const btn = card.querySelector('.add-to-cart');
    const img = card.querySelector('img');
    btn?.addEventListener('click', () => {
      const product = {
        id: card.dataset.id,
        name: card.dataset.name,
        price: parseFloat(card.dataset.price),
        image: img ? img.src : '',
      };
      addItem(product);

      btn.dataset.added = 'true';
      const original = btn.textContent;
      btn.textContent = 'Hinzugefügt ✓';
      setTimeout(() => {
        btn.textContent = original;
        btn.removeAttribute('data-added');
      }, 1400);
    });
  });

  renderCart();

  /* ---------------------------------------------------------------------
     Escape key closes any open overlay
  --------------------------------------------------------------------- */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!mobileNav.hidden) closeMobileNav();
    if (!searchOverlay.hidden) closeSearch();
    if (!cartDrawer.hidden) closeCart();
    if (!regionMenu.hidden) closeRegionMenu();
  });

  /* ---------------------------------------------------------------------
     Back to top
  --------------------------------------------------------------------- */
  const backToTop = $('#backToTop');

  function toggleBackToTop() {
    const show = window.scrollY > 480;
    backToTop.toggleAttribute('data-visible', show);
    backToTop.hidden = false;
    backToTop.tabIndex = show ? 0 : -1;
  }

  window.addEventListener('scroll', toggleBackToTop, { passive: true });
  toggleBackToTop();

  backToTop?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ---------------------------------------------------------------------
     Newsletter (front-end only demo)
  --------------------------------------------------------------------- */
  const newsletterForm = $('#newsletterForm');
  const newsletterStatus = $('#newsletterStatus');

  newsletterForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = $('#newsletterEmail').value.trim();
    if (!email) return;
    newsletterStatus.textContent = `Danke! Wir haben ${email} eingetragen.`;
    newsletterForm.reset();
  });
})();
