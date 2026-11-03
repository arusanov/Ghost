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

    // Google Preferred Source: single button with cross-page persistent follow state
    var googleBtn = document.getElementById('google-preferred-btn');
    if (googleBtn) {
        var PREF_KEY = 'tt_google_preferred';
        var isFollowed = false;
        try { isFollowed = localStorage.getItem(PREF_KEY) === 'true'; } catch (e) {}

        var applyFollowState = function (followed) {
            var label = googleBtn.querySelector('.google-news-label');
            var cta = googleBtn.querySelector('.google-news-cta');
            if (followed) {
                googleBtn.classList.add('is-following');
                if (label) label.textContent = 'Preferred on Google';
                if (cta) cta.textContent = '✓ Following';
                googleBtn.setAttribute('title', 'Throttle Times is added to your preferred sources on Google. Click to manage preferences.');
            } else {
                googleBtn.classList.remove('is-following');
                if (label) label.textContent = 'Preferred on Google';
                if (cta) cta.textContent = '+ Follow';
                googleBtn.setAttribute('title', 'Add Throttle Times as a preferred source on Google Search and Discover');
            }
        };

        if (isFollowed) {
            applyFollowState(true);
        }

        googleBtn.addEventListener('click', function (e) {
            var prefUrl = 'https://www.google.com/preferences/source?q=throttle-times.com';
            var currentlyFollowed = false;
            try { currentlyFollowed = localStorage.getItem(PREF_KEY) === 'true'; } catch (err) {}

            if (currentlyFollowed) {
                // Already followed: let them view/manage on Google without resetting or asking again
                return; // Default <a> href opens prefUrl in new tab
            }

            e.preventDefault();
            try { localStorage.setItem(PREF_KEY, 'true'); } catch (err) {}
            applyFollowState(true);

            // Trigger Google's native addPreferredSource popup if SDK is loaded; otherwise open preference tab
            if (window.PREFERRED_SOURCE && typeof window.PREFERRED_SOURCE.api === 'object' && typeof window.PREFERRED_SOURCE.api.addPreferredSource === 'function') {
                try {
                    window.PREFERRED_SOURCE.api.addPreferredSource();
                    return;
                } catch (apiErr) {}
            }
            window.open(prefUrl, '_blank', 'noopener,noreferrer');
        });
    }

    // Live Updates & Reading Progress (localStorage tracking and smooth scroll jump)
    var postMain = document.querySelector('main.post');
    var updateEntries = postMain ? Array.prototype.slice.call(postMain.querySelectorAll('.article-body .live-update-entry')) : [];
    var headerBtn = document.getElementById('jump-to-updates-btn');
    var floatBtn = document.getElementById('floating-jump-updates');
    var badgeCount = document.getElementById('jump-badge-count');

    // Never show update buttons on pages without live update entries
    if (!postMain || updateEntries.length === 0) {
        if (headerBtn) {
            headerBtn.hidden = true;
            if (headerBtn.style) headerBtn.style.display = 'none';
        }
        if (floatBtn) {
            floatBtn.hidden = true;
            if (floatBtn.style) floatBtn.style.display = 'none';
        }
    } else {
        var slug = postMain.getAttribute('data-post-slug') || window.location.pathname.replace(/^\/|\/$/g, '');
        var SEEN_KEY = 'tt_last_seen_' + slug;
        var lastSeen = 0;
        try { lastSeen = parseInt(localStorage.getItem(SEEN_KEY) || '0', 10); } catch (e) {}

        var unseenList = [];
        var maxTimestamp = 0;

        updateEntries.forEach(function (entry) {
            var rawTs = entry.getAttribute('data-timestamp');
            if (!rawTs) {
                var timeElem = entry.querySelector('time');
                if (timeElem) rawTs = timeElem.getAttribute('datetime');
            }
            var entryTime = rawTs ? Date.parse(rawTs) : 0;
            if (!isNaN(entryTime) && entryTime > maxTimestamp) {
                maxTimestamp = entryTime;
            }

            if (!isNaN(entryTime) && entryTime > lastSeen) {
                entry.classList.add('is-unseen');
                unseenList.push(entry);
            } else {
                entry.classList.remove('is-unseen');
            }
        });

        var updateButtonLabels = function () {
            var count = unseenList.length;
            if (headerBtn) {
                headerBtn.hidden = false;
                if (headerBtn.style) headerBtn.style.display = '';
                var jumpText = headerBtn.querySelector('.jump-text');
                if (count > 0) {
                    if (jumpText) jumpText.textContent = 'Jump to New Updates';
                    if (badgeCount) {
                        badgeCount.textContent = count.toString();
                        badgeCount.hidden = false;
                    }
                } else {
                    if (jumpText) jumpText.textContent = '↓ Jump to Latest Update';
                    if (badgeCount) badgeCount.hidden = true;
                }
            }

            if (floatBtn) {
                floatBtn.hidden = false;
                if (floatBtn.style) floatBtn.style.display = '';
                var floatLabel = floatBtn.querySelector('.floating-jump-label');
                if (count > 0) {
                    if (floatLabel) floatLabel.textContent = 'New Updates (' + count + ')';
                } else {
                    if (floatLabel) floatLabel.textContent = 'Latest Update';
                }
            }
        };

        updateButtonLabels();

            var markAllSeen = function () {
                var recordTime = maxTimestamp > 0 ? maxTimestamp : Date.now();
                try { localStorage.setItem(SEEN_KEY, recordTime.toString()); } catch (e) {}
                lastSeen = recordTime;
                updateEntries.forEach(function (e) { e.classList.remove('is-unseen'); });
                unseenList = [];
                if (badgeCount) badgeCount.hidden = true;
                if (headerBtn) {
                    var jumpText = headerBtn.querySelector('.jump-text');
                    if (jumpText) jumpText.textContent = '✓ Up to date';
                }
                if (floatBtn) {
                    floatBtn.style.opacity = '0.5';
                    setTimeout(function () {
                        if (floatBtn && unseenList.length === 0) floatBtn.style.opacity = '';
                    }, 2000);
                }
            };

            var handleJump = function (e) {
                if (e) e.preventDefault();
                var target = unseenList.length > 0 ? unseenList[0] : updateEntries[updateEntries.length - 1];
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    target.classList.add('is-focused');
                    setTimeout(function () { target.classList.remove('is-focused'); }, 3000);
                }
                markAllSeen();
            };

            if (headerBtn) headerBtn.addEventListener('click', handleJump);
            if (floatBtn) floatBtn.addEventListener('click', handleJump);

            // Hide floating button when at the very top or near the bottom
            var handleScroll = function () {
                if (!floatBtn) return;
                var docElem = document.documentElement || document.body;
                var scrolled = window.pageYOffset || (docElem ? docElem.scrollTop : 0);
                var docHeight = (docElem ? docElem.scrollHeight : 0) - (window.innerHeight || 800);
                if (scrolled < 300 || (docHeight > 0 && scrolled > docHeight - 200)) {
                    floatBtn.style.transform = 'translateY(100px)';
                    floatBtn.style.opacity = '0';
                    floatBtn.style.pointerEvents = 'none';
                } else {
                    floatBtn.style.transform = 'translateY(0)';
                    floatBtn.style.opacity = '1';
                    floatBtn.style.pointerEvents = 'auto';
                }
            };

            window.addEventListener('scroll', handleScroll, { passive: true });
            handleScroll();

            // Observe entries to mark as seen as reader scrolls naturally
            if ('IntersectionObserver' in window) {
                var observer = new IntersectionObserver(function (records) {
                    records.forEach(function (rec) {
                        if (rec.isIntersecting) {
                            var entry = rec.target;
                            if (entry.classList.contains('is-unseen')) {
                                entry.classList.remove('is-unseen');
                                var idx = unseenList.indexOf(entry);
                                if (idx > -1) unseenList.splice(idx, 1);
                                var rawTs = entry.getAttribute('data-timestamp');
                                var entryTime = rawTs ? Date.parse(rawTs) : 0;
                                if (!isNaN(entryTime) && entryTime > lastSeen) {
                                    lastSeen = entryTime;
                                    try { localStorage.setItem(SEEN_KEY, lastSeen.toString()); } catch (err) {}
                                }
                                updateButtonLabels();
                            }
                        }
                    });
                }, { threshold: 0.4 });

                updateEntries.forEach(function (e) { observer.observe(e); });
            }
        }

        // -------------------------------------------------------------------------
        // Manual Dark / Light Mode Toggle
        // -------------------------------------------------------------------------
        var themeToggleBtn = document.getElementById('theme-toggle-btn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', function () {
                var current = document.documentElement.getAttribute('data-theme');
                var isDark = false;
                if (current === 'dark') {
                    isDark = true;
                } else if (!current && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    isDark = true;
                }

                var nextTheme = isDark ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', nextTheme);
                try { localStorage.setItem('tt_theme', nextTheme); } catch (e) {}
            });
        }

        // -------------------------------------------------------------------------
        // Reading Progress Indicator Bar
        // -------------------------------------------------------------------------
        var progressBar = document.getElementById('reading-progress');
        var articleBody = document.querySelector('.article-body');
        if (progressBar && articleBody) {
            var updateProgress = function () {
                var rect = articleBody.getBoundingClientRect();
                var totalHeight = rect.height - window.innerHeight;
                if (totalHeight <= 0) {
                    progressBar.style.width = '100%';
                    return;
                }
                var progress = -rect.top / totalHeight;
                progress = Math.max(0, Math.min(1, progress));
                progressBar.style.width = (progress * 100).toFixed(1) + '%';
            };
            window.addEventListener('scroll', updateProgress, { passive: true });
            updateProgress();
        }

        // -------------------------------------------------------------------------
        // Native Web Share API with Clipboard Fallback
        // -------------------------------------------------------------------------
        var shareBtn = document.getElementById('share-story-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', function () {
                var pageTitle = document.title || 'Throttle Times';
                var pageUrl = window.location.href;
                if (navigator.share) {
                    navigator.share({
                        title: pageTitle,
                        url: pageUrl
                    }).catch(function () {});
                } else if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(pageUrl).then(function () {
                        var label = shareBtn.querySelector('.share-btn-text');
                        var origText = label ? label.textContent : '';
                        if (label) label.textContent = 'Copied!';
                        shareBtn.classList.add('is-copied');
                        setTimeout(function () {
                            if (label) label.textContent = origText || 'Share';
                            shareBtn.classList.remove('is-copied');
                        }, 2000);
                    }).catch(function () {});
                }
            });
        }
})();
