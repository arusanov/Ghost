/* Ridgeline navigation, consent and article enhancements. */
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

    // Cookie consent: reveal the banner until a choice is stored, drive Consent Mode,
    // and let a "Cookie settings" link reopen it to withdraw/change consent.
    var banner = document.getElementById('cookie-banner');
    if (banner) {
        var CONSENT_KEY = 'tt-consent';
        var stored = null;
        try { stored = localStorage.getItem(CONSENT_KEY); } catch (e) {}

        if (!stored) {
            banner.hidden = false;
        }

        var setConsent = function (choice) {
            try { localStorage.setItem(CONSENT_KEY, choice); } catch (e) {}
            if (typeof window.gtag === 'function') {
                window.gtag('consent', 'update', { analytics_storage: choice === 'granted' ? 'granted' : 'denied' });
            }
            document.dispatchEvent(new CustomEvent('tt-consent', {detail: choice}));
            banner.hidden = true;
        };

        banner.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-consent]');
            if (btn) {
                setConsent(btn.getAttribute('data-consent'));
            }
        });

        document.addEventListener('click', function (e) {
            var link = e.target.closest('[data-cookie-settings]');
            if (link) {
                e.preventDefault();
                banner.hidden = false;
            }
        });
    }

    // Table of contents.
    //
    // Built here rather than in the template because Handlebars can't see inside
    // {{content}} — the post body arrives as pre-rendered HTML. Two jobs: give
    // every H2 a stable id (which is what lets search results deep-link into a
    // section, and gives an answer engine something to cite), and offer a jump
    // list on longer pieces.
    var body = document.querySelector('.article-body');
    var headings = body ? body.querySelectorAll('h2:not(.post-toc-title)') : [];

    var slugify = function (text) {
        return text.toLowerCase().trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    };

    if (headings.length) {
        var used = {};
        Array.prototype.forEach.call(headings, function (heading) {
            if (heading.id) {
                return;
            }
            var base = slugify(heading.textContent) || 'section';
            // Two sections can legitimately share a title ("Pricing" on a
            // comparison piece); suffix rather than emit duplicate ids.
            used[base] = (used[base] || 0) + 1;
            heading.id = used[base] > 1 ? base + '-' + used[base] : base;
        });
    }

    // Only worth a jump list when there's actually something to jump past,
    // and skip if a server-rendered .post-toc is already present.
    if (headings.length >= 3 && !document.querySelector('.post-toc')) {
        var toc = document.createElement('nav');
        toc.className = 'post-toc';
        toc.setAttribute('aria-labelledby', 'toc-heading');

        var heading = document.createElement('h2');
        heading.id = 'toc-heading';
        heading.className = 'post-toc-title';
        heading.textContent = 'In this article';
        toc.appendChild(heading);

        var list = document.createElement('ol');
        Array.prototype.forEach.call(headings, function (h) {
            var li = document.createElement('li');
            var a = document.createElement('a');
            a.href = '#' + h.id;
            a.textContent = h.textContent;
            li.appendChild(a);
            list.appendChild(li);
        });
        toc.appendChild(list);

        body.parentNode.insertBefore(toc, body);
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

    // Quick-search shortcut: press '/' when outside input elements to open Ghost search modal
    document.addEventListener('keydown', function (e) {
        if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            var active = document.activeElement;
            var isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable);
            if (!isInput) {
                var searchBtn = document.querySelector('[data-ghost-search]');
                if (searchBtn) {
                    e.preventDefault();
                    searchBtn.click();
                }
            }
        }
    });
})();
