(function () {
  const LOGIN_CSS_PATH = '/css/user/login.css';
  const PWFIND_CSS_PATH = '/css/user/pwfind.css';
  const FIND_PASSWORD_API = '/api/read/auth/find-password';
  const RESET_PASSWORD_API = '/api/write/auth/reset-password';

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

  function closePwFindPage() {
    const overlay = document.getElementById('login-modal-overlay');
    if (overlay) overlay.remove();
    unlockBodyScroll();
  }

  function goToLoginPage() {
    closePwFindPage();

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
    const target = modal.querySelector('.pwfind-common-error');
    if (target) target.textContent = message || '';
  }

  function clearErrors(modal) {
    modal.querySelectorAll('.pwfind-field-error').forEach(node => {
      node.textContent = '';
    });

    const common = modal.querySelector('.pwfind-common-error');
    if (common) common.textContent = '';
  }

  function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function sanitizeName(value) {
    return String(value || '').replace(/[^가-힣a-zA-Z\s]/g, '');
  }

  function isValidPhone(phone) {
    return /^01[016789]\d{7,8}$/.test(phone);
  }

  function isValidName(name) {
    return /^[가-힣a-zA-Z\s]{2,20}$/.test(String(name || '').trim());
  }

  function isValidPassword(password) {
    return String(password || '').trim().length >= 4;
  }

  function formatJoinDate(value) {
    if (!value) return '';
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value).slice(0, 10).replaceAll('-', '.');
    }

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
  }

  async function postJson(url, payload) {
    let response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      return {
        success: false,
        networkError: true,
        message: '서버에 연결할 수 없습니다.'
      };
    }

    let data = {};
    try {
      data = await response.json();
    } catch (error) {
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

  function buildVerifyHtml() {
    const overlay = document.createElement('div');
    overlay.id = 'login-modal-overlay';
    overlay.className = 'login-modal-overlay';

    overlay.innerHTML = `
      <div class="login-modal pwfind-modal" role="dialog" aria-modal="true" aria-labelledby="pwfind-modal-title">
        <button type="button" class="login-modal-close" aria-label="닫기">×</button>

        <div class="login-modal-header pwfind-header">
          <h2 id="pwfind-modal-title" class="login-modal-title">PW 찾기</h2>
          <p class="login-modal-subtitle">핸드폰번호와 이름을 입력해 주세요.</p>
        </div>

        <form class="pwfind-form pwfind-verify-form" novalidate>
          <div class="pwfind-form-group">
            <input
              type="text"
              name="phone"
              class="login-input pwfind-input"
              placeholder="핸드폰번호"
              inputmode="numeric"
              maxlength="11"
            />
            <div class="pwfind-field-error" data-error-for="phone"></div>
          </div>

          <div class="pwfind-form-group">
            <input
              type="text"
              name="name"
              class="login-input pwfind-input"
              placeholder="이름"
              maxlength="20"
            />
            <div class="pwfind-field-error" data-error-for="name"></div>
          </div>

          <div class="pwfind-common-error"></div>

          <div class="pwfind-button-row">
            <button type="submit" class="login-submit-button pwfind-submit-button">확인</button>
            <button type="button" class="pwfind-cancel-button">취소</button>
          </div>
        </form>
      </div>
    `;

    return overlay;
  }

  function buildResetHtml(user) {
    const overlay = document.createElement('div');
    overlay.id = 'login-modal-overlay';
    overlay.className = 'login-modal-overlay';

    overlay.innerHTML = `
      <div class="login-modal pwfind-modal" role="dialog" aria-modal="true" aria-labelledby="pwreset-modal-title">
        <button type="button" class="login-modal-close" aria-label="닫기">×</button>

        <div class="login-modal-header pwfind-header">
          <h2 id="pwreset-modal-title" class="login-modal-title">PW 찾기</h2>
          <p class="login-modal-subtitle">가입 정보가 확인되었습니다.</p>
        </div>

        <div class="pwfind-found-user-box">
          <div class="pwfind-found-user-date">${formatJoinDate(user.created_at)}</div>
          <div class="pwfind-found-user-text">위 날짜에 가입한 정보가 있습니다.</div>
        </div>

        <form class="pwfind-form pwfind-reset-form" novalidate>
          <input type="hidden" name="phone" value="${user.phone || ''}">
          <input type="hidden" name="name" value="${user.name || ''}">

          <div class="pwfind-form-group">
            <input
              type="password"
              name="password"
              class="login-input pwfind-input"
              placeholder="비밀번호 변경"
            />
            <div class="pwfind-field-error" data-error-for="password"></div>
          </div>

          <div class="pwfind-form-group">
            <input
              type="password"
              name="password_confirm"
              class="login-input pwfind-input"
              placeholder="비밀번호 확인"
            />
            <div class="pwfind-field-error" data-error-for="password_confirm"></div>
          </div>

          <div class="pwfind-common-error"></div>

          <div class="pwfind-button-row">
            <button type="submit" class="login-submit-button pwfind-submit-button">확인</button>
            <button type="button" class="pwfind-cancel-button">취소</button>
          </div>
        </form>
      </div>
    `;

    return overlay;
  }

  async function requestFindUser(phone, name) {
    return await postJson(FIND_PASSWORD_API, { phone, name });
  }

  async function requestResetPassword(phone, name, password) {
    return await postJson(RESET_PASSWORD_API, {
      phone,
      name,
      password
    });
  }

  function normalizeFindResult(result, phone, name) {
    const user = result.user || result.data || result.result || null;

    const matchedPhone =
      result.matched_phone === true ||
      result.phone_match === true ||
      result.phoneMatched === true ||
      result.is_phone_match === true ||
      (user && String(user.phone || '') === String(phone));

    const matchedName =
      result.matched_name === true ||
      result.name_match === true ||
      result.nameMatched === true ||
      result.is_name_match === true ||
      (user && String(user.name || '').trim() === String(name).trim());

    const success =
      result.success === true ||
      result.exists === true ||
      result.found === true ||
      result.matched === true ||
      result.both_matched === true ||
      (matchedPhone && matchedName) ||
      !!user;

    return {
      success,
      matchedPhone,
      matchedName,
      user: user || {
        phone,
        name,
        created_at: result.created_at || result.join_date || ''
      }
    };
  }

  function bindVerifyEvents(overlay) {
    const closeButton = overlay.querySelector('.login-modal-close');
    const cancelButton = overlay.querySelector('.pwfind-cancel-button');
    const form = overlay.querySelector('.pwfind-verify-form');
    const phoneInput = form.querySelector('input[name="phone"]');
    const nameInput = form.querySelector('input[name="name"]');
    const submitButton = form.querySelector('.pwfind-submit-button');

    let isComposingName = false;

    closeButton.addEventListener('click', function (e) {
      e.preventDefault();
      closePwFindPage();
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
      const name = nameInput.value.trim();

      let hasError = false;

      if (!isValidPhone(phone)) {
        setFieldError(overlay, 'phone', '핸드폰번호를 확인하세요.');
        hasError = true;
      }

      if (!isValidName(name)) {
        setFieldError(overlay, 'name', '이름을 확인하세요.');
        hasError = true;
      }

      if (hasError) return;

      submitButton.disabled = true;
      submitButton.textContent = '확인 중...';

      try {
        const rawResult = await requestFindUser(phone, name);
        const result = normalizeFindResult(rawResult, phone, name);

        if (!result.matchedPhone && result.matchedName) {
          setFieldError(overlay, 'phone', '핸드폰번호를 확인하세요.');
          submitButton.disabled = false;
          submitButton.textContent = '확인';
          return;
        }

        if (result.matchedPhone && !result.matchedName) {
          setFieldError(overlay, 'name', '이름을 확인하세요.');
          submitButton.disabled = false;
          submitButton.textContent = '확인';
          return;
        }

        if (!result.success) {
          setFieldError(overlay, 'phone', '핸드폰번호를 확인하세요.');
          setFieldError(overlay, 'name', '이름을 확인하세요.');
          submitButton.disabled = false;
          submitButton.textContent = '확인';
          return;
        }

        closePwFindPage();
        openPwFindResetPage({
          phone: result.user.phone || phone,
          name: result.user.name || name,
          created_at: result.user.created_at || rawResult.created_at || ''
        });
      } catch (error) {
        console.error('pwfind verify error:', error);
        setCommonError(overlay, '서버와 통신 중 문제가 발생했습니다.');
        submitButton.disabled = false;
        submitButton.textContent = '확인';
      }
    });
  }

  function bindResetEvents(overlay) {
    const closeButton = overlay.querySelector('.login-modal-close');
    const cancelButton = overlay.querySelector('.pwfind-cancel-button');
    const form = overlay.querySelector('.pwfind-reset-form');
    const phoneInput = form.querySelector('input[name="phone"]');
    const nameInput = form.querySelector('input[name="name"]');
    const passwordInput = form.querySelector('input[name="password"]');
    const passwordConfirmInput = form.querySelector('input[name="password_confirm"]');
    const submitButton = form.querySelector('.pwfind-submit-button');

    closeButton.addEventListener('click', function (e) {
      e.preventDefault();
      closePwFindPage();
    });

    cancelButton.addEventListener('click', function (e) {
      e.preventDefault();
      goToLoginPage();
    });

    passwordInput.addEventListener('input', function () {
      setFieldError(overlay, 'password', '');
      setCommonError(overlay, '');
    });

    passwordConfirmInput.addEventListener('input', function () {
      setFieldError(overlay, 'password_confirm', '');
      setCommonError(overlay, '');
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearErrors(overlay);

      const password = passwordInput.value;
      const passwordConfirm = passwordConfirmInput.value;

      let hasError = false;

      if (!isValidPassword(password)) {
        setFieldError(overlay, 'password', '비밀번호는 최소 4자리입니다.');
        hasError = true;
      }

      if (password !== passwordConfirm) {
        setFieldError(overlay, 'password_confirm', '비밀번호가 일치하지 않습니다.');
        hasError = true;
      }

      if (hasError) return;

      submitButton.disabled = true;
      submitButton.textContent = '변경 중...';

      try {
        const result = await requestResetPassword(
          phoneInput.value.trim(),
          nameInput.value.trim(),
          password
        );

        const success =
          result.success === true ||
          result.updated === true ||
          result.changed === true ||
          result.message === 'password reset success';

        if (!success) {
          setCommonError(overlay, result.message || '비밀번호 변경에 실패했습니다.');
          submitButton.disabled = false;
          submitButton.textContent = '확인';
          return;
        }

        submitButton.disabled = false;
        submitButton.textContent = '확인';

        alert('비밀번호가 변경되었습니다.');
        goToLoginPage();
      } catch (error) {
        console.error('pwfind reset error:', error);
        setCommonError(overlay, '서버와 통신 중 문제가 발생했습니다.');
        submitButton.disabled = false;
        submitButton.textContent = '확인';
      }
    });
  }

  function openPwFindVerifyPage() {
    removeExistingModal();
    const overlay = buildVerifyHtml();
    lockBodyScroll();
    document.body.appendChild(overlay);
    bindVerifyEvents(overlay);

    const firstInput = overlay.querySelector('input[name="phone"]');
    if (firstInput) {
      requestAnimationFrame(() => firstInput.focus());
    }
  }

  function openPwFindResetPage(user) {
    removeExistingModal();
    const overlay = buildResetHtml(user);
    lockBodyScroll();
    document.body.appendChild(overlay);
    bindResetEvents(overlay);

    const firstInput = overlay.querySelector('input[name="password"]');
    if (firstInput) {
      requestAnimationFrame(() => firstInput.focus());
    }
  }

  async function openPwFindPage() {
    removeExistingModal();

    try {
      await Promise.all([ensureCss(LOGIN_CSS_PATH), ensureCss(PWFIND_CSS_PATH)]);
    } catch (error) {
      console.error('pwfind css load error:', error);
    }

    openPwFindVerifyPage();
  }

  window.openPwFindPage = openPwFindPage;
})();