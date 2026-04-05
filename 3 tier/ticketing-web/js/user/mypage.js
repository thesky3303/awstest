(function () {
  const MY_PAGE_CSS_PATH = '/css/user/mypage.css';
  const MY_PAGE_READ_API = '/api/read/user/mypage';
  const MY_PAGE_BOOKING_API = '/api/read/mypage/bookings';

  function ensureMyPageCss() {
    const exists = document.querySelector(`link[href="${MY_PAGE_CSS_PATH}"]`);
    if (exists) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = MY_PAGE_CSS_PATH;
    document.head.appendChild(link);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatPhone(phone) {
    const raw = String(phone || '').replace(/[^0-9]/g, '');

    if (raw.length === 11) {
      return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
    }

    if (raw.length === 10) {
      return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6)}`;
    }

    return phone || '-';
  }

  function formatDateTime(value) {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }

  function formatJoinDate(value) {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
  }

  function getBookingStatusLabel(status) {
    const normalized = String(status || '').toUpperCase();

    if (normalized === 'BOOKED' || normalized === 'COMPLETE') {
      return { text: '예매완료', className: '' };
    }

    if (normalized === 'CANCEL' || normalized === 'CANCELED' || normalized === 'CANCELLED') {
      return { text: '예매취소', className: 'is-cancel' };
    }

    if (normalized === 'WAIT') {
      return { text: '대기중', className: 'is-wait' };
    }

    return { text: normalized || '-', className: '' };
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

  function getLoginUser() {
    try {
      const raw = localStorage.getItem('loginUser');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.error('[mypage] loginUser parse error:', error);
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

  function setStoredUserId(userId) {
    if (!userId) return;
    localStorage.setItem('user_id', String(userId));
  }

  function buildUrlWithUserId(baseUrl, userId) {
    const url = new URL(baseUrl, window.location.origin);

    if (userId) {
      url.searchParams.set('user_id', userId);
    }

    return url.toString();
  }

  async function fetchJson(url, userId) {
    const requestUrl = buildUrlWithUserId(url, userId);

    const response = await fetch(requestUrl, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId ? String(userId) : ''
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  function renderMyPageLayout() {
    return `
      <section id="mypage-page">
        <div class="mypage-wrap">
          <div class="mypage-card">
            <div class="mypage-title-box">
              <h2 class="mypage-title">마이페이지</h2>
            </div>

            <div class="mypage-content">
              <div class="mypage-profile-box">
                <div class="mypage-profile-left">
                  <h3 id="mypage-profile-name" class="mypage-profile-name">회원정보</h3>

                  <table class="mypage-profile-table">
                    <tbody>
                      <tr>
                        <th>이름</th>
                        <td id="mypage-user-name">-</td>
                      </tr>
                      <tr>
                        <th>핸드폰번호</th>
                        <td id="mypage-user-phone">-</td>
                      </tr>
                      <tr>
                        <th>가입일</th>
                        <td id="mypage-user-created-at">-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div class="mypage-profile-actions">
                  <button type="button" id="mypage-edit-button" class="mypage-action-button">수정</button>
                  <button type="button" id="mypage-password-button" class="mypage-action-button">비밀번호변경</button>
                  <button type="button" id="mypage-booking-button" class="mypage-action-button">예매내역</button>
                </div>
              </div>

              <section class="mypage-section">
                <div class="mypage-section-head">
                  <h3 class="mypage-section-title">최근 예매 내역</h3>
                </div>

                <div id="mypage-booking-area">
                  <div class="mypage-empty-box">조회결과가 없습니다</div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderBookingTable(bookings) {
    if (!Array.isArray(bookings) || bookings.length === 0) {
      return `
        <div class="mypage-empty-box">
          조회결과가 없습니다
        </div>
      `;
    }

    const rows = bookings.map((item) => {
      const status = getBookingStatusLabel(item.book_status);
      const payText = String(item.pay_yn || '').toUpperCase() === 'Y' ? '결제완료' : '미결제';

      return `
        <tr>
          <td>${escapeHtml(item.booking_id ?? '-')}</td>
          <td>${escapeHtml(formatDateTime(item.booking_created_at || item.created_at))}</td>
          <td>${escapeHtml(formatDateTime(item.show_date))}</td>
          <td>${escapeHtml(item.req_count ?? '-')}</td>
          <td>
            <span class="mypage-booking-status ${status.className}">
              ${escapeHtml(status.text)}
            </span>
          </td>
          <td>${escapeHtml(payText)}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="mypage-booking-table-wrap">
        <table class="mypage-booking-table">
          <thead>
            <tr>
              <th>예매번호</th>
              <th>예매일시</th>
              <th>상영일시</th>
              <th>예매수량</th>
              <th>예매상태</th>
              <th>결제상태</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  function bindMyPageButtons() {
    const editButton = document.getElementById('mypage-edit-button');
    const passwordButton = document.getElementById('mypage-password-button');
    const bookingButton = document.getElementById('mypage-booking-button');

    if (editButton) {
      editButton.addEventListener('click', () => {
        if (typeof window.appNavigate === 'function') {
          window.appNavigate({ view: 'edit' });
        }
      });
    }

    if (passwordButton) {
      passwordButton.addEventListener('click', () => {
        if (typeof window.appNavigate === 'function') {
          window.appNavigate({ view: 'changepw' });
        }
      });
    }

    if (bookingButton) {
      bookingButton.addEventListener('click', () => {
        const target = document.querySelector('.mypage-section');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }

  async function loadMyPageUser() {
    const storedUserId = getStoredUserId();

    if (!storedUserId) {
      console.warn('[mypage] localStorage user_id not found');
      return;
    }

    const data = await fetchJson(MY_PAGE_READ_API, storedUserId);
    const user = data.user || data.result || data.data || data || {};

    const finalUserId = user.user_id || storedUserId;
    setStoredUserId(finalUserId);

    document.getElementById('mypage-profile-name').textContent = '회원정보';
    document.getElementById('mypage-user-name').textContent = user.name || '-';
    document.getElementById('mypage-user-phone').textContent = formatPhone(user.phone);
    document.getElementById('mypage-user-created-at').textContent = formatJoinDate(user.created_at);
  }

  async function loadMyPageBookings() {
    const bookingArea = document.getElementById('mypage-booking-area');
    const storedUserId = getStoredUserId();

    if (!bookingArea) return;

    if (!storedUserId) {
      bookingArea.innerHTML = `
        <div class="mypage-empty-box">
          조회결과가 없습니다
        </div>
      `;
      return;
    }

    try {
      const data = await fetchJson(MY_PAGE_BOOKING_API, storedUserId);
      const bookings = data.bookings || data.list || data.data || [];
      bookingArea.innerHTML = renderBookingTable(bookings);
    } catch (error) {
      console.error('[mypage] booking load error:', error);
      bookingArea.innerHTML = `
        <div class="mypage-empty-box">
          조회결과가 없습니다
        </div>
      `;
    }
  }

  async function initMyPagePage() {
    ensureMyPageCss();
    clearMainPageSections();

    const mainBody = ensureMainBody();
    mainBody.innerHTML = renderMyPageLayout();

    bindMyPageButtons();

    try {
      await loadMyPageUser();
    } catch (error) {
      console.error('[mypage] user load error:', error);
    }

    await loadMyPageBookings();

    window.scrollTo({
      top: 0,
      behavior: 'auto'
    });
  }

  window.openMyPage = initMyPagePage;
})();
