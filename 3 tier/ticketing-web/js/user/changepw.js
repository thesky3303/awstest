(function () {
  const CHANGE_PW_CSS_PATH = '/css/user/changepw.css?v=3';
  const USER_WRITE_CHANGE_PW_API = '/api/write/auth/change-password';

  let isChangePwSubmitting = false;

  function ensureChangePwCss() {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`link[href="${CHANGE_PW_CSS_PATH}"]`);
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
          reject(new Error('changepw.css load fail'));
        }, { once: true });

        return;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = CHANGE_PW_CSS_PATH;

      link.addEventListener('load', () => {
        link.dataset.loaded = 'true';
        resolve();
      }, { once: true });

      link.addEventListener('error', () => {
        reject(new Error('changepw.css load fail'));
      }, { once: true });

      document.head.appendChild(link);
    });
  }

  function getLoginUser() {
    try {
      const raw = localStorage.getItem('loginUser');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.error('[changepw] loginUser parse error:', error);
      return null;
    }
  }

  function getStoredUserId() {
    const directUserId =
      localStorage.getItem('user_id') ||
      sessionStorage.getItem('user_id');

    if (directUserId) {
      return String(directUserId);
    }

    const loginUser = getLoginUser();
    if (loginUser && loginUser.user_id) {
      return String(loginUser.user_id);
    }

    return '';
  }

  async function requestChangePassword(payload) {
    const response = await fetch(USER_WRITE_CHANGE_PW_API, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    return data;
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

  function clearMainPageSections() {
    const mainBody = ensureMainBody();
    mainBody.innerHTML = '';
    mainBody.style.display = '';

    const body2 = document.getElementById('main-body2');
    if (body2) {
      body2.remove();
    }
  }

  function renderChangePwLayout() {
    return `
      <section id="changepw-page">
        <div class="changepw-wrap">
          <div class="changepw-card">
            <div class="changepw-title-box">
              <h2 class="changepw-title">비밀번호 변경</h2>
            </div>

            <div class="changepw-content">
              <form id="changepw-form" class="changepw-form" novalidate>
                <div class="changepw-row">
                  <label class="changepw-label" for="current-password">현재 비밀번호</label>
                  <div class="changepw-field">
                    <input type="password" id="current-password" class="changepw-input" autocomplete="current-password" />
                    <div id="current-password-error" class="changepw-error"></div>
                  </div>
                </div>

                <div class="changepw-row">
                  <label class="changepw-label" for="new-password">새 비밀번호</label>
                  <div class="changepw-field">
                    <input type="password" id="new-password" class="changepw-input" autocomplete="new-password" />
                    <div id="new-password-error" class="changepw-error"></div>
                  </div>
                </div>

                <div class="changepw-row">
                  <label class="changepw-label" for="new-password-check">새 비밀번호 확인</label>
                  <div class="changepw-field">
                    <input type="password" id="new-password-check" class="changepw-input" autocomplete="new-password" />
                    <div id="new-password-check-error" class="changepw-error"></div>
                  </div>
                </div>

                <div id="changepw-common-error" class="changepw-common-error"></div>

                <div class="changepw-button-row">
                  <button type="submit" id="changepw-submit-button" class="changepw-button is-primary">변경완료</button>
                  <button type="button" id="changepw-cancel-button" class="changepw-button is-secondary">취소</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function clearErrors() {
    document.getElementById('current-password-error').textContent = '';
    document.getElementById('new-password-error').textContent = '';
    document.getElementById('new-password-check-error').textContent = '';
    document.getElementById('changepw-common-error').textContent = '';
  }

  function setFieldError(id, message) {
    const el = document.getElementById(id);
    if (el) el.textContent = message || '';
  }

  function setCommonError(message) {
    const el = document.getElementById('changepw-common-error');
    if (el) el.textContent = message || '';
  }

  function validateChangePwForm(currentPassword, newPassword, newPasswordCheck) {
    let ok = true;

    if (!currentPassword) {
      setFieldError('current-password-error', '현재 비밀번호를 입력해 주세요.');
      ok = false;
    }

    if (!newPassword) {
      setFieldError('new-password-error', '새 비밀번호를 입력해 주세요.');
      ok = false;
    } else if (newPassword.length < 4) {
      setFieldError('new-password-error', '새 비밀번호는 4자 이상 입력해 주세요.');
      ok = false;
    }

    if (!newPasswordCheck) {
      setFieldError('new-password-check-error', '새 비밀번호 확인을 입력해 주세요.');
      ok = false;
    } else if (newPassword !== newPasswordCheck) {
      setFieldError('new-password-check-error', '새 비밀번호가 일치하지 않습니다.');
      ok = false;
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      setFieldError('new-password-error', '현재 비밀번호와 다른 비밀번호를 입력해 주세요.');
      ok = false;
    }

    return ok;
  }

  function bindChangePwEvents() {
    const form = document.getElementById('changepw-form');
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const newPasswordCheckInput = document.getElementById('new-password-check');
    const submitButton = document.getElementById('changepw-submit-button');
    const cancelButton = document.getElementById('changepw-cancel-button');

    [currentPasswordInput, newPasswordInput, newPasswordCheckInput].forEach((input) => {
      input.addEventListener('input', () => {
        clearErrors();
      });
    });

    cancelButton.addEventListener('click', () => {
      if (typeof window.appNavigate === 'function') {
        window.appNavigate({ view: 'mypage' });
        return;
      }

      if (typeof window.openMyPage === 'function') {
        window.openMyPage();
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (isChangePwSubmitting) return;

      clearErrors();

      const userId = getStoredUserId();
      const currentPassword = currentPasswordInput.value;
      const newPassword = newPasswordInput.value;
      const newPasswordCheck = newPasswordCheckInput.value;

      if (!userId) {
        setCommonError('로그인 정보가 없습니다.');
        return;
      }

      if (!validateChangePwForm(currentPassword, newPassword, newPasswordCheck)) {
        return;
      }

      isChangePwSubmitting = true;
      submitButton.disabled = true;
      submitButton.textContent = '변경중...';

      try {
        await requestChangePassword({
          user_id: userId,
          current_password: currentPassword,
          new_password: newPassword
        });

        alert('비밀번호가 변경되었습니다.');

        if (typeof window.appNavigate === 'function') {
          await window.appNavigate({ view: 'mypage' }, { replace: true });
        } else if (typeof window.openMyPage === 'function') {
          window.openMyPage();
        }
      } catch (error) {
        console.error('[changepw] submit error:', error);
        setCommonError(error.message || '비밀번호 변경 중 오류가 발생했습니다.');
      } finally {
        isChangePwSubmitting = false;
        submitButton.disabled = false;
        submitButton.textContent = '변경완료';
      }
    });
  }

  async function initChangePwPage() {
    try {
      await ensureChangePwCss();
    } catch (error) {
      console.error('[changepw] css load error:', error);
    }

    clearMainPageSections();

    const mainBody = ensureMainBody();
    mainBody.innerHTML = renderChangePwLayout();
    bindChangePwEvents();

    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  window.openChangePw = initChangePwPage;
})();
