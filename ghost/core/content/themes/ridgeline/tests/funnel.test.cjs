const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const theme = path.resolve(__dirname, '..');

function setup(options = {}) {
    let now = 1800000000000;
    const storage = new Map(Object.entries(options.storage || {}));
    if (options.consent !== false) storage.set('tt-consent', 'granted');
    const events = [];
    const listeners = {};
    const formListeners = {};
    const classes = new Set();
    const form = {addEventListener: (key, fn) => { formListeners[key] = fn; }, classList: {contains: key => classes.has(key)}};
    const article = {getAttribute: () => 'post-123', getBoundingClientRect: () => ({top: 0, bottom: options.short === false ? 3000 : 1000, height: options.short === false ? 3000 : 1000})};
    const document = {
        hidden: false,
        referrer: 'https://example.org/story?email=private@example.org',
        querySelector: () => options.article === false ? null : article,
        querySelectorAll: () => [form],
        addEventListener: (key, fn) => { listeners[key] = fn; }
    };
    let mutate;
    let fetches = 0;
    const context = vm.createContext({
        document, URL, Date: class extends Date { static now() { return now; } },
        performance: {now: () => now}, innerHeight: 800,
        localStorage: {
            getItem: key => { if (options.storageBlocked) throw Error(); return storage.get(key) || null; },
            setItem: (key, value) => { if (options.storageBlocked) throw Error(); storage.set(key, value); },
            removeItem: key => storage.delete(key)
        },
        setInterval: () => {},
        MutationObserver: class {constructor(fn) {mutate = fn;} observe() {}},
        fetch: async () => {fetches++; return {ok: !options.apiError, json: async () => options.member};},
        console
    });
    context.window = context;
    context.addEventListener = (key, fn) => { listeners[key] = fn; };
    context.gtag = (...args) => events.push(args);
    context.ttLandingCampaign = options.campaign || {};
    context.ttSignupReturn = options.confirm === true;
    context.location = {href: options.url || 'https://throttle-times.com/article/'};
    vm.runInContext(fs.readFileSync(path.join(theme, 'assets/js/funnel.js'), 'utf8'), context);
    return {
        context, document, storage, listeners, events,
        names: () => events.filter(e => e[0] === 'event').map(e => e[1]),
        advance(seconds) {for (let i = 0; i < seconds; i++) {now += 1000; listeners.scroll();}},
        consent(value) {listeners['tt-consent']({detail: value});},
        submit() {formListeners.submit();},
        state(value) {classes.clear(); classes.add(value); mutate();},
        fetches: () => fetches
    };
}

test('requires both 45 visible seconds and half the article; emits once', () => {
    const s = setup();
    s.advance(44);
    assert.deepEqual(s.names(), ['article_view']);
    s.advance(10);
    assert.deepEqual(s.names(), ['article_view', 'qualified_read']);
    const long = setup({short: false});
    long.advance(60);
    assert.deepEqual(long.names(), ['article_view']);
});

test('background time and non-article pages never qualify', () => {
    const s = setup();
    s.document.hidden = true; s.listeners.visibilitychange(); s.advance(120);
    assert.deepEqual(s.names(), ['article_view']);
    s.document.hidden = false; s.listeners.visibilitychange(); s.advance(45);
    assert.equal(s.names().at(-1), 'qualified_read');
    const home = setup({article: false}); home.advance(100);
    assert.deepEqual(home.names(), []);
});

test('consent gates tracking and storage, withdrawal clears attribution and pending', () => {
    const s = setup({consent: false, campaign: {source: 'facebook', medium: 'paid_social', campaign: 'test'}});
    s.advance(100); s.submit();
    assert.deepEqual(s.names(), []); assert.equal(s.storage.size, 0);
    s.consent('granted'); s.submit();
    assert.ok(s.storage.has('tt-campaign')); assert.ok(s.storage.has('tt-newsletter-pending'));
    s.consent('denied'); s.advance(100); s.state('success');
    assert.deepEqual(s.names(), ['article_view', 'newsletter_start']);
    assert.equal(s.storage.size, 0);
    assert.deepEqual(setup({storageBlocked: true}).names(), []);
});

test('form success is email sent, errors never convert', () => {
    const s = setup(); s.submit(); s.state('error'); s.submit(); s.state('success'); s.state('success');
    assert.deepEqual(s.names(), ['article_view', 'newsletter_start', 'newsletter_error', 'newsletter_start', 'newsletter_email_sent']);
});

test('campaign persists across internal pages, expires and rejects unsafe values', () => {
    const campaign = {source: 'facebook', medium: 'paid_social', campaign: 'nov_2026', id: '123', content: 'creative_a'};
    const s = setup({campaign});
    const next = setup({storage: Object.fromEntries(s.storage)});
    assert.equal(next.events[0][2].acq_content, 'creative_a');
    assert.equal(setup({campaign: {...campaign, source: 'person@example.com'}}).events[0][2].acq_source, undefined);
    const expired = setup({storage: {'tt-campaign': JSON.stringify({at: 1, campaign})}});
    assert.equal(expired.events[0][2].acq_source, undefined);
});

test('confirmed newsletter member converts despite legacy flag; freezes campaign and consumes pending', async () => {
    const pending = {at: 1800000000000, campaign: {source: 'google', medium: 'cpc', campaign: 'test'}, placement: 'newsletter_band'};
    const s = setup({confirm: true, storage: {'tt-newsletter-pending': JSON.stringify(pending)}, member: {subscribed: false, newsletters: [{}], created_at: new Date(pending.at).toISOString(), email: 'private@example.org'}});
    await new Promise(setImmediate);
    assert.equal(s.names().at(-1), 'newsletter_subscribe');
    assert.equal(s.events.at(-1)[2].acq_source, 'google');
    assert.ok(!JSON.stringify(s.events).includes('private@'));
    assert.ok(!s.storage.has('tt-newsletter-pending'));
    s.consent('granted'); await new Promise(setImmediate);
    assert.equal(s.names().filter(n => n === 'newsletter_subscribe').length, 1);
});

test('existing members, unsubscribed members, API errors and untracked returns do not convert', async () => {
    const pending = {'tt-newsletter-pending': JSON.stringify({at: 1800000000000})};
    for (const options of [
        {member: {subscribed: true, newsletters: [{}], created_at: '2020-01-01'}},
        {member: {subscribed: false, newsletters: [], created_at: new Date(1800000000000).toISOString()}},
        {member: {subscribed: true, newsletters: [], created_at: new Date(1800000000000).toISOString()}},
        {apiError: true}, {confirm: false}, {storage: {}}, {consent: false}
    ]) {
        const s = setup({confirm: true, storage: pending, ...options});
        await new Promise(setImmediate);
        assert.ok(!s.names().includes('newsletter_subscribe'));
    }
});

test('GA URL contains campaign/click tags but never tokens, emails, hashes or referrer queries', () => {
    const s = setup({url: 'https://throttle-times.com/?utm_source=google&utm_medium=cpc&utm_campaign=test&gclid=abc123&token=SECRET&email=private@example.org&success=true&action=subscribe#/portal/signin'});
    s.context.dataLayer = [];
    const script = fs.readFileSync(path.join(theme, 'partials/analytics.hbs'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/{{!--[\s\S]*?--}}/g, '').replace('{{@custom.google_analytics_id}}', 'G-TEST');
    vm.runInContext(script, s.context);
    const config = s.context.dataLayer.find(args => args[0] === 'config')[2];
    assert.equal(config.page_location, 'https://throttle-times.com/?utm_source=google&utm_medium=cpc&utm_campaign=test&gclid=abc123');
    assert.equal(config.page_referrer, 'https://example.org/story');
    assert.equal(s.context.ttSignupReturn, true);
});


test('cross-tab withdrawal updates GA consent and clears persisted attribution', () => {
    const s = setup({campaign: {source: 'twitter', medium: 'paid_social', campaign: 'test'}});
    s.submit(); s.advance(44);
    s.listeners.storage({key: 'tt-consent', newValue: 'denied'});
    s.advance(60);
    assert.deepEqual(s.names(), ['article_view', 'newsletter_start']);
    assert.equal(s.events.at(-1)[0], 'consent');
    assert.equal(s.events.at(-1)[2].analytics_storage, 'denied');
    assert.ok(!s.storage.has('tt-campaign'));
    assert.ok(!s.storage.has('tt-newsletter-pending'));
});
