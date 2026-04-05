(function () {
  const ROOT_PATHS = new Set(['/', '/index.html']);
  const LEGACY_DETAIL_PATH = '/movie/detail.html';
  const ROUTE_LOADING_ID = 'app-route-loading';
  const ROUTE_LOADING_STYLE_ID = 'app-route-loading-style';

  const SCRIPT_PATHS = {
    home: '/js/main/home.js',
    movieMain: '/js/movie/movie_main.js',
    movieDetail: '/js/movie/movie_detail.js',
    footer: '/js/main/body3.js',
    mypage: '/js/user/mypage.js',
    edit: '/js/user/edit.js',
    changepw: '/js/user/changepw.js'
  };

  const ROUTE_SPINNER_DELAY_MS = 2000;

  let routeJob = Promise.resolve();
  let routeLoadingSpinnerTimer = null;
  let routeLoadingToken = 0;

  function ensureScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);

      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve();
          return;
        }

        existing.addEventListener('load', () => {
          existing.dataset.loaded = 'true';
          resolve();
        }, { once: true });

        existing.addEventListener('error', () => {
          reject(new Error(`script load fail: ${src}`));
        }, { once: true });

        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.defer = true;

      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve();
      }, { once: true });

      script.addEventListener('error', () => {
        reject(new Error(`script load fail: ${src}`));
      }, { once: true });

      document.body.appendChild(script);
    });
  }

  function normalizePathname(pathname) {
    if (ROOT_PATHS.has(pathname)) {
      return '/';
    }

    if (pathname === LEGACY_DETAIL_PATH) {
      return '/';
    }

    return pathname;
  }

  function toPositiveInt(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
  }

  function getRouteFromUrl(url = new URL(window.location.href)) {
    const pathname = normalizePathname(url.pathname);
    const params = url.searchParams;

    return {
      pathname,
      page: toPositiveInt(params.get('page')),
      movie_id: toPositiveInt(params.get('movie_id')),
      q: String(params.get('q') || '').trim(),
      view: String(params.get('view') || '').trim()
    };
  }

  function buildUrlFromRoute(route = {}) {
    const url = new URL('/', window.location.origin);

    if (route.view) {
      url.searchParams.set('view', String(route.view));
      return `${url.pathname}${url.search}`;
    }

    const page = toPositiveInt(route.page);
    if (page) {
      url.searchParams.set('page', String(page));
    }

    const q = String(route.q || '').trim();
    if (q) {
      url.searchParams.set('q', q);
    }

    const movieId = toPositiveInt(route.movie_id);
    if (movieId) {
      url.searchParams.set('movie_id', String(movieId));
    }

    return `${url.pathname}${url.search}`;
  }

  function ensureMainBody() {
    let mainBody = document.getElementById('main-body');

    if (!mainBody) {
      mainBody = document.createElement('div');
      mainBody.id = 'main-body';
      document.body.appendChild(mainBody);
    }

    return mainBody;
  }

  function clearMainBody() {
    const mainBody = ensureMainBody();
    mainBody.innerHTML = '';
    mainBody.style.display = '';
    return mainBody;
  }

  function removeSection(id) {
    const node = document.getElementById(id);
    if (node) node.remove();
  }

  function clearTransientUi() {
    const loginOverlay = document.getElementById('login-modal-overlay');
    if (loginOverlay) {
      loginOverlay.remove();
    }

    const mainVideoModal = document.getElementById('main-video-modal');
    if (mainVideoModal) {
      mainVideoModal.remove();
    }

    document.body.classList.remove('login-modal-open');
    document.body.classList.remove('main-video-modal-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
  }

  function normalizeLegacyUrlIfNeeded() {
    const url = new URL(window.location.href);

    if (url.pathname !== LEGACY_DETAIL_PATH) {
      return;
    }

    const next = buildUrlFromRoute({
      page: toPositiveInt(url.searchParams.get('page')),
      q: String(url.searchParams.get('q') || '').trim(),
      movie_id: toPositiveInt(url.searchParams.get('movie_id'))
    });

    window.history.replaceState({ __app: true }, '', next);
  }

  function ensureRouteLoadingStyle() {
    if (document.getElementById(ROUTE_LOADING_STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = ROUTE_LOADING_STYLE_ID;
    style.textContent = `
      #${ROUTE_LOADING_ID} {
        background: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        box-sizing: border-box;
      }

      .app-route-loading-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
        padding: 40px 20px;
      }

      .app-route-loading-indicator {
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
      }

      .app-route-loading-indicator.is-visible {
        display: flex;
      }

      .app-route-loading-spinner {
        width: 42px;
        height: 42px;
        border: 4px solid #e5e7eb;
        border-top-color: #111827;
        border-radius: 50%;
        animation: app-route-spin 0.8s linear infinite;
      }

      .app-route-loading-text {
        font-size: 14px;
        line-height: 1.4;
        color: #6b7280;
      }

      @keyframes app-route-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;

    document.head.appendChild(style);
  }

  function getHeaderHeight() {
    const siteHeader = document.getElementById('site-header');
    if (!siteHeader) return 0;
    return Math.ceil(siteHeader.getBoundingClientRect().height || 0);
  }

  function getRouteLoadingHeight() {
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
    const headerHeight = getHeaderHeight();
    return Math.max(viewportHeight - headerHeight, 420);
  }

  function ensureRouteLoadingLayer() {
    let layer = document.getElementById(ROUTE_LOADING_ID);
    if (layer) return layer;

    layer = document.createElement('section');
    layer.id = ROUTE_LOADING_ID;
    layer.innerHTML = `
      <div class="app-route-loading-inner" aria-live="polite" aria-busy="true">
        <div class="app-route-loading-indicator" data-route-loading-indicator>
          <div class="app-route-loading-spinner" aria-hidden="true"></div>
          <div class="app-route-loading-text">불러오는 중...</div>
        </div>
      </div>
    `;

    const siteHeader = document.getElementById('site-header');
    const mainBody = ensureMainBody();

    if (siteHeader && siteHeader.parentNode) {
      if (mainBody && mainBody.parentNode === siteHeader.parentNode) {
        siteHeader.parentNode.insertBefore(layer, mainBody);
      } else if (siteHeader.nextSibling) {
        siteHeader.parentNode.insertBefore(layer, siteHeader.nextSibling);
      } else {
        siteHeader.parentNode.appendChild(layer);
      }
    } else {
      document.body.insertBefore(layer, document.body.firstChild);
    }

    return layer;
  }

  function clearRouteLoadingSpinnerTimer() {
    if (routeLoadingSpinnerTimer) {
      clearTimeout(routeLoadingSpinnerTimer);
      routeLoadingSpinnerTimer = null;
    }
  }

  function showRouteLoading() {
    ensureRouteLoadingStyle();

    const layer = ensureRouteLoadingLayer();
    const indicator = layer.querySelector('[data-route-loading-indicator]');

    clearRouteLoadingSpinnerTimer();
    routeLoadingToken += 1;
    const currentToken = routeLoadingToken;

    layer.style.display = 'flex';
    layer.style.minHeight = `${getRouteLoadingHeight()}px`;

    if (indicator) {
      indicator.classList.remove('is-visible');
    }

    routeLoadingSpinnerTimer = window.setTimeout(() => {
      const activeLayer = document.getElementById(ROUTE_LOADING_ID);
      if (!activeLayer) return;
      if (currentToken !== routeLoadingToken) return;

      const activeIndicator = activeLayer.querySelector('[data-route-loading-indicator]');
      if (activeIndicator) {
        activeIndicator.classList.add('is-visible');
      }
    }, ROUTE_SPINNER_DELAY_MS);
  }

  function hideRouteLoading() {
    clearRouteLoadingSpinnerTimer();

    const layer = document.getElementById(ROUTE_LOADING_ID);
    if (!layer) return;
    layer.remove();
  }

  async function ensureFooter() {
    await ensureScript(SCRIPT_PATHS.footer);

    if (typeof window.renderSiteFooter === 'function') {
      await window.renderSiteFooter();
      return;
    }

    if (typeof window.renderMainBody3 === 'function') {
      await window.renderMainBody3();
    }
  }

  async function renderRoute() {
    normalizeLegacyUrlIfNeeded();

    const route = getRouteFromUrl();
    clearTransientUi();

    if (!ROOT_PATHS.has(route.pathname) && route.pathname !== '/') {
      window.history.replaceState({ __app: true }, '', '/');
      return renderRoute();
    }

    if (route.view) {
      clearMainBody();
      removeSection('main-body2');

      await ensureScript(SCRIPT_PATHS.mypage);

      if (route.view === 'mypage') {
        await window.openMyPage({ fromRouter: true });
      } else if (route.view === 'edit') {
        await ensureScript(SCRIPT_PATHS.edit);
        await window.openUserEdit({ fromRouter: true });
      } else if (route.view === 'changepw') {
        await ensureScript(SCRIPT_PATHS.changepw);
        await window.openChangePw({ fromRouter: true });
      } else {
        window.history.replaceState({ __app: true }, '', '/');
        return renderRoute();
      }

      await ensureFooter();
      return;
    }

    if (route.page || route.q || route.movie_id) {
      clearMainBody();
      removeSection('main-body2');

      await ensureScript(SCRIPT_PATHS.movieMain);

      if (route.movie_id) {
        await ensureScript(SCRIPT_PATHS.movieDetail);
        await window.renderMovieDetail({ fromRouter: true });
      } else {
        await window.renderMovieMain({ fromRouter: true });
      }

      await ensureFooter();
      return;
    }

    clearMainBody();
    removeSection('main-body2');

    await ensureScript(SCRIPT_PATHS.home);
    await window.renderHomePage({ fromRouter: true });
    await ensureFooter();
  }

  function queueRender() {
    routeJob = routeJob
      .catch(() => {})
      .then(async () => {
        showRouteLoading();
        try {
          await renderRoute();
        } finally {
          hideRouteLoading();
        }
      })
      .catch((error) => {
        hideRouteLoading();
        console.error('[router] render error:', error);
      });

    return routeJob;
  }

  function navigate(route = {}, options = {}) {
    const replace = options.replace === true;
    const nextUrl = typeof route === 'string' ? route : buildUrlFromRoute(route);

    if (replace) {
      window.history.replaceState({ __app: true }, '', nextUrl);
    } else {
      window.history.pushState({ __app: true }, '', nextUrl);
    }

    return queueRender();
  }

  window.appEnsureScript = ensureScript;
  window.appGetRoute = getRouteFromUrl;
  window.appBuildUrl = buildUrlFromRoute;
  window.appNavigate = navigate;
  window.appRenderCurrentRoute = queueRender;
  window.appShowRouteLoading = showRouteLoading;
  window.appHideRouteLoading = hideRouteLoading;

  window.addEventListener('popstate', function () {
    queueRender();
  });

  window.addEventListener('resize', function () {
    const layer = document.getElementById(ROUTE_LOADING_ID);
    if (!layer) return;
    layer.style.minHeight = `${getRouteLoadingHeight()}px`;
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      queueRender();
    });
  } else {
    queueRender();
  }
})();
