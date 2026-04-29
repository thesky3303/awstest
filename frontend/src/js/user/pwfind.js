(function () {
  const LOGIN_CSS_PATH = '/css/user/login.css';
  const PWFIND_CSS_PATH = '/css/user/pwfind.css';
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

  function cognitoForgotErrorMessage(error) {
    var code = String(error.code || error.__type || '');
    if (code.indexOf('UserNotFoundException') !== -1 || code.indexOf('ResourceNotFoundException') !== -1) {
      return '등록되지 않은 이메일입니다.';
    }
    if (code.indexOf('InvalidParameterException') !== -1) {
      return '이메일 형식을 확인해 주세요.';
    }
    if (code.indexOf('LimitExceededException') !== -1 || code.indexOf('TooManyRequestsException') !== -1) {
      return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    }
    return error.message || '인증코드 발송에 실패했습니다.';
  }

  function cognitoConfirmErrorMessage(error) {
    var code = String(error.code || error.__type || '');
    if (code.indexOf('CodeMismatchException') !== -1) {
      return '인증번호가 올바르지 않습니다.';
    }
    if (code.indexOf('ExpiredCodeException') !== -1) {
      return '인증번호가 만료되었습니다. 처음부터 다시 시도해 주세요.';
    }
    if (code.indexOf('InvalidPasswordException') !== -1) {
      return '새 비밀번호 형식이 정책에 맞지 않습니다. (8자 이상, 대·소문자·숫자 등)';
    }
    if (code.indexOf('UserNotFoundException') !== -1) {
      return '사용자를 찾을 수 없습니다.';
    }
    return error.message || '비밀번호 변경에 실패했습니다.';
  }

  function buildEmailHtml() {
    const overlay = document.createElement('div');
    overlay.id = 'login-modal-overlay';
    overlay.className = 'login-modal-overlay';

    overlay.innerHTML = `
      <div class="login-modal pwfind-modal" role="dialog" aria-modal="true" aria-labelledby="pwfind-modal-title">
        <button type="button" class="login-modal-close" aria-label="닫기">×</button>

        <div class="login-modal-header pwfind-header">
          <h2 id="pwfind-modal-title" class="login-modal-title">PW 찾기</h2>
          <p class="login-modal-subtitle">가입 시 사용한 이메일을 입력해 주세요. 인증번호가 메일로 발송됩니다.</p>
        </div>

        <form class="pwfind-form pwfind-email-form" novalidate>
          <div class="pwfind-form-group">
            <input type="email" name="email" class="login-input pwfind-input" placeholder="이메일" autocomplete="email" />
            <div class="pwfind-field-error" data-error-for="email"></div>
          </div>

          <div class="pwfind-common-error"></div>

          <div class="pwfind-button-row">
            <button type="submit" class="login-submit-button pwfind-submit-button">인증번호 받기</button>
            <button type="button" class="pwfind-cancel-button">취소</button>
          </div>
        </form>
      </div>
    `;

    return overlay;
  }

  function buildConfirmHtml() {
    const overlay = document.createElement('div');
    overlay.id = 'login-modal-overlay';
    overlay.className = 'login-modal-overlay';

    overlay.innerHTML = `
      <div class="login-modal pwfind-modal" role="dialog" aria-modal="true" aria-labelledby="pwreset-modal-title">
        <button type="button" class="login-modal-close" aria-label="닫기">×</button>

        <div class="login-modal-header pwfind-header">
          <h2 id="pwreset-modal-title" class="login-modal-title">PW 찾기</h2>
          <p class="login-modal-subtitle">이메일로 받은 인증번호와 새 비밀번호를 입력해 주세요.</p>
        </div>

        <form class="pwfind-form pwfind-confirm-form" novalidate>
          <div class="pwfind-form-group">
            <input type="text" name="code" class="login-input pwfind-input" placeholder="인증번호" inputmode="numeric" autocomplete="one-time-code" />
            <div class="pwfind-field-error" data-error-for="code"></div>
          </div>

          <div class="pwfind-form-group">
            <input type="password" name="password" class="login-input pwfind-input" placeholder="새 비밀번호" autocomplete="new-password" />
            <div class="pwfind-field-error" data-error-for="password"></div>
          </div>

          <div class="pwfind-form-group">
            <input type="password" name="password_confirm" class="login-input pwfind-input" placeholder="새 비밀번호 확인" autocomplete="new-password" />
            <div class="pwfind-field-error" data-error-for="password_confirm"></div>
          </div>

          <div class="pwfind-common-error"></div>

          <div class="pwfind-button-row">
            <button type="submit" class="login-submit-button pwfind-submit-button">비밀번호 변경</button>
            <button type="button" class="pwfind-cancel-button">취소</button>
          </div>
        </form>
      </div>
    `;

    return overlay;
  }

  function bindEmailEvents(overlay) {
    const closeButton = overlay.querySelector('.login-modal-close');
    const cancelButton = overlay.querySelector('.pwfind-cancel-button');
    const form = overlay.querySelector('.pwfind-email-form');
    const emailInput = form.querySelector('input[name="email"]');
    const submitButton = form.querySelector('.pwfind-submit-button');
    let isSubmitting = false;

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) {
        closePwFindPage();
      }
    });

    closeButton.addEventListener('click', closePwFindPage);
    cancelButton.addEventListener('click', goToLoginPage);

    emailInput.addEventListener('input', function () {
      clearErrors(overlay);
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (isSubmitting) return;

      clearErrors(overlay);

      const email = emailInput.value.trim();
      if (!isValidEmail(email)) {
        setFieldError(overlay, 'email', '올바른 이메일을 입력해 주세요.');
        return;
      }

      if (!window.CognitoAuth || typeof window.CognitoAuth.forgotPassword !== 'function') {
        setCommonError(overlay, '인증 모듈을 불러오지 못했습니다. 페이지를 새로고침 후 다시 시도해 주세요.');
        return;
      }

      isSubmitting = true;
      submitButton.disabled = true;
      submitButton.textContent = '발송 중...';

      try {
        await window.CognitoAuth.forgotPassword(email);
        closePwFindPage();
        openConfirmPage(email);
      } catch (error) {
        console.error('[pwfind] forgotPassword:', error);
        setCommonError(overlay, cognitoForgotErrorMessage(error));
      } finally {
        isSubmitting = false;
        submitButton.disabled = false;
        submitButton.textContent = '인증번호 받기';
      }
    });
  }

  function bindConfirmEvents(overlay, email) {
    const closeButton = overlay.querySelector('.login-modal-close');
    const cancelButton = overlay.querySelector('.pwfind-cancel-button');
    const form = overlay.querySelector('.pwfind-confirm-form');
    const codeInput = form.querySelector('input[name="code"]');
    const passwordInput = form.querySelector('input[name="password"]');
    const passwordConfirmInput = form.querySelector('input[name="password_confirm"]');
    const submitButton = form.querySelector('.pwfind-submit-button');
    let isSubmitting = false;

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) {
        closePwFindPage();
      }
    });

    closeButton.addEventListener('click', closePwFindPage);
    cancelButton.addEventListener('click', goToLoginPage);

    [codeInput, passwordInput, passwordConfirmInput].forEach((input) => {
      input.addEventListener('input', function () {
        clearErrors(overlay);
      });
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (isSubmitting) return;

      clearErrors(overlay);

      const code = codeInput.value.trim();
      const password = passwordInput.value;
      const passwordConfirm = passwordConfirmInput.value;
      let hasError = false;

      if (!code) {
        setFieldError(overlay, 'code', '인증번호를 입력해 주세요.');
        hasError = true;
      }
      if (!isValidPassword(password)) {
        setFieldError(overlay, 'password', '새 비밀번호는 8자 이상 입력해 주세요.');
        hasError = true;
      }
      if (password !== passwordConfirm) {
        setFieldError(overlay, 'password_confirm', '비밀번호가 일치하지 않습니다.');
        hasError = true;
      }
      if (hasError) return;

      if (!window.CognitoAuth || typeof window.CognitoAuth.confirmForgotPassword !== 'function') {
        setCommonError(overlay, '인증 모듈을 불러오지 못했습니다.');
        return;
      }

      isSubmitting = true;
      submitButton.disabled = true;
      submitButton.textContent = '변경 중...';

      try {
        await window.CognitoAuth.confirmForgotPassword(email, code, password);
        alert('비밀번호가 변경되었습니다.');
        goToLoginPage();
      } catch (error) {
        console.error('[pwfind] confirmForgotPassword:', error);
        setCommonError(overlay, cognitoConfirmErrorMessage(error));
      } finally {
        isSubmitting = false;
        submitButton.disabled = false;
        submitButton.textContent = '비밀번호 변경';
      }
    });
  }

  function openConfirmPage(email) {
    const overlay = buildConfirmHtml();
    runtime.lockBodyScroll();
    document.body.appendChild(overlay);
    bindConfirmEvents(overlay, email);
    const codeInput = overlay.querySelector('input[name="code"]');
    if (codeInput) {
      requestAnimationFrame(() => codeInput.focus());
    }
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

    const overlay = buildEmailHtml();
    runtime.lockBodyScroll();
    document.body.appendChild(overlay);
    bindEmailEvents(overlay);

    const firstInput = overlay.querySelector('input[name="email"]');
    if (firstInput) {
      requestAnimationFrame(() => firstInput.focus());
    }
  }

  window.openPwFindPage = openPwFindPage;
  window.closePwFindPage = closePwFindPage;
})();
