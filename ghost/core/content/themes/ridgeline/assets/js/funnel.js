/* Consented reader and newsletter funnel; no member identifiers leave the site. */
(function () {
    'use strict';
    if (typeof window.gtag !== 'function') return;

    var DAY = 86400000;
    var CAMPAIGN = 'tt-campaign';
    var PENDING = 'tt-newsletter-pending';
    var allowed = false;
    var campaign = {};
    var article = document.querySelector('[data-analytics-post]');
    var viewed = false;
    var qualified = false;
    var elapsed = 0;
    var lastTick = performance.now();
    var visible = !document.hidden;
    var reachedHalf = false;
    var confirming = false;
    var fields = ['source', 'medium', 'campaign', 'id', 'content'];

    function cleanCampaign(value) {
        var result = {};
        fields.forEach(function (key) {
            var item = value && value[key];
            if (typeof item === 'string' && /^[a-zA-Z0-9_.~-]{1,100}$/.test(item)) result[key] = item;
        });
        return result.source && result.medium && result.campaign ? result : {};
    }

    function remove(key) {
        try { localStorage.removeItem(key); } catch (e) {}
    }

    function read(key, age) {
        try {
            var record = JSON.parse(localStorage.getItem(key));
            if (record && Number.isFinite(record.at) && record.at <= Date.now() && Date.now() - record.at < age) return record;
        } catch (e) {}
        remove(key);
        return null;
    }

    function write(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    }

    function send(name, attribution, extra) {
        if (!allowed) return;
        var params = Object.assign({}, extra);
        fields.forEach(function (key) {
            if (attribution[key]) params['acq_' + key] = attribution[key];
        });
        if (article) params.post_id = article.getAttribute('data-analytics-post');
        window.gtag('event', name, params);
    }

    function tick() {
        var now = performance.now();
        if (allowed && visible && article && !qualified) {
            // Cap suspended/background timer gaps instead of crediting sleep as reading.
            elapsed += Math.min(now - lastTick, 2000);
            var rect = article.getBoundingClientRect();
            if (rect.height > 0 && rect.top < innerHeight && rect.bottom > 0 && innerHeight - rect.top >= rect.height / 2) reachedHalf = true;
            if (elapsed >= 45000 && reachedHalf) {
                qualified = true;
                send('qualified_read', campaign);
            }
        }
        lastTick = now;
    }

    function confirmSubscription() {
        if (!allowed || confirming || !window.ttSignupReturn || !read(PENDING, DAY)) return;
        confirming = true;
        fetch('/members/api/member/', {credentials: 'same-origin', cache: 'no-store'})
            .then(function (response) { return response.ok ? response.json() : null; })
            .then(function (member) {
                if (!allowed) return;
                var pending = read(PENDING, DAY);
                // Ghost’s legacy subscribed flag can be false for members with newsletter subscriptions.
                if (!pending || !member || !Array.isArray(member.newsletters) || !member.newsletters.length) return;
                var created = Date.parse(member.created_at);
                // Existing members signing in must never become acquisition conversions.
                if (!Number.isFinite(created) || created < pending.at - 60000 || created > Date.now() + 60000) return;
                remove(PENDING);
                send('newsletter_subscribe', cleanCampaign(pending.campaign), {signup_placement: pending.placement === 'portal' ? 'portal' : 'newsletter_band'});
            })
            .catch(function () { /* Keep pending state so a reload can retry. */ })
            .finally(function () { confirming = false; });
    }

    function consent(choice) {
        allowed = choice === 'granted';
        lastTick = performance.now();
        elapsed = 0;
        reachedHalf = false;
        if (!allowed) {
            campaign = {};
            remove(CAMPAIGN);
            remove(PENDING);
            return;
        }
        var saved = read(CAMPAIGN, 30 * DAY);
        campaign = cleanCampaign(window.ttLandingCampaign);
        if (campaign.source) write(CAMPAIGN, {at: Date.now(), campaign: campaign});
        else campaign = cleanCampaign(saved && saved.campaign);
        if (article && !viewed) {
            viewed = true;
            send('article_view', campaign);
        }
        confirmSubscription();
    }

    function start(placement) {
        if (!allowed) return;
        write(PENDING, {at: Date.now(), campaign: campaign, placement: placement});
        send('newsletter_start', campaign, {signup_placement: placement});
    }

    Array.prototype.forEach.call(document.querySelectorAll('.newsletter-form[data-members-form]'), function (form) {
        var submitted = false;
        form.addEventListener('submit', function () {
            submitted = allowed;
            if (submitted) start('newsletter_band');
        });
        new MutationObserver(function () {
            if (!submitted) return;
            if (form.classList.contains('success')) {
                submitted = false;
                send('newsletter_email_sent', campaign, {signup_placement: 'newsletter_band'});
            } else if (form.classList.contains('error') || form.classList.contains('invalid')) {
                submitted = false;
                send('newsletter_error', campaign, {signup_placement: 'newsletter_band'});
            }
        }).observe(form, {attributes: true, attributeFilter: ['class']});
    });

    // shortcut: Portal is an iframe; only its entry and confirmed return are measured.
    // Add an official Portal event integration if intermediate Portal steps are needed.
    document.addEventListener('click', function (event) {
        if (event.target.closest('[data-portal="signup"], a[href="#/portal/signup"]')) start('portal');
    });
    document.addEventListener('tt-consent', function (event) { consent(event.detail); });
    window.addEventListener('storage', function (event) {
        if (event.key === 'tt-consent') {
            window.gtag('consent', 'update', {analytics_storage: event.newValue === 'granted' ? 'granted' : 'denied'});
            consent(event.newValue);
        }
    });
    document.addEventListener('visibilitychange', function () {
        tick();
        visible = !document.hidden;
    });
    window.addEventListener('scroll', tick, {passive: true});
    setInterval(tick, 1000);
    try { consent(localStorage.getItem('tt-consent')); } catch (e) { consent('denied'); }
})();
