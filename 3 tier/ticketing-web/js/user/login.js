(function () {
  const LOGIN_CSS_PATH = '/css/user/login.css';
  const LOGIN_STORAGE_KEY = 'loginUser';
  const REMEMBER_ID_STORAGE_KEY = 'rememberedLoginId';
  const LOGIN_EXPIRE_MINUTES = 120;
  const LOGIN_API = '/api/read/auth/login';
  const HOME_URL = '/';

  let savedScrollY = 0;
  let isLoginSubmitting = false;

  function ensureLoginCss() {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`link[href="${LOGIN_CSS_PATH}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve();
          return;
        }

        existing.addEventListener(
          'load',
          () => {
            existing.dataset.loaded = 'true';
            resolve();
          },
          { once: true }
        );
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LOGIN_CSS_PATH;

      link.addEventListener(
        'load',
        () => {
          link.dataset.loaded = 'true';
          resolve();
        },
        { once: true }
      );
      link.addEventListener('error', reject, { once: true });

      document.head.appendChild(link);
    });
  }

  function ensureScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve();
          return;
        }

        existing.addEventListener(
          'load',
          () => {
            existing.dataset.loaded = 'true';
            resolve();
          },
          { once: true }
        );
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.defer = true;

      script.addEventListener(
        'load',
        () => {
          script.dataset.loaded = 'true';
          resolve();
        },
        { once: true }
      );
      script.addEventListener('error', reject, { once: true });

      document.body.appendChild(script);
    });
  }

  function getExpireTime() {
    return Date.now() + LOGIN_EXPIRE_MINUTES * 60 * 1000;
  }

  function saveLoginUser(userData) {
    const payload = {
      ...userData,
      expiresAt: getExpireTime()
    };
    localStorage.setItem(LOGIN_STORAGE_KEY, JSON.stringify(payload));
  }

  function getLoginUser() {
    const raw = localStorage.getItem(LOGIN_STORAGE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);

      if (!parsed || typeof parsed !== 'object') {
        localStorage.removeItem(LOGIN_STORAGE_KEY);
        return null;
      }

      if (!parsed.expiresAt || Date.now() > Number(parsed.expiresAt)) {
        localStorage.removeItem(LOGIN_STORAGE_KEY);
        return null;
      }

      return parsed;
    } catch (error) {
      localStorage.removeItem(LOGIN_STORAGE_KEY);
      return null;
    }
  }

  function clearLoginUser() {
    localStorage.removeItem(LOGIN_STORAGE_KEY);
  }

  function getRememberedLoginId() {
    return localStorage.getItem(REMEMBER_ID_STORAGE_KEY) || '';
  }

  function saveRememberedLoginId(loginId) {
    localStorage.setItem(REMEMBER_ID_STORAGE_KEY, loginId);
  }

  function clearRememberedLoginId() {
    localStorage.removeItem(REMEMBER_ID_STORAGE_KEY);
  }

  function lockBodyScroll() {
    savedScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.classList.add('login-modal-open');
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }

  function unlockBodyScroll() {
    document.body.classList.remove('login-modal-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, savedScrollY);
  }

  function removeExistingModal() {
    const existing = document.getElementById('login-modal-overlay');
    if (existing) existing.remove();
  }

  function clearErrors(modal) {
    const phoneError = modal.querySelector('.login-field-error[data-error-for="phone"]');
    const pwError = modal.querySelector('.login-field-error[data-error-for="password"]');
    const commonError = modal.querySelector('.login-common-error');

    if (phoneError) phoneError.textContent = '';
    if (pwError) pwError.textContent = '';
    if (commonError) commonError.textContent = '';
  }

  function setFieldError(modal, field, message) {
    const target = modal.querySelector(`.login-field-error[data-error-for="${field}"]`);
    if (target) target.textContent = message || '';
  }

  function setCommonError(modal, message) {
    const target = modal.querySelector('.login-common-error');
    if (target) target.textContent = message || '';
  }

  function closeLoginPage() {
    const overlay = document.getElementById('login-modal-overlay');
    if (overlay) overlay.remove();
    isLoginSubmitting = false;
    unlockBodyScroll();
  }

  function redirectToHome() {
    window.location.href = HOME_URL;
  }

  function logoutUser() {
    clearLoginUser();
    closeLoginPage();

    if (typeof window.refreshSiteHeader === 'function') {
      window.refreshSiteHeader();
    }

    alert('로그아웃 되었습니다.');
    redirectToHome();
  }

  function buildModalHtml() {
    const rememberedLoginId = getRememberedLoginId();
    const isRemembered = rememberedLoginId !== '';

    const overlay = document.createElement('div');
    overlay.id = 'login-modal-overlay';
    overlay.className = 'login-modal-overlay';

    overlay.innerHTML = `
      <div class="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-modal-title">
        <button type="button" class="login-modal-close" aria-label="닫기">×</button>

        <div class="login-modal-header">
          <h2 id="login-modal-title" class="login-modal-title">LOGIN</h2>
          <p class="login-modal-subtitle">서비스 이용을 위해 로그인해 주세요.</p>
        </div>

        <form class="login-form" novalidate>
          <div class="login-form-group">
            <input
              type="text"
              name="phone"
              class="login-input"
              placeholder="전화번호"
              autocomplete="username"
              inputmode="numeric"
              maxlength="11"
              value="${rememberedLoginId}"
            />
            <div class="login-field-error" data-error-for="phone"></div>
          </div>

          <div class="login-form-group">
            <input
              type="password"
              name="password"
              class="login-input"
              placeholder="비밀번호"
              autocomplete="current-password"
            />
            <div class="login-field-error" data-error-for="password"></div>
          </div>

          <label class="login-keep-wrap">
            <input type="checkbox" name="remember_id" class="login-keep-checkbox" ${isRemembered ? 'checked' : ''} />
            <span>아이디 기억</span>
          </label>

          <div class="login-common-error"></div>

          <button type="submit" class="login-submit-button">로그인</button>

          <div class="login-modal-links">
            <button type="button" class="login-link-button" data-action="pwfind">PW 찾기</button>
            <span class="login-link-divider">|</span>
            <button type="button" class="login-link-button" data-action="signup">회원가입</button>
          </div>
        </form>
      </div>
    `;

    return overlay;
  }

  function normalizeResponse(data) {
    if (!data || typeof data !== 'object') {
      return {
        success: false,
        commonMessage: '로그인 처리 중 오류가 발생했습니다.'
      };
    }

    if (data.message === 'login success' && data.user) {
      return {
        success: true,
        user: data.user
      };
    }

    if (data.message === 'invalid input') {
      return {
        success: false,
        fieldErrors: {
          phone: '전화번호를 입력해 주세요.',
          password: '비밀번호를 입력해 주세요.'
        }
      };
    }

    if (data.message === '전화번호가 틀립니다.') {
      return {
        success: false,
        fieldErrors: {
          phone: '전화번호가 틀립니다.'
        }
      };
    }

    if (data.message === '비밀번호가 틀립니다.') {
      return {
        success: false,
        fieldErrors: {
          password: '비밀번호가 틀립니다.'
        }
      };
    }

    return {
      success: false,
      commonMessage: data.message || '서버와 통신 중 문제가 발생했습니다.'
    };
  }

  async function requestLogin(phone, password) {
    let response;

    try {
      response = await fetch(LOGIN_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: phone,
          password: password
        })
      });
    } catch (error) {
      console.error('login fetch error:', error);
      return {
        success: false,
        commonMessage: '서버와 통신 중 문제가 발생했습니다.'
      };
    }

    let data = {};
    try {
      data = await response.json();
    } catch (e) {
      data = {};
    }

    if (!response.ok && !data.message) {
      return {
        success: false,
        commonMessage: `서버 오류 (${response.status})`
      };
    }

    return normalizeResponse(data);
  }

  async function openPwFindPage() {
    try {
      await ensureScript('/js/user/pwfind.js');
      closeLoginPage();

      if (typeof window.openPwFindPage === 'function') {
        window.openPwFindPage();
        return;
      }

      alert('PW 찾기 화면을 불러오지 못했습니다.');
    } catch (error) {
      console.error('pwfind.js load error:', error);
      alert('PW 찾기 화면을 불러오지 못했습니다.');
    }
  }

  async function openSignupPage() {
    try {
      await ensureScript('/js/user/signup.js');
      closeLoginPage();

      if (typeof window.openSignupPage === 'function') {
        window.openSignupPage();
        return;
      }

      alert('회원가입 화면을 불러오지 못했습니다.');
    } catch (error) {
      console.error('signup.js load error:', error);
      alert('회원가입 화면을 불러오지 못했습니다.');
    }
  }

  function bindModalEvents(overlay) {
    const closeButton = overlay.querySelector('.login-modal-close');
    const form = overlay.querySelector('.login-form');
    const phoneInput = overlay.querySelector('input[name="phone"]');
    const pwInput = overlay.querySelector('input[name="password"]');
    const rememberIdInput = overlay.querySelector('input[name="remember_id"]');
    const linkButtons = overlay.querySelectorAll('.login-link-button');
    const submitButton = form.querySelector('.login-submit-button');

    closeButton.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      closeLoginPage();
    });

    phoneInput.addEventListener('input', function () {
      phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 11);
      setFieldError(overlay, 'phone', '');
      setCommonError(overlay, '');
    });

    pwInput.addEventListener('input', function () {
      setFieldError(overlay, 'password', '');
      setCommonError(overlay, '');
    });

    linkButtons.forEach(button => {
      button.addEventListener('click', function () {
        const action = button.dataset.action;

        if (action === 'pwfind') {
          openPwFindPage();
          return;
        }

        if (action === 'signup') {
          openSignupPage();
        }
      });
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      if (isLoginSubmitting) {
        return;
      }

      clearErrors(overlay);

      const phone = phoneInput.value.trim();
      const password = pwInput.value;
      const rememberId = rememberIdInput.checked;

      let hasError = false;

      if (!phone) {
        setFieldError(overlay, 'phone', '전화번호를 입력해 주세요.');
        hasError = true;
      }

      if (!password) {
        setFieldError(overlay, 'password', '비밀번호를 입력해 주세요.');
        hasError = true;
      }

      if (hasError) return;

      isLoginSubmitting = true;
      submitButton.disabled = true;
      submitButton.textContent = '로그인 중...';

      try {
        const result = await requestLogin(phone, password);

        if (!result.success) {
          if (result.fieldErrors?.phone) {
            setFieldError(overlay, 'phone', result.fieldErrors.phone);
          }

          if (result.fieldErrors?.password) {
            setFieldError(overlay, 'password', result.fieldErrors.password);
          }

          if (result.commonMessage) {
            setCommonError(overlay, result.commonMessage);
          }

          return;
        }

        if (rememberId) {
          saveRememberedLoginId(phone);
        } else {
          clearRememberedLoginId();
        }

        saveLoginUser(result.user);
        closeLoginPage();

        if (typeof window.refreshSiteHeader === 'function') {
          window.refreshSiteHeader();
        }
      } catch (error) {
        console.error('login error:', error);
        setCommonError(overlay, '서버와 통신 중 문제가 발생했습니다.');
      } finally {
        isLoginSubmitting = false;
        submitButton.disabled = false;
        submitButton.textContent = '로그인';
      }
    });
  }

  async function openLoginPage() {
    removeExistingModal();
    isLoginSubmitting = false;

    try {
      await ensureLoginCss();
    } catch (error) {
      console.error('login css load error:', error);
    }

    const overlay = buildModalHtml();
    lockBodyScroll();
    document.body.appendChild(overlay);

    bindModalEvents(overlay);

    const firstInput = overlay.querySelector('input[name="phone"]');
    if (firstInput) {
      requestAnimationFrame(() => firstInput.focus());
    }
  }

  window.openLoginPage = openLoginPage;
  window.closeLoginPage = closeLoginPage;
  window.getLoginUser = getLoginUser;
  window.clearLoginUser = clearLoginUser;
  window.logoutUser = logoutUser;
})();