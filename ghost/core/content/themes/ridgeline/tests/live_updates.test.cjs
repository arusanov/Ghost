const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const themeDir = path.resolve(__dirname, '..');
const mainJsCode = fs.readFileSync(path.join(themeDir, 'assets/js/main.js'), 'utf8');

function createMockEntry(timestamp, id) {
    const classes = new Set(['live-update-entry']);
    let focused = false;
    let scrolledIntoView = false;
    return {
        id,
        getAttribute: (attr) => attr === 'data-timestamp' ? timestamp : null,
        classList: {
            add: (c) => {
                classes.add(c);
                if (c === 'is-focused') focused = true;
            },
            remove: (c) => {
                classes.delete(c);
                if (c === 'is-focused') focused = false;
            },
            contains: (c) => classes.has(c)
        },
        querySelector: () => null,
        scrollIntoView: () => { scrolledIntoView = true; },
        isFocused: () => focused,
        isScrolled: () => scrolledIntoView
    };
}

function runMain(options = {}) {
    const storage = new Map(Object.entries(options.storage || {}));
    const entries = options.entries || [];
    
    let headerHidden = true;
    let floatHidden = true;
    let badgeHidden = true;
    let headerText = '';
    let floatLabelText = '';
    let badgeText = '';

    const headerBtn = {
        get hidden() { return headerHidden; },
        set hidden(v) { headerHidden = v; },
        querySelector: (sel) => {
            if (sel === '.jump-text') return { set textContent(v) { headerText = v; }, get textContent() { return headerText; } };
            return null;
        },
        addEventListener: (evt, fn) => { if (evt === 'click') headerBtn.onclick = fn; }
    };

    const badgeCount = {
        get hidden() { return badgeHidden; },
        set hidden(v) { badgeHidden = v; },
        set textContent(v) { badgeText = v; },
        get textContent() { return badgeText; }
    };

    const floatBtn = {
        get hidden() { return floatHidden; },
        set hidden(v) { floatHidden = v; },
        style: {},
        querySelector: (sel) => {
            if (sel === '.floating-jump-label') return { set textContent(v) { floatLabelText = v; }, get textContent() { return floatLabelText; } };
            return null;
        },
        addEventListener: (evt, fn) => { if (evt === 'click') floatBtn.onclick = fn; }
    };

    const postElem = {
        getAttribute: (attr) => attr === 'data-post-slug' ? (options.slug || 'eicma-2026-motorcycle-reveals') : null
    };

    const elementsById = {
        'jump-to-updates-btn': headerBtn,
        'floating-jump-updates': floatBtn,
        'jump-badge-count': badgeCount
    };

    const document = {
        documentElement: { scrollHeight: 3000, scrollTop: 0 },
        querySelector: (sel) => {
            if (sel === 'main.post') return postElem;
            return null;
        },
        querySelectorAll: (sel) => {
            if (sel.includes('.live-update-entry')) return entries;
            return [];
        },
        getElementById: (id) => elementsById[id] || null,
        addEventListener: () => {}
    };

    const context = vm.createContext({
        document,
        window: {
            addEventListener: () => {},
            location: { pathname: `/${options.slug || 'eicma-2026-motorcycle-reveals'}/` },
            pageYOffset: 400,
            innerHeight: 800
        },
        localStorage: {
            getItem: (k) => storage.get(k) || null,
            setItem: (k, v) => storage.set(k, v)
        },
        Date,
        parseInt,
        isNaN,
        setTimeout: (fn) => fn(),
        Array
    });

    vm.runInContext(mainJsCode, context);

    return {
        storage,
        headerBtn,
        floatBtn,
        badgeCount,
        getHeaderText: () => headerText,
        getFloatText: () => floatLabelText,
        getBadgeText: () => badgeText,
        clickHeader: () => headerBtn.onclick && headerBtn.onclick({ preventDefault: () => {} })
    };
}

test('first-time visitor sees all updates marked unseen with correct count and button text', () => {
    const e1 = createMockEntry('2026-11-03T10:00:00Z', 'entry-1');
    const e2 = createMockEntry('2026-11-03T14:00:00Z', 'entry-2');

    const app = runMain({ entries: [e1, e2] });

    assert.equal(e1.classList.contains('is-unseen'), true);
    assert.equal(e2.classList.contains('is-unseen'), true);
    assert.equal(app.headerBtn.hidden, false);
    assert.equal(app.badgeCount.hidden, false);
    assert.equal(app.getBadgeText(), '2');
    assert.equal(app.getHeaderText(), 'Jump to New Updates');
});

test('clicking jump button marks updates as seen in localStorage and clears unseen badges', () => {
    const e1 = createMockEntry('2026-11-03T10:00:00Z', 'entry-1');
    const e2 = createMockEntry('2026-11-03T14:00:00Z', 'entry-2');

    const app = runMain({ entries: [e1, e2] });
    assert.equal(app.getBadgeText(), '2');

    app.clickHeader();

    assert.equal(e1.classList.contains('is-unseen'), false);
    assert.equal(e2.classList.contains('is-unseen'), false);
    assert.equal(e1.isScrolled(), true);
    assert.equal(app.badgeCount.hidden, true);
    assert.equal(app.getHeaderText(), '✓ Up to date');

    const saved = app.storage.get('tt_last_seen_eicma-2026-motorcycle-reveals');
    assert.ok(saved);
    assert.equal(parseInt(saved, 10), Date.parse('2026-11-03T14:00:00Z'));
});

test('returning visitor with recorded last_seen only sees subsequent updates flagged as new', () => {
    const lastSeen = Date.parse('2026-11-03T12:00:00Z').toString();
    const e1 = createMockEntry('2026-11-03T10:00:00Z', 'entry-1'); // Older
    const e2 = createMockEntry('2026-11-03T16:00:00Z', 'entry-2'); // Newer

    const app = runMain({
        storage: { 'tt_last_seen_eicma-2026-motorcycle-reveals': lastSeen },
        entries: [e1, e2]
    });

    assert.equal(e1.classList.contains('is-unseen'), false);
    assert.equal(e2.classList.contains('is-unseen'), true);
    assert.equal(app.getBadgeText(), '1');
    assert.equal(app.getHeaderText(), 'Jump to New Updates');
});

test('visitor up-to-date sees no unseen badge and button offers latest update jump', () => {
    const lastSeen = Date.parse('2026-11-03T20:00:00Z').toString();
    const e1 = createMockEntry('2026-11-03T10:00:00Z', 'entry-1');
    const e2 = createMockEntry('2026-11-03T14:00:00Z', 'entry-2');

    const app = runMain({
        storage: { 'tt_last_seen_eicma-2026-motorcycle-reveals': lastSeen },
        entries: [e1, e2]
    });

    assert.equal(e1.classList.contains('is-unseen'), false);
    assert.equal(e2.classList.contains('is-unseen'), false);
    assert.equal(app.badgeCount.hidden, true);
    assert.equal(app.getHeaderText(), '↓ Jump to Latest Update');
});
