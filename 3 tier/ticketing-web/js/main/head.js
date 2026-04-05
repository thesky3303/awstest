(function () {
  const HEADER_CSS_PATH = '/css/main/head.css';
  const LOGO_PATH = '/images/logo.png';
  const LOGIN_STORAGE_KEY = 'loginUser';

  function ensureHeadCss() {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`link[href="${HEADER_CSS_PATH}"]`);

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
          reject(new Error('head.css load fail'));
        }, { once: true });

        return;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = HEADER_CSS_PATH;

      link.addEventListener('load', () => {
        link.dataset.loaded = 'true';
        resolve();
      }, { once: true });

      link.addEventListener('error', () => {
        reject(new Error('head.css load fail'));
      }, { once: true });

      document.head.appendChild(link);
    });
  }

  function getLoginUser() {
    try {
      const raw = localStorage.getItem(LOGIN_STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        localStorage.removeItem(LOGIN_STORAGE_KEY);
        return null;
      }

      if (parsed.expiresAt && Date.now() > Number(parsed.expiresAt)) {
        localStorage.removeItem(LOGIN_STORAGE_KEY);
        return null;
      }

      return parsed;
    } catch (e) {
      console.error('loginUser parse error:', e);
      localStorage.removeItem(LOGIN_STORAGE_KEY);
      return null;
    }
  }

  function callExternalHandler(scriptPath, functionName) {
    const fn = window[functionName];
    if (typeof fn === 'function') {
      fn();
      return;
    }

    const alreadyLoaded = Array.from(document.scripts).some(
      (script) => script.src && script.src.includes(scriptPath)
    );

    if (alreadyLoaded) {
      if (typeof window[functionName] === 'function') {
        window[functionName]();
      }
      return;
    }

    const script = document.createElement('script');
    script.src = scriptPath;
    script.onload = function () {
      if (typeof window[functionName] === 'function') {
        window[functionName]();
      }
    };
    document.body.appendChild(script);
  }

  function navigateHome(e) {
    if (e) e.preventDefault();

    if (typeof window.appNavigate === 'function') {
      window.appNavigate({}, { replace: false });
      return;
    }

    window.location.href = '/';
  }

  function openLogin(e) {
    if (e) e.preventDefault();
    callExternalHandler('/js/user/login.js', 'openLoginPage');
  }

  function openMyPage(e) {
    if (e) e.preventDefault();

    if (typeof window.appNavigate === 'function') {
      window.appNavigate({ view: 'mypage' });
      return;
    }

    callExternalHandler('/js/user/mypage.js', 'openMyPage');
  }

  function openMoviePage(e) {
    if (e) {
      e.preventDefault();
    }

    if (typeof window.appNavigate === 'function') {
      window.appNavigate({ page: 1 });
      return;
    }

    callExternalHandler('/js/movie/movie_main.js', 'renderMovieMain');
  }

  function logout() {
    localStorage.removeItem(LOGIN_STORAGE_KEY);

    if (typeof window.closeLoginPage === 'function') {
      window.closeLoginPage();
    }

    mountHeader();
    alert('로그아웃 되었습니다.');
    window.location.href = '/';
  }

  function createAuthArea(user) {
    const wrapper = document.createElement('div');
    wrapper.className = 'site-header-auth';

    if (user) {
      const topRow = document.createElement('div');
      topRow.className = 'site-header-auth-top-row';

      const nameButton = document.createElement('button');
      nameButton.type = 'button';
      nameButton.className = 'site-header-auth-name';
      nameButton.textContent = `${user.name || user.user_name || '회원'}님`;
      nameButton.addEventListener('click', openMyPage);

      const divider = document.createElement('span');
      divider.className = 'site-header-auth-divider';
      divider.textContent = '|';

      const logoutButton = document.createElement('button');
      logoutButton.type = 'button';
      logoutButton.className = 'site-header-logout-button';
      logoutButton.textContent = '로그아웃';
      logoutButton.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        logout();
      });

      topRow.appendChild(nameButton);
      topRow.appendChild(divider);
      topRow.appendChild(logoutButton);

      wrapper.appendChild(topRow);
      return wrapper;
    }

    const loginButton = document.createElement('button');
    loginButton.type = 'button';
    loginButton.className = 'site-header-login-button';
    loginButton.textContent = '로그인';
    loginButton.addEventListener('click', openLogin);

    wrapper.appendChild(loginButton);
    return wrapper;
  }

  function createMenu() {
    const nav = document.createElement('nav');
    nav.className = 'site-header-nav';
    nav.setAttribute('aria-label', '메인 메뉴');

    const menuItems = [
      { label: '예매', href: '#' },
      { label: '영화', href: '#', onClick: openMoviePage },
      { label: '영화관', href: '#' },
      { label: '공지사항', href: '#' },
      { label: '고객센터', href: '#' }
    ];

    menuItems.forEach((item) => {
      const a = document.createElement('a');
      a.href = item.href;
      a.className = 'site-header-menu-item';
      a.textContent = item.label;

      if (typeof item.onClick === 'function') {
        a.addEventListener('click', item.onClick);
      }

      nav.appendChild(a);
    });

    return nav;
  }

  function createHeader() {
    const user = getLoginUser();

    const header = document.createElement('header');
    header.className = 'site-header';

    const top = document.createElement('div');
    top.className = 'site-header-top';

    const left = document.createElement('div');
    left.className = 'site-header-top-side';

    const center = document.createElement('div');
    center.className = 'site-header-logo-wrap';

    const logoLink = document.createElement('a');
    logoLink.href = '/';
    logoLink.className = 'site-header-logo-link';
    logoLink.setAttribute('aria-label', '홈으로 이동');
    logoLink.addEventListener('click', navigateHome);

    const logoImg = document.createElement('img');
    logoImg.src = LOGO_PATH;
    logoImg.alt = '로고';
    logoImg.className = 'site-header-logo';

    logoLink.appendChild(logoImg);
    center.appendChild(logoLink);

    const right = document.createElement('div');
    right.className = 'site-header-top-side site-header-top-side-right';
    right.appendChild(createAuthArea(user));

    top.appendChild(left);
    top.appendChild(center);
    top.appendChild(right);

    const divider = document.createElement('div');
    divider.className = 'site-header-divider';

    const menu = createMenu();

    header.appendChild(top);
    header.appendChild(divider);
    header.appendChild(menu);

    return header;
  }

  async function mountHeader() {
    try {
      await ensureHeadCss();
    } catch (error) {
      console.error(error);
    }

    const existing = document.getElementById('site-header');
    const header = createHeader();

    if (existing) {
      existing.innerHTML = '';
      existing.appendChild(header);
      existing.style.visibility = 'visible';
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.id = 'site-header';
    wrapper.style.visibility = 'visible';
    wrapper.appendChild(header);

    document.body.prepend(wrapper);
  }

  window.renderSiteHeader = mountHeader;
  window.refreshSiteHeader = mountHeader;
  window.logoutUser = logout;
  window.openMoviePage = openMoviePage;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountHeader);
  } else {
    mountHeader();
  }
})();
