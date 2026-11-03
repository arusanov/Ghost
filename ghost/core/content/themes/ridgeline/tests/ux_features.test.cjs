const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const mainJsSource = fs.readFileSync(path.join(__dirname, '../assets/js/main.js'), 'utf8');

function createMockEnvironment(options = {}) {
    const storage = new Map();
    const listeners = new Map();

    const localStorage = {
        getItem: (k) => (storage.has(k) ? storage.get(k) : null),
        setItem: (k, v) => storage.set(k, String(v)),
        removeItem: (k) => storage.delete(k),
        clear: () => storage.clear()
    };

    let docTheme = options.initialTheme || null;
    const documentElement = {
        getAttribute: (attr) => (attr === 'data-theme' ? docTheme : null),
        setAttribute: (attr, val) => {
            if (attr === 'data-theme') docTheme = val;
        },
        removeAttribute: (attr) => {
            if (attr === 'data-theme') docTheme = null;
        },
        scrollHeight: 2000,
        scrollTop: 0
    };

    const elements = new Map();

    const createElement = (id, tag = 'div', classes = []) => {
        const clsList = new Set(classes);
        const elListeners = new Map();
        const el = {
            id,
            tagName: tag.toUpperCase(),
            style: {},
            textContent: '',
            hidden: false,
            classList: {
                contains: (c) => clsList.has(c),
                add: (c) => clsList.add(c),
                remove: (c) => clsList.delete(c),
                toggle: (c) => (clsList.has(c) ? clsList.delete(c) : clsList.add(c))
            },
            getAttribute: () => null,
            setAttribute: () => {},
            addEventListener: (ev, fn) => {
                if (!elListeners.has(ev)) elListeners.set(ev, []);
                elListeners.get(ev).push(fn);
            },
            trigger: (ev, eventObj) => {
                const fns = elListeners.get(ev) || [];
                fns.forEach((fn) => fn(eventObj));
            },
            querySelector: (sel) => {
                if (sel === '.share-btn-text') {
                    return { textContent: el.textContent };
                }
                return null;
            },
            getBoundingClientRect: () => ({
                top: options.rectTop !== undefined ? options.rectTop : 0,
                height: options.rectHeight !== undefined ? options.rectHeight : 1500
            }),
            querySelectorAll: () => []
        };
        elements.set(id, el);
        return el;
    };

    const themeToggleBtn = createElement('theme-toggle-btn', 'button');
    const readingProgress = createElement('reading-progress', 'div');
    const shareStoryBtn = createElement('share-story-btn', 'button');
    const backToTopBtn = createElement('back-to-top-btn', 'button');
    const articleBody = createElement('article-body-el', 'div', ['article-body']);

    const document = {
        title: 'Test Article Title',
        documentElement,
        body: documentElement,
        getElementById: (id) => elements.get(id) || null,
        querySelector: (sel) => {
            if (sel === '.article-body') return articleBody;
            if (sel === '.article-body .live-update-entry') return null;
            return null;
        },
        querySelectorAll: () => [],
        addEventListener: (ev, fn) => {
            if (!listeners.has(ev)) listeners.set(ev, []);
            listeners.get(ev).push(fn);
        }
    };

    let sharedData = null;
    let clipboardData = null;

    const navigator = {
        share: options.supportsShare ? (data) => {
            sharedData = data;
            return Promise.resolve();
        } : undefined,
        clipboard: {
            writeText: (txt) => {
                clipboardData = txt;
                return Promise.resolve();
            }
        }
    };

    let scrollToArgs = null;
    const window = {
        document,
        localStorage,
        navigator,
        location: { href: 'https://throttle-times.com/sample-story/' },
        innerHeight: 800,
        pageYOffset: options.pageYOffset || 0,
        scrollTo: (args) => {
            scrollToArgs = args;
        },
        matchMedia: () => ({ matches: options.systemDark || false }),
        addEventListener: (ev, fn) => {
            if (!listeners.has(ev)) listeners.set(ev, []);
            listeners.get(ev).push(fn);
        },
        trigger: (ev, eventObj) => {
            const fns = listeners.get(ev) || [];
            fns.forEach((fn) => fn(eventObj));
        }
    };

    const sandbox = {
        window,
        document,
        localStorage,
        navigator,
        Date,
        Math,
        setTimeout: (fn) => fn(),
        clearTimeout: () => {}
    };

    vm.createContext(sandbox);
    vm.runInContext(mainJsSource, sandbox);

    return {
        themeToggleBtn,
        readingProgress,
        shareStoryBtn,
        backToTopBtn,
        documentElement,
        localStorage,
        window,
        getSharedData: () => sharedData,
        getClipboardData: () => clipboardData,
        getScrollToArgs: () => scrollToArgs
    };
}

test('theme toggle switches from light to dark and persists choice', () => {
    const env = createMockEnvironment({ initialTheme: 'light' });
    assert.equal(env.documentElement.getAttribute('data-theme'), 'light');

    env.themeToggleBtn.trigger('click');
    assert.equal(env.documentElement.getAttribute('data-theme'), 'dark');
    assert.equal(env.localStorage.getItem('tt_theme'), 'dark');

    env.themeToggleBtn.trigger('click');
    assert.equal(env.documentElement.getAttribute('data-theme'), 'light');
    assert.equal(env.localStorage.getItem('tt_theme'), 'light');
});

test('reading progress calculates progress percentage along article body', () => {
    // totalHeight = 1500 - 800 = 700. rectTop = -350 => progress = 350 / 700 = 50%
    const env = createMockEnvironment({ rectTop: -350, rectHeight: 1500 });
    assert.equal(env.readingProgress.style.width, '50.0%');
});

test('share button invokes navigator.share when available', () => {
    const env = createMockEnvironment({ supportsShare: true });
    env.shareStoryBtn.trigger('click');
    const shared = env.getSharedData();
    assert.ok(shared);
    assert.equal(shared.title, 'Test Article Title');
    assert.equal(shared.url, 'https://throttle-times.com/sample-story/');
});

test('share button falls back to clipboard when navigator.share is unavailable', async () => {
    const env = createMockEnvironment({ supportsShare: false });
    env.shareStoryBtn.trigger('click');
    await Promise.resolve();
    assert.equal(env.getClipboardData(), 'https://throttle-times.com/sample-story/');
});

test('back to top button becomes visible past 600px and scrolls window to top', () => {
    const env = createMockEnvironment({ pageYOffset: 750 });
    assert.equal(env.backToTopBtn.classList.contains('is-visible'), true);
    assert.equal(env.backToTopBtn.hidden, false);

    env.backToTopBtn.trigger('click');
    const args = env.getScrollToArgs();
    assert.ok(args);
    assert.equal(args.top, 0);
    assert.equal(args.behavior, 'smooth');
});
