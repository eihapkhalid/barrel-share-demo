(() => {
  'use strict';
  const QUOTES_KEY = 'barrelShare.quotes.v5';
  const BARRELS_KEY = 'barrelShare.barrels.v5';
  const $ = id => document.getElementById(id);
  const read = (key, fallback = []) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };

  function normalizeQuotes() {
    const quotes = read(QUOTES_KEY, []);
    let changed = false;
    const normalized = quotes.map(q => {
      const firstProductBarrel = (q.products || []).find(p => p.barrelId)?.barrelId || '';
      const barrelId = q.barrelId || q.defaultBarrelId || firstProductBarrel || '';
      const products = (q.products || []).map(p => {
        if (!Object.prototype.hasOwnProperty.call(p, 'barrelId')) return p;
        const { barrelId: _ignored, ...clean } = p;
        changed = true;
        return clean;
      });
      if (q.barrelId !== barrelId || q.defaultBarrelId !== barrelId) changed = true;
      return { ...q, barrelId, defaultBarrelId: barrelId, products };
    });
    if (changed) localStorage.setItem(QUOTES_KEY, JSON.stringify(normalized));
  }

  function nextBarrelId() {
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const prefix = `BRL-${stamp}-`;
    const nums = read(BARRELS_KEY, []).map(b => b.id).filter(id => id?.startsWith(prefix)).map(id => parseInt(id.slice(prefix.length), 10) || 0);
    return `${prefix}${String(Math.max(0, ...nums) + 1).padStart(3, '0')}`;
  }

  function addBarrelOption(barrel) {
    const select = $('defaultBarrelId');
    if (!select) return;
    if (![...select.options].some(o => o.value === barrel.id)) {
      select.add(new Option(`${barrel.id} — ${barrel.status}`, barrel.id));
    }
    select.value = barrel.id;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function createAndAssignBarrel() {
    const barrels = read(BARRELS_KEY, []);
    const barrel = { id: nextBarrelId(), createdAt: new Date().toISOString(), status: 'تجميع', notes: '' };
    localStorage.setItem(BARRELS_KEY, JSON.stringify([barrel, ...barrels]));
    addBarrelOption(barrel);
  }

  function forceProductsToRequestBarrel() {
    document.querySelectorAll('#productsContainer select[data-barrel]').forEach(select => {
      if (select.value !== '') {
        select.value = '';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const label = select.closest('label');
      if (label) label.style.display = 'none';
    });
    document.querySelectorAll('#productsContainer .product-more > summary').forEach(summary => {
      if (summary.textContent.includes('البرميل')) summary.textContent = 'تفاصيل إضافية: الرابط والوزن والحجم';
    });
  }

  function requireBarrelBeforeSave() {
    const save = $('saveQuoteBtn');
    if (!save) return;
    save.addEventListener('click', event => {
      const barrelId = $('defaultBarrelId')?.value || '';
      if (barrelId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      alert('اختر البرميل المرتبط بهذا الطلب قبل الحفظ.');
      document.querySelector('.tab[data-tab="order"]')?.click();
      setTimeout(() => $('defaultBarrelId')?.focus(), 0);
    }, true);
  }

  function init() {
    normalizeQuotes();
    $('createAndAssignBarrelBtn')?.addEventListener('click', createAndAssignBarrel);
    $('defaultBarrelId')?.addEventListener('change', forceProductsToRequestBarrel);
    requireBarrelBeforeSave();
    forceProductsToRequestBarrel();
    const container = $('productsContainer');
    if (container) new MutationObserver(forceProductsToRequestBarrel).observe(container, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
