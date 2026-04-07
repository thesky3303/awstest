(function () {
  window.APP_CONFIG = window.APP_CONFIG || {};
  window.APP_RUNTIME = window.APP_RUNTIME || {};

  const runtime = window.APP_RUNTIME;
  const currentImage = window.APP_CONFIG.image || {};

  const stylePromiseMap = runtime.__stylePromiseMap || new Map();
  const scriptPromiseMap = runtime.__scriptPromiseMap || new Map();
  const prefetchedScriptSet = runtime.__prefetchedScriptSet || new Set();
  const modalState = runtime.__modalState || { savedScrollY: 0, locked: false };

  runtime.__stylePromiseMap = stylePromiseMap;
  runtime.__scriptPromiseMap = scriptPromiseMap;
  runtime.__prefetchedScriptSet = prefetchedScriptSet;
  runtime.__modalState = modalState;

  runtime.constants = {
    loginStorageKey: 'loginUser',
    rememberedLoginIdKey: 'rememberedLoginId',
    defaultLoginExpireMinutes: 120
  };

  window.APP_CONFIG.image = {
    baseUrl: currentImage.baseUrl || '/images/',
    rewriteRootRelativePaths:
      typeof currentImage.rewriteRootRelativePaths === 'boolean'
        ? currentImage.rewriteRootRelativePaths
        : false,
    localPrefixMode: currentImage.localPrefixMode || 'filename',
    localPrefixes:
      Array.isArray(currentImage.localPrefixes) && currentImage.localPrefixes.length
        ? currentImage.localPrefixes
        : ['/mnt/hgfs/', '/mnt/data/'],
    manifest: currentImage.manifest || {},
    keepAbsoluteUrls:
      typeof currentImage.keepAbsoluteUrls === 'boolean'
        ? currentImage.keepAbsoluteUrls
        : true,
    fallbackImageUrl: currentImage.fallbackImageUrl || '/images/no-image.png'
  };

  function buildUrl(baseUrl, query) {
    const url = new URL(baseUrl, window.location.origin);
    const params = query || {};

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });

    return url.toString();
  }

  function ensureStyle(href) {
    if (!href) return Promise.resolve(null);
    if (stylePromiseMap.has(href)) return stylePromiseMap.get(href);

    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`link[href="${href}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true' || existing.sheet) {
          existing.dataset.loaded = 'true';
          resolve(existing);
          return;
        }

        existing.addEventListener('load', () => {
          existing.dataset.loaded = 'true';
          resolve(existing);
        }, { once: true });

        existing.addEventListener('error', () => {
          stylePromiseMap.delete(href);
          reject(new Error(`style load fail: ${href}`));
        }, { once: true });
        return;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;

      link.addEventListener('load', () => {
        link.dataset.loaded = 'true';
        resolve(link);
      }, { once: true });

      link.addEventListener('error', () => {
        stylePromiseMap.delete(href);
        reject(new Error(`style load fail: ${href}`));
      }, { once: true });

      document.head.appendChild(link);
    });

    stylePromiseMap.set(href, promise);
    return promise;
  }

  function ensureScript(src) {
    if (!src) return Promise.resolve(null);
    if (scriptPromiseMap.has(src)) return scriptPromiseMap.get(src);

    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve(existing);
          return;
        }

        existing.addEventListener('load', () => {
          existing.dataset.loaded = 'true';
          resolve(existing);
        }, { once: true });

        existing.addEventListener('error', () => {
          scriptPromiseMap.delete(src);
          reject(new Error(`script load fail: ${src}`));
        }, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.defer = true;

      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve(script);
      }, { once: true });

      script.addEventListener('error', () => {
        scriptPromiseMap.delete(src);
        reject(new Error(`script load fail: ${src}`));
      }, { once: true });

      document.body.appendChild(script);
    });

    scriptPromiseMap.set(src, promise);
    return promise;
  }

  function prefetchScript(src) {
    if (!src) return;
    if (prefetchedScriptSet.has(src)) return;
    if (document.querySelector(`script[src="${src}"]`)) {
      prefetchedScriptSet.add(src);
      return;
    }
    if (document.querySelector(`link[rel="prefetch"][href="${src}"]`)) {
      prefetchedScriptSet.add(src);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = src;
    link.as = 'script';
    link.addEventListener('error', () => link.remove(), { once: true });
    document.head.appendChild(link);
    prefetchedScriptSet.add(src);
  }

  function prefetchScripts(sources) {
    if (!Array.isArray(sources)) return;
    sources.forEach(prefetchScript);
  }

  function readStorageJson(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.error(`[storage] parse error: ${key}`, error);
      localStorage.removeItem(key);
      return null;
    }
  }

  function getLoginUser() {
    const key = runtime.constants.loginStorageKey;
    const parsed = readStorageJson(key);
    if (!parsed || typeof parsed !== 'object') {
      localStorage.removeItem(key);
      return null;
    }

    if (parsed.expiresAt && Date.now() > Number(parsed.expiresAt)) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed;
  }

  function setStoredUserId(userId) {
    if (!userId) return;
    localStorage.setItem('user_id', String(userId));
  }

  function getStoredUserId() {
    const directUserId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
    if (directUserId) return String(directUserId);

    const loginUser = getLoginUser();
    if (loginUser && loginUser.user_id) {
      return String(loginUser.user_id);
    }

    return '';
  }

  function setLoginUser(userData, options) {
    const opts = options || {};
    const current = getLoginUser() || {};
    const expiresAt = opts.preserveExpires && current.expiresAt
      ? current.expiresAt
      : Date.now() + (Number(opts.expiresInMinutes || runtime.constants.defaultLoginExpireMinutes) * 60 * 1000);

    const payload = {
      ...userData,
      expiresAt
    };

    localStorage.setItem(runtime.constants.loginStorageKey, JSON.stringify(payload));
    if (payload.user_id) {
      setStoredUserId(payload.user_id);
    }
    return payload;
  }

  function patchLoginUser(nextFields, options) {
    const current = getLoginUser() || {};
    return setLoginUser({ ...current, ...(nextFields || {}) }, {
      preserveExpires: true,
      ...(options || {})
    });
  }

  function clearLoginUser() {
    localStorage.removeItem(runtime.constants.loginStorageKey);
    localStorage.removeItem('user_id');
    sessionStorage.removeItem('user_id');
  }

  function getRememberedLoginId() {
    return localStorage.getItem(runtime.constants.rememberedLoginIdKey) || '';
  }

  function saveRememberedLoginId(value) {
    localStorage.setItem(runtime.constants.rememberedLoginIdKey, String(value || ''));
  }

  function clearRememberedLoginId() {
    localStorage.removeItem(runtime.constants.rememberedLoginIdKey);
  }

  function ensureMainBody() {
    let mainBody = document.getElementById('main-body');
    if (mainBody) return mainBody;

    mainBody = document.createElement('div');
    mainBody.id = 'main-body';

    const siteHeader = document.getElementById('site-header');
    if (siteHeader && siteHeader.parentNode) {
      if (siteHeader.nextSibling) {
        siteHeader.parentNode.insertBefore(mainBody, siteHeader.nextSibling);
      } else {
        siteHeader.parentNode.appendChild(mainBody);
      }
      return mainBody;
    }

    document.body.appendChild(mainBody);
    return mainBody;
  }

  function clearMainBody() {
    const mainBody = ensureMainBody();
    mainBody.innerHTML = '';
    mainBody.style.display = '';
    return mainBody;
  }

  function removeNodeById(id) {
    const node = document.getElementById(id);
    if (node) node.remove();
  }

  function resetPrimarySections() {
    clearMainBody();
    removeNodeById('main-body2');
  }

  function lockBodyScroll() {
    if (modalState.locked) return;
    modalState.savedScrollY = window.scrollY || window.pageYOffset || 0;
    modalState.locked = true;

    document.body.classList.add('login-modal-open');
    document.body.style.position = 'fixed';
    document.body.style.top = `-${modalState.savedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }

  function unlockBodyScroll() {
    if (!modalState.locked) return;
    modalState.locked = false;

    document.body.classList.remove('login-modal-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, modalState.savedScrollY || 0);
  }

  function clearTransientUi() {
    removeNodeById('login-modal-overlay');
    removeNodeById('main-video-modal');
    removeNodeById('theaters-booking-detail-overlay');
    removeNodeById('theaters-booking-calendar-overlay');
    document.body.classList.remove('login-modal-open');
    document.body.classList.remove('main-video-modal-open');
    document.body.classList.remove('theaters-booking-modal-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    modalState.locked = false;
    modalState.savedScrollY = 0;
  }

  async function requestJson(url, options) {
    const opts = options || {};
    const method = opts.method || 'GET';
    const headers = {
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    };

    const requestUrl = opts.query ? buildUrl(url, opts.query) : new URL(url, window.location.origin).toString();
    const fetchOptions = {
      method,
      credentials: opts.credentials || 'include',
      cache: opts.cache || 'default',
      headers
    };

    if (opts.body !== undefined && opts.body !== null) {
      fetchOptions.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    }

    let response;
    try {
      response = await fetch(requestUrl, fetchOptions);
    } catch (error) {
      const networkError = new Error('서버에 연결할 수 없습니다.');
      networkError.cause = error;
      throw networkError;
    }

    let data = null;
    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    if (!response.ok) {
      const message = data && typeof data === 'object' && data.message
        ? data.message
        : `HTTP ${response.status}`;
      const httpError = new Error(message);
      httpError.status = response.status;
      httpError.data = data;
      throw httpError;
    }

    return data;
  }

  function getJson(url, options) {
    return requestJson(url, { method: 'GET', ...(options || {}) });
  }

  function postJson(url, body, options) {
    return requestJson(url, { method: 'POST', body, ...(options || {}) });
  }

  runtime.buildUrl = buildUrl;
  runtime.ensureStyle = ensureStyle;
  runtime.ensureScript = ensureScript;
  runtime.prefetchScript = prefetchScript;
  runtime.prefetchScripts = prefetchScripts;
  runtime.getLoginUser = getLoginUser;
  runtime.setLoginUser = setLoginUser;
  runtime.patchLoginUser = patchLoginUser;
  runtime.clearLoginUser = clearLoginUser;
  runtime.getStoredUserId = getStoredUserId;
  runtime.setStoredUserId = setStoredUserId;
  runtime.getRememberedLoginId = getRememberedLoginId;
  runtime.saveRememberedLoginId = saveRememberedLoginId;
  runtime.clearRememberedLoginId = clearRememberedLoginId;
  runtime.ensureMainBody = ensureMainBody;
  runtime.clearMainBody = clearMainBody;
  runtime.removeNodeById = removeNodeById;
  runtime.resetPrimarySections = resetPrimarySections;
  runtime.lockBodyScroll = lockBodyScroll;
  runtime.unlockBodyScroll = unlockBodyScroll;
  runtime.clearTransientUi = clearTransientUi;
  runtime.requestJson = requestJson;
  runtime.getJson = getJson;
  runtime.postJson = postJson;

  window.TICKETING_READ_CACHE_CHANNEL = window.TICKETING_READ_CACHE_CHANNEL || 'ticketing-cache';

  function notifyReadCacheRebuilt() {
    window.dispatchEvent(new CustomEvent('ticketing-cache-rebuilt'));
    try {
      const bc = new BroadcastChannel(window.TICKETING_READ_CACHE_CHANNEL);
      bc.postMessage({ type: 'rebuilt', t: Date.now() });
      bc.close();
    } catch (error) {
      /* BroadcastChannel unavailable */
    }
  }

  runtime.notifyReadCacheRebuilt = notifyReadCacheRebuilt;
})();
