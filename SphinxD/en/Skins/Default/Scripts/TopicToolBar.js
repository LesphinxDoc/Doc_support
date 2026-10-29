(function () {
  function getScrollTop() {
    const win = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const containers = document.querySelectorAll('.topic-content, .mc-content, .body-container, .main-section, .off-canvas-content');
    let max = win;
    containers.forEach(el => { if (el && el.scrollTop > max) max = el.scrollTop; });
    return max;
  }

  function scrollToTopAll() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelectorAll('.topic-content, .mc-content, .body-container, .main-section, .off-canvas-content')
      .forEach(el => { if (el) el.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  function onScroll() {
    const btn = document.querySelector('a.scrollToTop');
    if (!btn) return;
    (getScrollTop() > 100) ? btn.classList.add('is-visible') : btn.classList.remove('is-visible');
  }

  // attach listeners to window + likely scroll containers
  function bind() {
    window.addEventListener('scroll', onScroll, { passive: true });
    ['.topic-content', '.mc-content', '.body-container', '.main-section', '.off-canvas-content']
      .forEach(sel => {
        const el = document.querySelector(sel);
        if (el) el.addEventListener('scroll', onScroll, { passive: true });
      });
    // click handler (delegated)
    document.addEventListener('click', function (e) {
      const a = e.target.closest('a.scrollToTop');
      if (!a) return;
      e.preventDefault();
      scrollToTopAll();
    });
    // initial state
    onScroll();
  }

  // Flare can load topic content dynamically; observe and re-evaluate
  const mo = new MutationObserver(onScroll);

  // init
  document.addEventListener('DOMContentLoaded', function () {
    bind();
    mo.observe(document.body, { childList: true, subtree: true });
  });
  window.addEventListener('load', onScroll);
})();
