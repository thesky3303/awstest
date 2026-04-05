(function () {
  const LOGIN_CSS_PATH = '/css/user/login.css';
  const SIGNUP_CSS_PATH = '/css/user/signup.css';

  const CHECK_PHONE_API = '/api/read/auth/check-phone';
  const SIGNUP_API = '/api/write/auth/signup';

  let savedScrollY = 0;

  function ensureCss(href) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`link[href="${href}"]`);

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
      link.href = href;

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

  function closeSignupPage() {
    const overlay = document.getElementById('login-modal-overlay');
    if (overlay) overlay.remove();
    unlockBodyScroll();
  }

  function goToLoginPage() {
    closeSignupPage();

    if (typeof window.openLoginPage === 'function') {
      window.openLoginPage();
      return true;
    }

    alert('로그인 화면을 불러오지 못했습니다.');
    return false;
  }

  function setFieldError(modal, field, message) {
    const target = modal.querySelector(`[data-error-for="${field}"]`);
    if (target) target.textContent = message || '';
  }

  function setCommonError(modal, message) {
    const target = modal.querySelector('.signup-common-error');
    if (target) target.textContent = message || '';
  }

  function clearErrors(modal) {
    modal.querySelectorAll('.signup-field-error').forEach(node => {
      node.textContent = '';
    });

    const commonError = modal.querySelector('.signup-common-error');
    if (commonError) commonError.textContent = '';
  }

  function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function sanitizeName(value) {
    return String(value || '').replace(/[^가-힣a-zA-Z\s]/g, '');
  }

  function isValidPhone(phone) {
    return /^01[016789]\d{7,8}$/.test(String(phone || '').trim());
  }

  function isValidName(name) {
    return /^[가-힣a-zA-Z\s]{2,20}$/.test(String(name || '').trim());
  }

  function isValidPassword(password) {
    return String(password || '').trim().length >= 4;
  }

  async function postJson(url, payload) {
    let response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (networkError) {
      return {
        success: false,
        networkError: true,
        message: '서버에 연결할 수 없습니다.'
      };
    }

    let data = {};
    try {
      data = await response.json();
    } catch (parseError) {
      data = {};
    }

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: data.message || `서버 오류 (${response.status})`
      };
    }

    return data;
  }

  function buildSignupHtml() {
    const overlay = document.createElement('div');
    overlay.id = 'login-modal-overlay';
    overlay.className = 'login-modal-overlay';

    overlay.innerHTML = `
      <div class="login-modal signup-modal" role="dialog" aria-modal="true" aria-labelledby="signup-modal-title">
        <button type="button" class="login-modal-close" aria-label="닫기">×</button>

        <div class="login-modal-header signup-header">
          <h2 id="signup-modal-title" class="login-modal-title">회원가입</h2>
          <p class="login-modal-subtitle">회원 정보를 입력해 주세요.</p>
        </div>

        <form class="signup-form" novalidate>
          <div class="signup-form-group">
            <input
              type="text"
              name="phone"
              class="login-input signup-input"
              placeholder="핸드폰번호"
              inputmode="numeric"
              maxlength="11"
            />
            <div class="signup-field-error" data-error-for="phone"></div>
          </div>

          <div class="signup-form-group">
            <input
              type="password"
              name="password"
              class="login-input signup-input"
              placeholder="비밀번호"
              autocomplete="new-password"
            />
            <div class="signup-field-error" data-error-for="password"></div>
          </div>

          <div class="signup-form-group">
            <input
              type="text"
              name="name"
              class="login-input signup-input"
              placeholder="이름"
              maxlength="20"
            />
            <div class="signup-field-error" data-error-for="name"></div>
          </div>

          <div class="signup-common-error"></div>

          <div class="signup-button-row">
            <button type="submit" class="login-submit-button signup-submit-button">가입</button>
            <button type="button" class="signup-cancel-button">취소</button>
          </div>
        </form>
      </div>
    `;

    return overlay;
  }

  async function requestPhoneDuplicate(phone) {
    const result = await postJson(CHECK_PHONE_API, { phone });

    if (result.networkError) {
      return {
        success: false,
        networkError: true,
        duplicated: false,
        message: result.message
      };
    }

    const duplicated =
      result.duplicated === true ||
      result.duplicate === true ||
      result.exists === true ||
      result.found === true ||
      Number(result.count || 0) > 0;

    return {
      success: result.success !== false,
      duplicated,
      message: result.message || ''
    };
  }

  async function requestSignup(phone, password, name) {
    return await postJson(SIGNUP_API, {
      phone,
      password,
      name
    });
  }

  function bindEvents(overlay) {
    const closeButton = overlay.querySelector('.login-modal-close');
    const cancelButton = overlay.querySelector('.signup-cancel-button');
    const form = overlay.querySelector('.signup-form');
    const phoneInput = form.querySelector('input[name="phone"]');
    const passwordInput = form.querySelector('input[name="password"]');
    const nameInput = form.querySelector('input[name="name"]');
    const submitButton = form.querySelector('.signup-submit-button');

    let isComposingName = false;

    async function validatePhoneDuplicate() {
      const phone = phoneInput.value.trim();

      if (!phone) return '핸드폰번호를 입력하세요.';
      if (!isValidPhone(phone)) return '핸드폰번호를 확인하세요.';

      const result = await requestPhoneDuplicate(phone);

      if (result.networkError) {
        return result.message || '중복 확인 중 오류가 발생했습니다.';
      }

      if (result.duplicated) {
        return '이미 가입된 핸드폰번호입니다.';
      }

      return '';
    }

    closeButton.addEventListener('click', function (e) {
      e.preventDefault();
      closeSignupPage();
    });

    cancelButton.addEventListener('click', function (e) {
      e.preventDefault();
      goToLoginPage();
    });

    phoneInput.addEventListener('input', function () {
      phoneInput.value = onlyDigits(phoneInput.value).slice(0, 11);
      setFieldError(overlay, 'phone', '');
      setCommonError(overlay, '');
    });

    passwordInput.addEventListener('input', function () {
      setFieldError(overlay, 'password', '');
      setCommonError(overlay, '');
    });

    nameInput.addEventListener('compositionstart', function () {
      isComposingName = true;
    });

    nameInput.addEventListener('compositionend', function () {
      isComposingName = false;
      nameInput.value = sanitizeName(nameInput.value).slice(0, 20);
      setFieldError(overlay, 'name', '');
      setCommonError(overlay, '');
    });

    nameInput.addEventListener('input', function () {
      if (isComposingName) return;
      nameInput.value = sanitizeName(nameInput.value).slice(0, 20);
      setFieldError(overlay, 'name', '');
      setCommonError(overlay, '');
    });

    nameInput.addEventListener('blur', function () {
      nameInput.value = sanitizeName(nameInput.value).slice(0, 20);
      const name = nameInput.value.trim();
      if (!name) return;

      if (!isValidName(name)) {
        setFieldError(overlay, 'name', '이름을 확인하세요.');
      } else {
        setFieldError(overlay, 'name', '');
      }
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearErrors(overlay);

      phoneInput.value = onlyDigits(phoneInput.value).slice(0, 11);
      nameInput.value = sanitizeName(nameInput.value).slice(0, 20);

      const phone = phoneInput.value.trim();
      const password = passwordInput.value;
      const name = nameInput.value.trim();

      let hasError = false;

      const phoneDuplicateError = await validatePhoneDuplicate();
      if (phoneDuplicateError) {
        setFieldError(overlay, 'phone', phoneDuplicateError);
        hasError = true;
      }

      if (!isValidPassword(password)) {
        setFieldError(overlay, 'password', '비밀번호는 최소 4자리입니다.');
        hasError = true;
      }

      if (!isValidName(name)) {
        setFieldError(overlay, 'name', '이름을 확인하세요.');
        hasError = true;
      }

      if (hasError) return;

      submitButton.disabled = true;
      submitButton.textContent = '가입 중...';

      try {
        const result = await requestSignup(phone, password, name);

        if (!result.success) {
          setCommonError(overlay, result.message || '회원가입에 실패했습니다.');
          submitButton.disabled = false;
          submitButton.textContent = '가입';
          return;
        }

        submitButton.disabled = false;
        submitButton.textContent = '가입';

        alert('회원가입이 완료되었습니다.');
        goToLoginPage();
      } catch (error) {
        console.error('signup error:', error);
        setCommonError(overlay, `회원가입 처리 중 오류: ${error.message || '알 수 없는 오류'}`);
        submitButton.disabled = false;
        submitButton.textContent = '가입';
      }
    });
  }

  async function openSignupPage() {
    removeExistingModal();

    try {
      await Promise.all([ensureCss(LOGIN_CSS_PATH), ensureCss(SIGNUP_CSS_PATH)]);
    } catch (error) {
      console.error('signup css load error:', error);
    }

    const overlay = buildSignupHtml();
    lockBodyScroll();
    document.body.appendChild(overlay);
    bindEvents(overlay);

    const firstInput = overlay.querySelector('input[name="phone"]');
    if (firstInput) {
      requestAnimationFrame(() => firstInput.focus());
    }
  }

  window.openSignupPage = openSignupPage;
})();