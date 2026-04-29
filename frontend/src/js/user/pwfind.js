(function () {
  const LOGIN_CSS_PATH = '/css/user/login.css';
  const PWFIND_CSS_PATH = '/css/user/pwfind.css';
  const VERIFY_API = '/api/read/auth/recover-verify';
  const RESET_API = '/api/write/auth/recover-reset';
  const runtime = window.APP_RUNTIME || {};

  function ensureModalCss() {
    return Promise.all([
      runtime.ensureStyle(LOGIN_CSS_PATH),
      runtime.ensureStyle(PWFIND_CSS_PATH)
    ]);
  }

  function closePwFindPage() {
    if (runtime.removeNodeById) {
      runtime.removeNodeById('login-modal-overlay');
    }
    if (runtime.unlockBodyScroll) {
      runtime.unlockBodyScroll();
    }
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
    modal.querySelectorAll('.pwfind-field-error').forEach((node) => {
      node.textContent = '';
    });
    setCommonError(modal, '');
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
  }

  function isValidPassword(password) {
    return String(password || '').trim().length >= 8;
  }

  function buildModalHtml() {
    const overlay = document.createElement('div');
    overlay.id = 'login-modal-overlay';
    overlay.className = 'login-modal-overlay';

    overlay.innerHTML = `
      <div class="login-modal pwfind-modal" role="dialog" aria-modal="true" aria-labelledby="pwfind-modal-title">
        <button type="button" class="login-modal-close" aria-label="닫기">×</button>

        <div class="login-modal-header pwfind-header">
          <h2 id="pwfind-modal-title" class="login-modal-title">PW 찾기</h2>
          <p class="login-modal-subtitle pwfind-step-verify-sub">가입 시 사용한 이름과 이메일을 입력해 주세요.</p>
        </div>

        <form class="pwfind-form pwfind-verify-form" novalidate>
          <div class="pwfind-form-group">
            <input type="text" name="name" class="login-input pwfind-input" placeholder="이름" autocomplete="name" />
            <div class="pwfind-field-error" data-error-for="name"></div>
          </div>
          <div class="pwfind-form-group">
            <input type="email" name="email" class="login-input pwfind-input" placeholder="이메일" autocomplete="email" />
            <div class="pwfind-field-error" data-error-for="email"></div>
          </div>

          <div class="pwfind-common-error"></div>

          <div class="pwfind-button-row">
            <button type="submit" class="login-submit-button pwfind-submit-button pwfind-verify-submit">확인</button>
            <button type="button" class="pwfind-cancel-button">취소</button>
          </div>
        </form>

        <div class="pwfind-step-reset" hidden>
          <div class="pwfind-skip-banner" role="status"></div>

          <form class="pwfind-form pwfind-reset-form" novalidate>
            <div class="pwfind-form-group">
              <input type="password" name="password" class="login-input pwfind-input" placeholder="새 비밀번호" autocomplete="new-password" />
              <div class="pwfind-field-error" data-error-for="password"></div>
            </div>

            <div class="pwfind-form-group">
              <input type="password" name="password_confirm" class="login-input pwfind-input" placeholder="새 비밀번호 확인" autocomplete="new-password" />
              <div class="pwfind-field-error" data-error-for="password_confirm"></div>
            </div>

            <div class="pwfind-common-error pwfind-reset-common-error"></div>

            <div class="pwfind-button-row">
              <button type="submit" class="login-submit-button pwfind-submit-button">비밀번호 변경</button>
              <button type="button" class="pwfind-cancel-button">취소</button>
            </div>
          </form>
        </div>
      </div>
    `;

    return overlay;
  }

  function setResetCommonError(overlay, message) {
    const target = overlay.querySelector('.pwfind-reset-common-error');
    if (target) target.textContent = message || '';
  }

  function bindEvents(overlay) {
    const closeButton = overlay.querySelector('.login-modal-close');
    const cancelButtons = overlay.querySelectorAll('.pwfind-cancel-button');
    const verifyForm = overlay.querySelector('.pwfind-verify-form');
    const resetForm = overlay.querySelector('.pwfind-reset-form');
    const stepReset = overlay.querySelector('.pwfind-step-reset');
    const skipBanner = overlay.querySelector('.pwfind-skip-banner');
    const nameInput = verifyForm.querySelector('input[name="name"]');
    const emailInput = verifyForm.querySelector('input[name="email"]');
    const verifySubmit = verifyForm.querySelector('.pwfind-verify-submit');
    const passwordInput = resetForm.querySelector('input[name="password"]');
    const passwordConfirmInput = resetForm.querySelector('input[name="password_confirm"]');
    const resetSubmit = resetForm.querySelector('.pwfind-submit-button');

    let verifiedName = '';
    let verifiedEmail = '';
    let verifySubmitting = false;
    let resetSubmitting = false;

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) {
        closePwFindPage();
      }
    });

    closeButton.addEventListener('click', closePwFindPage);
    cancelButtons.forEach(function (btn) {
      btn.addEventListener('click', goToLoginPage);
    });

    [nameInput, emailInput].forEach(function (input) {
      input.addEventListener('input', function () {
        clearErrors(overlay);
      });
    });

    [passwordInput, passwordConfirmInput].forEach(function (input) {
      input.addEventListener('input', function () {
        resetForm.querySelectorAll('.pwfind-field-error').forEach(function (n) {
          n.textContent = '';
        });
        setResetCommonError(overlay, '');
      });
    });

    verifyForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (verifySubmitting) return;

      clearErrors(overlay);

      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      let hasError = false;
      if (!name) {
        setFieldError(overlay, 'name', '이름을 입력해 주세요.');
        hasError = true;
      }
      if (!isValidEmail(email)) {
        setFieldError(overlay, 'email', '올바른 이메일을 입력해 주세요.');
        hasError = true;
      }
      if (hasError) return;

      if (typeof runtime.postJson !== 'function') {
        setCommonError(overlay, '요청을 보낼 수 없습니다. 페이지를 새로고침 후 다시 시도해 주세요.');
        return;
      }

      verifySubmitting = true;
      verifySubmit.disabled = true;
      verifySubmit.textContent = '확인 중...';

      try {
        const result = await runtime.postJson(VERIFY_API, { name: name, email: email });
        verifiedName = name;
        verifiedEmail = email;
        const msg =
          (result && result.message) || '이메일 인증 과정 생략';
        if (skipBanner) skipBanner.textContent = msg;
        verifyForm.hidden = true;
        overlay.querySelector('.pwfind-step-verify-sub').hidden = true;
        stepReset.hidden = false;
        requestAnimationFrame(function () {
          passwordInput.focus();
        });
      } catch (error) {
        console.error('[pwfind] recover-verify:', error);
        const msg =
          error && error.message
            ? error.message
            : '입력하신 정보와 일치하는 계정을 찾을 수 없습니다.';
        setCommonError(overlay, msg);
      } finally {
        verifySubmitting = false;
        verifySubmit.disabled = false;
        verifySubmit.textContent = '확인';
      }
    });

    resetForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (resetSubmitting) return;

      resetForm.querySelectorAll('.pwfind-field-error').forEach(function (n) {
        n.textContent = '';
      });
      setResetCommonError(overlay, '');

      const password = passwordInput.value;
      const passwordConfirm = passwordConfirmInput.value;
      let hasError = false;
      if (!isValidPassword(password)) {
        setFieldError(overlay, 'password', '새 비밀번호는 8자 이상 입력해 주세요.');
        hasError = true;
      }
      if (password !== passwordConfirm) {
        setFieldError(overlay, 'password_confirm', '비밀번호가 일치하지 않습니다.');
        hasError = true;
      }
      if (hasError) return;

      if (typeof runtime.postJson !== 'function') {
        setResetCommonError(overlay, '요청을 보낼 수 없습니다. 페이지를 새로고침 후 다시 시도해 주세요.');
        return;
      }

      resetSubmitting = true;
      resetSubmit.disabled = true;
      resetSubmit.textContent = '변경 중...';

      try {
        await runtime.postJson(RESET_API, {
          name: verifiedName,
          email: verifiedEmail,
          new_password: password
        });
        alert('비밀번호가 변경되었습니다.');
        goToLoginPage();
      } catch (error) {
        console.error('[pwfind] recover-reset:', error);
        const msg =
          error && error.message
            ? error.message
            : '비밀번호 변경에 실패했습니다.';
        setResetCommonError(overlay, msg);
      } finally {
        resetSubmitting = false;
        resetSubmit.disabled = false;
        resetSubmit.textContent = '비밀번호 변경';
      }
    });
  }

  async function openPwFindPage() {
    if (runtime.clearTransientUi) {
      runtime.clearTransientUi();
    }

    try {
      await ensureModalCss();
    } catch (error) {
      console.error('[pwfind] css load error:', error);
    }

    const overlay = buildModalHtml();
    runtime.lockBodyScroll();
    document.body.appendChild(overlay);
    bindEvents(overlay);

    const firstInput = overlay.querySelector('input[name="name"]');
    if (firstInput) {
      requestAnimationFrame(function () {
        firstInput.focus();
      });
    }
  }

  window.openPwFindPage = openPwFindPage;
  window.closePwFindPage = closePwFindPage;
})();
