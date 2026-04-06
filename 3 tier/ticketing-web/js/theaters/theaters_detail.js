(function () {
  const THEATERS_DETAIL_CSS_PATH = '/css/theaters/theaters_detail.css';
  const OVERLAY_ID = 'theaters-booking-detail-overlay';
  const BODY_ACTIVE_CLASS = 'theaters-booking-modal-open';

  function ensureDetailCss() {
    if (window.APP_RUNTIME && typeof window.APP_RUNTIME.ensureStyle === 'function') {
      return window.APP_RUNTIME.ensureStyle(THEATERS_DETAIL_CSS_PATH);
    }

    const exists = document.querySelector(`link[href="${THEATERS_DETAIL_CSS_PATH}"]`);
    if (exists) return Promise.resolve(exists);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = THEATERS_DETAIL_CSS_PATH;
    document.head.appendChild(link);
    return Promise.resolve(link);
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function toInt(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function parseDateValue(value) {
    if (!value) return null;
    const normalized = String(value).trim().replace(' ', 'T');
    const date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) return date;
    const fallback = new Date(String(value).trim());
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  function addMinutes(value, minutes) {
    const date = parseDateValue(value);
    if (!date) return null;
    return new Date(date.getTime() + Number(minutes || 0) * 60 * 1000);
  }

  function formatTime(value) {
    const date = parseDateValue(value);
    if (!date) return '--:--';
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function lockBodyScroll() {
    if (window.APP_RUNTIME && typeof window.APP_RUNTIME.lockBodyScroll === 'function') {
      window.APP_RUNTIME.lockBodyScroll();
      return;
    }
    document.body.classList.add(BODY_ACTIVE_CLASS);
    document.body.style.overflow = 'hidden';
  }

  function unlockBodyScroll() {
    if (window.APP_RUNTIME && typeof window.APP_RUNTIME.unlockBodyScroll === 'function') {
      window.APP_RUNTIME.unlockBodyScroll();
      return;
    }
    document.body.classList.remove(BODY_ACTIVE_CLASS);
    document.body.style.overflow = '';
  }

  function closeModal() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.remove();
    unlockBodyScroll();
  }

  function getStoredUserId() {
    if (window.APP_RUNTIME && typeof window.APP_RUNTIME.getStoredUserId === 'function') {
      return String(window.APP_RUNTIME.getStoredUserId() || '').trim();
    }
    return String(localStorage.getItem('user_id') || sessionStorage.getItem('user_id') || '').trim();
  }

  function createSeatKey(row, col) {
    return `${row}-${col}`;
  }

  function createSeatLabel(row, col) {
    return `${row}열 ${col}번`;
  }

  async function requestBooking(payload) {
    if (typeof writeApi !== 'function') {
      throw new Error('writeApi가 없습니다.');
    }

    return await writeApi('/booking', 'POST', payload);
  }

  async function openTheatersDetail(options) {
    await ensureDetailCss();
    closeModal();
    lockBodyScroll();

    const data = options && typeof options === 'object' ? options : {};
    const schedule = data.schedule || {};
    const hall = data.hall || {};
    const theater = data.theater || {};
    const movie = data.movie || {};
    const onBooked = typeof data.onBooked === 'function' ? data.onBooked : function () {};
    const reservedSeats = new Set(Array.isArray(data.reservedSeats) ? data.reservedSeats.map((value) => String(value)) : []);

    const runtimeMinutes = toInt(movie.runtime_minutes || 120);
    const start = parseDateValue(schedule.show_date);
    const end = addMinutes(schedule.show_date, runtimeMinutes);

    const seatRows = Math.max(1, toInt(hall.seat_rows || 3));
    const seatCols = Math.max(1, toInt(hall.seat_cols || 10));
    const remainCount = Math.max(0, toInt(schedule.remain_count || 0));
    const totalCount = Math.max(0, toInt(schedule.total_count || seatRows * seatCols));
    const price = Math.max(0, toInt(schedule.price || 14000));
    const selectedSeats = new Set();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'theaters-detail-overlay';
    overlay.innerHTML = `
      <div class="theaters-detail-modal" role="dialog" aria-modal="true" aria-label="좌석 선택">
        <div class="theaters-detail-head">
          <div class="theaters-detail-title">${escapeHtml(formatTime(start))}~${escapeHtml(formatTime(end))} (${escapeHtml(hall.hall_name || '상영관')})</div>
          <button type="button" class="theaters-detail-close" aria-label="닫기">×</button>
        </div>

        <div class="theaters-detail-body">
          <div class="theaters-detail-summary">
            <div class="theaters-detail-movie">${escapeHtml(movie.title || '영화')}</div>
            <div class="theaters-detail-place">${escapeHtml(theater.theater_name || '극장')} · ${escapeHtml(hall.hall_name || '상영관')}</div>
            <div class="theaters-detail-date">${escapeHtml(String(schedule.show_date || '').slice(0, 16))}</div>
          </div>

          <div class="theaters-detail-seat-count">잔여좌석 <strong class="theaters-detail-remain">${escapeHtml(String(remainCount))}</strong><span>/${escapeHtml(String(totalCount))}</span></div>
          <div class="theaters-detail-screen-label">SCREEN</div>
          <div class="theaters-detail-screen-bar"></div>
          <div class="theaters-detail-seat-grid"></div>

          <div class="theaters-detail-selected-wrap">
            <div class="theaters-detail-selected-label">선택 좌석</div>
            <div class="theaters-detail-selected-value">없음</div>
          </div>

          <div class="theaters-detail-price-wrap">
            <div>선택 인원 <strong class="theaters-detail-count">0명</strong></div>
            <div>예상 금액 <strong class="theaters-detail-price">0원</strong></div>
          </div>

          <div class="theaters-detail-guide">
            <div class="theaters-detail-guide-badge">안내</div>
            <div>현재 write API는 req_count 기준으로 동작하므로 선택한 좌석 수를 인원수로 전달합니다.</div>
          </div>
        </div>

        <div class="theaters-detail-actions">
          <button type="button" class="theaters-detail-cancel">취소</button>
          <button type="button" class="theaters-detail-submit">결제 진행</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeButton = overlay.querySelector('.theaters-detail-close');
    const cancelButton = overlay.querySelector('.theaters-detail-cancel');
    const submitButton = overlay.querySelector('.theaters-detail-submit');
    const seatGrid = overlay.querySelector('.theaters-detail-seat-grid');
    const selectedValue = overlay.querySelector('.theaters-detail-selected-value');
    const selectedCount = overlay.querySelector('.theaters-detail-count');
    const selectedPrice = overlay.querySelector('.theaters-detail-price');
    const remainNode = overlay.querySelector('.theaters-detail-remain');

    function updateSummary() {
      const seatLabels = Array.from(selectedSeats).map((seatKey) => {
        const parts = seatKey.split('-');
        return createSeatLabel(parts[0], parts[1]);
      });

      selectedValue.textContent = seatLabels.length ? seatLabels.join(', ') : '없음';
      selectedCount.textContent = `${selectedSeats.size}명`;
      selectedPrice.textContent = `${(selectedSeats.size * price).toLocaleString('ko-KR')}원`;
      remainNode.textContent = String(Math.max(0, remainCount - selectedSeats.size));
      submitButton.disabled = selectedSeats.size === 0;
    }

    function handleSeatClick(button, seatKey) {
      if (button.disabled) return;

      if (selectedSeats.has(seatKey)) {
        selectedSeats.delete(seatKey);
        button.classList.remove('is-selected');
      } else {
        if (selectedSeats.size >= Math.max(1, remainCount)) {
          alert('선택 가능한 좌석 수를 초과했습니다.');
          return;
        }
        selectedSeats.add(seatKey);
        button.classList.add('is-selected');
      }

      updateSummary();
    }

    for (let row = 1; row <= seatRows; row += 1) {
      const rowWrap = document.createElement('div');
      rowWrap.className = 'theaters-detail-seat-row';

      const rowLabel = document.createElement('div');
      rowLabel.className = 'theaters-detail-seat-row-label';
      rowLabel.textContent = `${row}열`;
      rowWrap.appendChild(rowLabel);

      const rowSeats = document.createElement('div');
      rowSeats.className = 'theaters-detail-seat-row-seats';

      for (let col = 1; col <= seatCols; col += 1) {
        const seatKey = createSeatKey(row, col);
        const seat = document.createElement('button');
        seat.type = 'button';
        seat.className = 'theaters-detail-seat';
        seat.textContent = String(col);
        seat.setAttribute('aria-label', createSeatLabel(row, col));

        if (reservedSeats.has(seatKey)) {
          seat.classList.add('is-disabled');
          seat.disabled = true;
        }

        seat.addEventListener('click', function () {
          handleSeatClick(seat, seatKey);
        });

        rowSeats.appendChild(seat);
      }

      rowWrap.appendChild(rowSeats);
      seatGrid.appendChild(rowWrap);
    }

    updateSummary();

    closeButton.addEventListener('click', closeModal);
    cancelButton.addEventListener('click', closeModal);

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) {
        closeModal();
      }
    });

    document.addEventListener('keydown', function escHandler(event) {
      if (event.key === 'Escape') {
        document.removeEventListener('keydown', escHandler);
        closeModal();
      }
    }, { once: true });

    submitButton.addEventListener('click', async function () {
      if (!selectedSeats.size) {
        alert('좌석을 먼저 선택해주세요.');
        return;
      }

      const userId = getStoredUserId();
      if (!userId) {
        alert('로그인이 필요합니다.');
        if (typeof window.openLoginPage === 'function') {
          window.openLoginPage();
        }
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = '결제 진행 중...';

      try {
        if (!schedule.__demo) {
          await requestBooking({
            user_id: userId,
            schedule_id: schedule.schedule_id,
            req_count: selectedSeats.size
          });
        }

        onBooked({
          schedule_id: schedule.schedule_id,
          selectedSeats: Array.from(selectedSeats)
        });

        alert(schedule.__demo ? '화면 테스트용 예매가 완료되었습니다.' : '예매가 완료되었습니다.');
        closeModal();
      } catch (error) {
        console.error(error);
        alert(error.message || '예매 처리 중 오류가 발생했습니다.');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = '결제 진행';
      }
    });
  }

  window.openTheatersDetail = openTheatersDetail;
})();
