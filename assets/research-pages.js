/* Research pages: YouTube preview that loads the player only when clicked (keeps pages light). */
(() => {
  'use strict';
  document.querySelectorAll('[data-youtube]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.youtube;
      const frame = document.createElement('iframe');
      frame.className = 'dz-yt-frame';
      frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&modestbranding=1`;
      frame.title = button.getAttribute('aria-label') || 'Research video';
      frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      frame.allowFullscreen = true;
      button.replaceWith(frame);
    });
  });
})();
