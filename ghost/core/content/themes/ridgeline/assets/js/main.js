/* Ridgeline — the only two things this theme needs JS for. */
(function () {
    'use strict';

    // Mobile navigation toggle
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.querySelector('.site-nav');

    if (toggle && nav) {
        toggle.addEventListener('click', function () {
            var open = nav.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }

    // Wrap bare video embeds so they scale with the article column
    var selector = '.article-body iframe[src*="youtube.com"], .article-body iframe[src*="youtube-nocookie.com"], .article-body iframe[src*="player.vimeo.com"]';

    Array.prototype.forEach.call(document.querySelectorAll(selector), function (iframe) {
        if (iframe.closest('.responsive-video') || iframe.closest('.kg-card')) {
            return;
        }

        var wrapper = document.createElement('div');
        wrapper.className = 'responsive-video';
        iframe.parentNode.insertBefore(wrapper, iframe);
        wrapper.appendChild(iframe);
    });
})();
