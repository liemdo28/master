(function () {
    'use strict';

    var BASE = (window.APP_URL || '').replace(/\/$/, '');
    var root, bodyEl, titleEl, subEl, openPageEl;
    var activeUrl = '';
    var previousUrl = '';
    var inFlight = null;

    var supportedDetailRe = [
        /^\/tasks\/\d+\/?$/,
        /^\/bills\/\d+\/?$/,
        /^\/admin\/users\/\d+\/?$/,
        /^\/obligations\/\d+\/?$/,
        /^\/obligations\/payment\/\d+\/?$/,
        /^\/admin\/penalties\/\d+\/?$/,
        /^\/activity\/\d+\/?$/,
        /^\/projects\/\d+\/?$/,
        /^\/credentials\/\d+\/?$/,
        /^\/releases\/\d+\/?$/
    ];

    var excludedPathRe = /\/(create|edit|delete|toggle|duplicate|paid|export|config|generate|refresh-health)(\/|$)/;

    function ensureMounted() {
        if (root) return;
        root = document.createElement('div');
        root.className = 'dd-root';
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = [
            '<div class="dd-backdrop" data-dd-close></div>',
            '<aside class="dd-panel" role="dialog" aria-modal="true" aria-labelledby="dd-title">',
            '  <header class="dd-head">',
            '    <div class="dd-title-wrap">',
            '      <h3 class="dd-title" id="dd-title">Details</h3>',
            '      <div class="dd-subtitle" id="dd-subtitle"></div>',
            '    </div>',
            '    <a class="dd-open-page" href="#" data-no-drawer="true" aria-label="Open full page" title="Open full page">Open</a>',
            '    <button class="dd-close" type="button" data-dd-close aria-label="Close">x</button>',
            '  </header>',
            '  <div class="dd-body" id="dd-body"></div>',
            '</aside>'
        ].join('');
        document.body.appendChild(root);
        bodyEl = root.querySelector('#dd-body');
        titleEl = root.querySelector('#dd-title');
        subEl = root.querySelector('#dd-subtitle');
        openPageEl = root.querySelector('.dd-open-page');

        root.addEventListener('click', function (e) {
            if (e.target.matches('[data-dd-close]')) close();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && root.classList.contains('dd-open')) {
                e.preventDefault();
                close();
            }
        });
    }

    function esc(s) {
        var d = document.createElement('div');
        d.textContent = s == null ? '' : String(s);
        return d.innerHTML;
    }

    function toUrl(href) {
        try {
            return new URL(href, window.location.origin);
        } catch (_) {
            return null;
        }
    }

    function isSupportedLink(link) {
        if (!link || link.dataset.noDrawer === 'true' || link.target === '_blank') return false;
        if (link.closest('[data-no-drawer="true"], form, .create-new-dropdown')) return false;
        var url = toUrl(link.getAttribute('href') || '');
        if (!url || url.origin !== window.location.origin) return false;
        if (excludedPathRe.test(url.pathname)) return false;
        return supportedDetailRe.some(function (re) { return re.test(url.pathname); });
    }

    function setBrowserDrawerParam(value) {
        var url = new URL(window.location.href);
        if (value) url.searchParams.set('drawer', value);
        else url.searchParams.delete('drawer');
        history.pushState({ detailDrawer: !!value }, '', url.toString());
    }

    function openShell(title, subtitle, url) {
        ensureMounted();
        root.classList.add('dd-open');
        root.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        titleEl.textContent = title || 'Details';
        subEl.textContent = subtitle || '';
        activeUrl = url || '';
        openPageEl.style.display = activeUrl ? '' : 'none';
        if (activeUrl) openPageEl.href = activeUrl;
        bodyEl.innerHTML = '<div class="dd-skeleton"></div><div class="dd-skeleton"></div><div class="dd-skeleton"></div>';
    }

    function openUrl(href, opts) {
        opts = opts || {};
        var url = toUrl(href);
        if (!url) return;
        var drawerValue = url.pathname + url.search + url.hash;
        previousUrl = opts.fromPopState ? previousUrl : window.location.href;
        openShell(opts.title || 'Loading...', drawerValue, url.toString());
        if (!opts.skipHistory) setBrowserDrawerParam(drawerValue);

        if (inFlight) inFlight.abort();
        inFlight = new AbortController();
        fetch(url.toString(), {
            credentials: 'same-origin',
            signal: inFlight.signal,
            headers: {
                'Accept': 'text/html',
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.text();
            })
            .then(function (html) { renderFetched(html, url); })
            .catch(function (err) {
                if (err.name === 'AbortError') return;
                bodyEl.innerHTML = '<div class="dd-error">Could not load details: ' + esc(err.message || 'unknown error') + '</div>';
            });
    }

    function extractContent(doc) {
        return doc.querySelector('.content-area')
            || doc.querySelector('main .td-wrap')
            || doc.querySelector('main .ob-wrap')
            || doc.querySelector('main .p-6')
            || doc.querySelector('main')
            || doc.body;
    }

    function renderFetched(html, url) {
        /* Guard: if user navigated away before this response arrived, discard it */
        if (url.toString() !== activeUrl) return;
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var content = extractContent(doc);
        var pageTitle = doc.querySelector('.page-header h2')?.textContent?.trim()
            || doc.querySelector('h1,h2,h3')?.textContent?.trim()
            || doc.title
            || 'Details';
        titleEl.textContent = pageTitle.replace(/\s+-\s+TaskFlow.*$/i, '');
        subEl.textContent = url.pathname + url.search;

        content.querySelectorAll('script, style[data-runtime-only]').forEach(function (el) { el.remove(); });
        bodyEl.innerHTML = content.innerHTML;
        bodyEl.querySelectorAll('a').forEach(function (a) {
            if (isSupportedLink(a)) a.classList.add('dd-link');
        });
    }

    function inlineTitle(trigger) {
        return trigger.dataset.ddTitle
            || trigger.getAttribute('aria-label')
            || trigger.querySelector('strong,.vendor-name-text,.sw-task-title,td')?.textContent?.trim()
            || 'Details';
    }

    function openInline(trigger) {
        ensureMounted();
        var selector = trigger.dataset.ddTarget;
        var source = selector ? document.querySelector(selector) : null;
        var next = trigger.nextElementSibling && trigger.nextElementSibling.matches('.vendor-detail-row,.store-detail-row')
            ? trigger.nextElementSibling
            : null;
        source = source || next;
        var title = inlineTitle(trigger);
        openShell(title, 'Current list item', '');
        if (source) {
            bodyEl.innerHTML = source.innerHTML;
        } else {
            bodyEl.innerHTML = buildInlineFromRow(trigger);
        }
        setBrowserDrawerParam('inline:' + (trigger.dataset.ddKey || title));
    }

    function buildInlineFromRow(row) {
        var cells = Array.from(row.querySelectorAll('th,td'));
        if (!cells.length) return '<div class="dd-empty">No detail content available.</div>';
        return '<div class="card"><div class="card-body">' + cells.map(function (cell) {
            return '<div style="padding:10px 0;border-bottom:1px solid var(--border,rgba(255,255,255,.08))">' + cell.innerHTML + '</div>';
        }).join('') + '</div></div>';
    }

    function close(opts) {
        opts = opts || {};
        if (!root) return;
        root.classList.remove('dd-open');
        root.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        bodyEl.innerHTML = '';
        activeUrl = '';
        if (!opts.skipHistory) setBrowserDrawerParam('');
    }

    document.addEventListener('click', function (e) {
        var inline = e.target.closest('[data-dd-inline]');
        if (inline) {
            var actionButton = e.target.closest('button');
            if (e.target.closest('a,input,select,textarea,label')) return;
            if (actionButton && !actionButton.classList.contains('vendor-name-cell')) return;
            e.preventDefault();
            openInline(inline);
            return;
        }

        var explicit = e.target.closest('[data-detail-drawer]');
        if (explicit && explicit.href) {
            e.preventDefault();
            openUrl(explicit.href, { title: explicit.textContent.trim() });
            return;
        }

        var link = e.target.closest('a');
        if (isSupportedLink(link)) {
            e.preventDefault();
            openUrl(link.href, { title: link.textContent.trim() });
        }
    });

    window.addEventListener('popstate', function () {
        var url = new URL(window.location.href);
        var drawer = url.searchParams.get('drawer');
        if (!drawer) {
            close({ skipHistory: true });
        } else if (!drawer.startsWith('inline:')) {
            openUrl(drawer, { fromPopState: true, skipHistory: true });
        }
    });

    document.addEventListener('DOMContentLoaded', function () {
        var drawer = new URL(window.location.href).searchParams.get('drawer');
        if (drawer && !drawer.startsWith('inline:')) {
            openUrl(drawer, { fromPopState: true, skipHistory: true });
        }
    });

    window.DetailDrawer = { open: openUrl, close: close, openInline: openInline };
})();
