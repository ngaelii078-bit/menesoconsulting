/* Progressive enhancement: content is fully visible if motion is unavailable. */
(() => {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!('requestAnimationFrame' in window) || !('animate' in Element.prototype)) return;
  const root = document.documentElement;
  const states = [];
  const animations = [];
  const clamp = n => Math.max(0, Math.min(1, n));
  let enabled = !preference.matches;
  let frame = 0;
  let lastTime = 0;

  function splitHeading(heading) {
    const original = heading.innerText.replace(/\s+/g, ' ').trim();
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach(node => {
      const fragment = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) fragment.append(document.createTextNode(part));
        else { const span = document.createElement('span'); span.className = 'word'; span.textContent = part; fragment.append(span); }
      });
      node.replaceWith(fragment);
    });
    heading.setAttribute('aria-label', original);
    heading.querySelectorAll('.word').forEach(word => word.setAttribute('aria-hidden', 'true'));
    return [...heading.querySelectorAll('.word')];
  }

  const hero = document.querySelector('.hero');
  const heroWords = splitHeading(document.querySelector('h1'));
  document.querySelectorAll('main h2').forEach(heading => {
    heading.classList.add('scroll-heading');
    states.push({ heading, words: splitHeading(heading), current: 0, target: 0 });
  });
  const progress = document.createElement('div');
  progress.className = 'scroll-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.append(progress);

  function draw(state) {
    const count = Math.max(1, state.words.length - 1);
    state.words.forEach((word, i) => {
      const reveal = clamp((state.current - (i / count) * .68) / .32);
      const eased = 1 - Math.pow(1 - reveal, 3);
      word.style.opacity = String(.16 + eased * .84);
      word.style.transform = `translate3d(0,${(1 - eased) * 17}px,0)`;
      word.style.filter = `blur(${(1 - eased) * 3.5}px)`;
    });
  }

  function tick(time) {
    frame = 0;
    if (!enabled) return;
    const viewport = window.innerHeight;
    // The words finish revealing before the heading reaches the viewport centre.
    states.forEach(state => {
      const rect = state.heading.getBoundingClientRect();
      state.target = clamp((viewport * .9 - rect.top) / Math.min(viewport * .37, 320));
    });
    const dt = Math.min(64, lastTime ? time - lastTime : 16.67);
    lastTime = time;
    const smoothing = 1 - Math.exp(-dt / 105);
    let moving = false;
    states.forEach(state => {
      state.current += (state.target - state.current) * smoothing;
      if (Math.abs(state.target - state.current) < .001) state.current = state.target;
      else moving = true;
      draw(state);
    });
    const pageHeight = document.documentElement.scrollHeight - viewport;
    progress.style.transform = `scaleX(${pageHeight > 0 ? clamp(window.scrollY / pageHeight) : 0})`;
    if (moving) frame = requestAnimationFrame(tick);
  }

  function schedule() { if (enabled && !frame) { lastTime = 0; frame = requestAnimationFrame(tick); } }
  function applyPreference() {
    enabled = !preference.matches;
    root.classList.toggle('motion-active', enabled);
    if (!enabled) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      hero.classList.remove('hero-entering');
      animations.forEach(animation => animation.cancel());
      [...heroWords, ...states.flatMap(state => state.words)].forEach(word => {
        word.style.opacity = ''; word.style.transform = ''; word.style.filter = '';
      });
    } else schedule();
  }

  applyPreference();
  if (enabled) {
    hero.classList.add('hero-entering');
    heroWords.forEach((word, index) => {
      animations.push(word.animate([
        { opacity: 0, transform: 'translate3d(0,48px,0) rotate(2deg)', filter: 'blur(9px)' },
        { opacity: 1, transform: 'translate3d(0,0,0) rotate(0deg)', filter: 'blur(0)' }
      ], { duration: 1250, delay: 150 + index * 145, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
    });
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('pageshow', schedule);
  document.querySelectorAll('details').forEach(details => details.addEventListener('toggle', schedule));
  if (document.fonts) document.fonts.ready.then(schedule);
  preference.addEventListener('change', applyPreference);
})();

// An uncluttered gallery viewer, with keyboard navigation and focus restoration.
(() => {
  const links = [...document.querySelectorAll('.project-gallery a')];
  if (!links.length || !('HTMLDialogElement' in window)) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'gallery-viewer';
  dialog.setAttribute('aria-label', 'Meneso project photograph viewer');
  dialog.innerHTML = '<div class="viewer-toolbar"><span class="viewer-counter" aria-live="polite"></span><button class="viewer-close" aria-label="Close photograph">Close ×</button></div><div class="viewer-image-wrap"><img class="viewer-image" alt=""></div><div class="viewer-controls"><button class="viewer-prev" aria-label="Previous photograph">← Previous</button><span>MENESO / ON SITE</span><button class="viewer-next" aria-label="Next photograph">Next →</button></div>';
  document.body.append(dialog);
  const picture = dialog.querySelector('img');
  let current = 0;
  let previousFocus;
  let previousOverflow;
  const show = index => {
    current = (index + links.length) % links.length;
    picture.src = links[current].href;
    picture.alt = links[current].querySelector('img').alt;
    dialog.querySelector('.viewer-counter').textContent = `Photograph ${String(current + 1).padStart(2, '0')} / ${links.length}`;
  };
  links.forEach((link,index) => {
    link.querySelector('span').textContent = `On site / ${String(index + 1).padStart(2,'0')} ↗`;
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      previousFocus = link;
      previousOverflow = document.body.style.overflow;
      show(index);
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    });
  });
  dialog.querySelector('.viewer-close').addEventListener('click', () => dialog.close());
  dialog.querySelector('.viewer-prev').addEventListener('click', () => show(current - 1));
  dialog.querySelector('.viewer-next').addEventListener('click', () => show(current + 1));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') { event.preventDefault(); show(current + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); show(current - 1); }
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    if (previousFocus) previousFocus.focus({ preventScroll: true });
  });
})();
