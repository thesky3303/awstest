(function () {
  const LOGIN_CSS_PATH = '/css/user/login.css';
  const LOGIN_STORAGE_KEY = 'loginUser';
  const LOGIN_EXPIRE_MINUTES = 120;
  const LOGIN_API_URL = '/user/login';

  let savedScrollY = 0;

  function ensureLoginCss() {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`link[href="${LOGIN_CSS_PATH}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve();
          return;
        }

        existing.addEventListener('load', () => {
          existing.dataset.loaded = 'true';
          resolve();
        }, { once: true });

        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LOGIN_CSS_PATH;

      link.addEventListener('load', () => {
        link.dataset.loaded = 'true';
        resolve();
      }, { once: true });

      link.addEventListener('error', reject, { once: true });

      document.head.appendChild(link);
    });
  }

  function getExpireTime(keepLogin) {
    if (keepLogin) {
      return Date.now() + 7 * 24 * 60 * 60 * 1000;
    }
    return Date.now() + LOGIN_EXPIRE_MINUTES * 60 * 1000;
  }

  function saveLoginUser(userData, keepLogin) {
    const payload = {
      ...userData,
      expiresAt: getExpireTime(keepLogin)
    };
    localStorage.setItem(LOGIN_STORAGE_KEY, JSON.stringify(payload));
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
    const idError = modal.querySelector('.login-field-error[data-error-for="login_id"]');
    const pwError = modal.querySelector('.login-field-error[data-error-for="password"]');
    const commonError = modal.querySelector('.login-common-error');

    if (idError) idError.textContent = '';
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
    unlockBodyScroll();
  }

  function moveToUserPage(path) {
    closeLoginPage();
    window.location.href = path;
  }

  function buildModalHtml() {
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
              name="login_id"
              class="login-input"
              placeholder="아이디"
              autocomplete="username"
            />
            <div class="login-field-error" data-error-for="login_id"></div>
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
            <input type="checkbox" name="keep_login" class="login-keep-checkbox" />
            <span>로그인 유지</span>
          </label>

          <div class="login-common-error"></div>

          <button type="submit" class="login-submit-button">로그인</button>

          <div class="login-modal-links">
            <button type="button" class="login-link-button" data-route="/user/find-id">ID 찾기</button>
            <span class="login-link-divider">|</span>
            <button type="button" class="login-link-button" data-route="/user/find-password">PW 찾기</button>
            <span class="login-link-divider">|</span>
            <button type="button" class="login-link-button" data-route="/user/signup">회원가입</button>
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

    if (data.success === true || data.result === 'OK') {
      return {
        success: true,
        user: data.user || data.data || {
          user_id: data.user_id,
          login_id: data.login_id,
          name: data.name,
          user_name: data.user_name
        }
      };
    }

    if (data.fieldErrors) {
      return {
        success: false,
        fieldErrors: data.fieldErrors,
        commonMessage: data.message || ''
      };
    }

    if (data.code === 'INVALID_ID') {
      return {
        success: false,
        fieldErrors: {
          login_id: data.message || '아이디가 틀렸습니다.'
        }
      };
    }

    if (data.code === 'INVALID_PASSWORD') {
      return {
        success: false,
        fieldErrors: {
          password: data.message || '비밀번호가 틀렸습니다.'
        }
      };
    }

    return {
      success: false,
      commonMessage: data.message || '아이디 또는 비밀번호를 확인해 주세요.'
    };
  }

  async function requestLogin(loginId, password) {
    const response = await fetch(LOGIN_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        login_id: loginId,
        password: password
      })
    });

    let data = null;
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }

    if (!response.ok) {
      return normalizeResponse(data || {
        success: false,
        message: '서버와 통신 중 문제가 발생했습니다.'
      });
    }

    return normalizeResponse(data);
  }

  function bindModalEvents(overlay) {
    const modal = overlay.querySelector('.login-modal');
    const closeButton = overlay.querySelector('.login-modal-close');
    const form = overlay.querySelector('.login-form');
    const idInput = overlay.querySelector('input[name="login_id"]');
    const pwInput = overlay.querySelector('input[name="password"]');
    const keepLoginInput = overlay.querySelector('input[name="keep_login"]');
    const linkButtons = overlay.querySelectorAll('.login-link-button');

    closeButton.addEventListener('click', closeLoginPage);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        closeLoginPage();
      }
    });

    document.addEventListener('keydown', function escHandler(e) {
      const currentOverlay = document.getElementById('login-modal-overlay');
      if (!currentOverlay) {
        document.removeEventListener('keydown', escHandler);
        return;
      }

      if (e.key === 'Escape') {
        closeLoginPage();
      }
    });

    idInput.addEventListener('input', function () {
      setFieldError(modal, 'login_id', '');
      setCommonError(modal, '');
    });

    pwInput.addEventListener('input', function () {
      setFieldError(modal, 'password', '');
      setCommonError(modal, '');
    });

    linkButtons.forEach(button => {
      button.addEventListener('click', function () {
        const route = button.dataset.route;
        if (!route) return;
        moveToUserPage(route);
      });
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearErrors(modal);

      const loginId = idInput.value.trim();
      const password = pwInput.value.trim();
      const keepLogin = keepLoginInput.checked;
      const submitButton = form.querySelector('.login-submit-button');

      let hasError = false;

      if (!loginId) {
        setFieldError(modal, 'login_id', '아이디를 입력해 주세요.');
        hasError = true;
      }

      if (!password) {
        setFieldError(modal, 'password', '비밀번호를 입력해 주세요.');
        hasError = true;
      }

      if (hasError) return;

      submitButton.disabled = true;
      submitButton.textContent = '로그인 중...';

      try {
        const result = await requestLogin(loginId, password);

        if (!result.success) {
          if (result.fieldErrors?.login_id) {
            setFieldError(modal, 'login_id', result.fieldErrors.login_id);
          }

          if (result.fieldErrors?.password) {
            setFieldError(modal, 'password', result.fieldErrors.password);
          }

          if (result.commonMessage) {
            setCommonError(modal, result.commonMessage);
          }

          if (!result.fieldErrors?.login_id && !result.fieldErrors?.password && !result.commonMessage) {
            setCommonError(modal, '아이디 또는 비밀번호를 확인해 주세요.');
          }

          return;
        }

        saveLoginUser(result.user || {
          login_id: loginId,
          name: '회원'
        }, keepLogin);

        closeLoginPage();

        if (typeof window.refreshSiteHeader === 'function') {
          window.refreshSiteHeader();
        }
      } catch (error) {
        console.error('login error:', error);
        setCommonError(modal, '서버와 통신 중 문제가 발생했습니다.');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = '로그인';
      }
    });
  }

  async function openLoginPage() {
    removeExistingModal();

    try {
      await ensureLoginCss();
    } catch (error) {
      console.error('login css load error:', error);
    }

    const overlay = buildModalHtml();
    lockBodyScroll();
    document.body.appendChild(overlay);

    bindModalEvents(overlay);

    const firstInput = overlay.querySelector('input[name="login_id"]');
    if (firstInput) {
      requestAnimationFrame(() => firstInput.focus());
    }
  }

  window.openLoginPage = openLoginPage;
  window.closeLoginPage = closeLoginPage;
})();