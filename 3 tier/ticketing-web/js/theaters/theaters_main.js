(function () {
  const THEATERS_MAIN_CSS_PATH = '/css/theaters/theaters_main.css';
  const THEATERS_DETAIL_SCRIPT_PATH = '/js/theaters/theaters_detail.js';
  const DEFAULT_SEAT_ROWS = 3;
  const DEFAULT_SEAT_COLS = 10;

  const state = {
    movies: [],
    dataset: null,
    selectedRegion: '',
    selectedTheaterId: null,
    selectedMovieId: null,
    selectedDateKey: '',
    selectedHallId: null,
    selectedSpecial: 'ALL',
    selectedTimeBand: 'ALL'
  };

  function ensureMainCss() {
    if (window.APP_RUNTIME && typeof window.APP_RUNTIME.ensureStyle === 'function') {
      return window.APP_RUNTIME.ensureStyle(THEATERS_MAIN_CSS_PATH);
    }

    const exists = document.querySelector(`link[href="${THEATERS_MAIN_CSS_PATH}"]`);
    if (exists) return Promise.resolve(exists);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = THEATERS_MAIN_CSS_PATH;
    document.head.appendChild(link);
    return Promise.resolve(link);
  }

  function ensureDetailScript() {
    if (window.APP_RUNTIME && typeof window.APP_RUNTIME.ensureScript === 'function') {
      return window.APP_RUNTIME.ensureScript(THEATERS_DETAIL_SCRIPT_PATH);
    }

    const exists = document.querySelector(`script[src="${THEATERS_DETAIL_SCRIPT_PATH}"]`);
    if (exists) return Promise.resolve(exists);

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = THEATERS_DETAIL_SCRIPT_PATH;
      script.defer = true;
      script.addEventListener('load', () => resolve(script), { once: true });
      script.addEventListener('error', () => reject(new Error(`script load fail: ${THEATERS_DETAIL_SCRIPT_PATH}`)), { once: true });
      document.body.appendChild(script);
    });
  }

  function ensureMountPoint() {
    if (window.APP_RUNTIME && typeof window.APP_RUNTIME.ensureMainBody === 'function') {
      return window.APP_RUNTIME.ensureMainBody();
    }

    let mount = document.getElementById('main-body');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'main-body';
      document.body.appendChild(mount);
    }
    return mount;
  }

  function clearPrimarySections() {
    if (window.APP_RUNTIME && typeof window.APP_RUNTIME.resetPrimarySections === 'function') {
      window.APP_RUNTIME.resetPrimarySections();
      return;
    }

    const mount = ensureMountPoint();
    mount.innerHTML = '';
    mount.style.display = '';

    const second = document.getElementById('main-body2');
    if (second) second.remove();
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

  function parseDateValue(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

    const normalized = String(value).trim().replace(' ', 'T');
    const date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) return date;

    const fallback = new Date(String(value).trim());
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function toDateKey(value) {
    const date = parseDateValue(value);
    if (!date) return '';
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function formatMonthLabel(value) {
    const date = parseDateValue(value);
    if (!date) return '';
    return `${date.getMonth() + 1}월`;
  }

  function formatDayLabel(value) {
    const date = parseDateValue(value);
    if (!date) return '';

    const names = ['일', '월', '화', '수', '목', '금', '토'];
    return {
      day: date.getDate(),
      week: names[date.getDay()],
      full: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
    };
  }

  function formatTimeLabel(value) {
    const date = parseDateValue(value);
    if (!date) return '--:--';
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function addMinutes(dateValue, minutes) {
    const date = parseDateValue(dateValue);
    if (!date) return null;
    return new Date(date.getTime() + Number(minutes || 0) * 60 * 1000);
  }

  function formatRangeLabel(schedule, movie) {
    const start = parseDateValue(schedule.show_date);
    const runtime = toInt(movie && movie.runtime_minutes ? movie.runtime_minutes : 120);
    const end = addMinutes(start, runtime);

    return `${formatTimeLabel(start)}~${formatTimeLabel(end)}`;
  }

  function getTimeBand(dateValue) {
    const date = parseDateValue(dateValue);
    if (!date) return 'ALL';
    const hour = date.getHours();
    if (hour >= 23 || hour < 5) return 'LATE';
    if (hour >= 19) return 'AFTER_19';
    if (hour >= 13) return 'AFTER_13';
    return 'ALL';
  }

  function buildSpecialTag(hallName) {
    const value = String(hallName || '').toUpperCase();
    if (value.includes('ATMOS')) return 'ATMOS';
    if (value.includes('LASER')) return 'LASER';
    if (value.includes('IMAX')) return 'IMAX';
    return 'GENERAL';
  }

  async function loadMovies() {
    const response = await readApi('/movies');
    if (!Array.isArray(response)) return [];

    return response
      .filter((movie) => String(movie.status || '').toUpperCase() === 'ACTIVE')
      .filter((movie) => String(movie.hide || 'N').toUpperCase() === 'N')
      .sort((a, b) => toInt(a.movie_id) - toInt(b.movie_id));
  }

  function normalizeBootstrap(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};

    const theaters = Array.isArray(source.theaters) ? source.theaters.map((item, index) => ({
      theater_id: toInt(item.theater_id || index + 1),
      region_name: String(item.region_name || item.region || '서울').trim() || '서울',
      theater_name: String(item.theater_name || item.name || item.address || `극장 ${index + 1}`).trim() || `극장 ${index + 1}`,
      address: String(item.address || '').trim()
    })) : [];

    const halls = Array.isArray(source.halls) ? source.halls.map((item, index) => ({
      hall_id: toInt(item.hall_id || index + 1),
      theater_id: toInt(item.theater_id),
      hall_name: String(item.hall_name || item.name || 'A관').trim() || 'A관',
      total_seats: Math.max(1, toInt(item.total_seats || DEFAULT_SEAT_ROWS * DEFAULT_SEAT_COLS)),
      seat_rows: Math.max(1, toInt(item.seat_rows || DEFAULT_SEAT_ROWS)),
      seat_cols: Math.max(1, toInt(item.seat_cols || DEFAULT_SEAT_COLS))
    })) : [];

    const schedules = Array.isArray(source.schedules) ? source.schedules.map((item, index) => ({
      schedule_id: toInt(item.schedule_id || index + 1),
      movie_id: toInt(item.movie_id),
      hall_id: toInt(item.hall_id),
      show_date: String(item.show_date || '').trim(),
      total_count: Math.max(0, toInt(item.total_count || item.total_seats || DEFAULT_SEAT_ROWS * DEFAULT_SEAT_COLS)),
      remain_count: Math.max(0, toInt(item.remain_count || item.total_count || item.total_seats || DEFAULT_SEAT_ROWS * DEFAULT_SEAT_COLS)),
      status: String(item.status || 'OPEN').toUpperCase(),
      price: Math.max(0, toInt(item.price || 14000)),
      special_tag: String(item.special_tag || '').trim().toUpperCase(),
      __demo: Boolean(item.__demo)
    })) : [];

    const reservedSeats = {};
    const sourceReserved = source.reservedSeats && typeof source.reservedSeats === 'object' ? source.reservedSeats : {};

    Object.keys(sourceReserved).forEach((key) => {
      reservedSeats[String(key)] = Array.isArray(sourceReserved[key]) ? sourceReserved[key].map((value) => String(value)) : [];
    });

    return { theaters, halls, schedules, reservedSeats };
  }

  function buildDemoDataset(movies) {
    const theaters = [
      { theater_id: 1, region_name: '서울', theater_name: '노원', address: '서울특별시 노원구 상계동' },
      { theater_id: 2, region_name: '서울', theater_name: '가양', address: '서울특별시 강서구 가양동' },
      { theater_id: 3, region_name: '경기/인천', theater_name: '부천', address: '경기도 부천시 중동' }
    ];

    const halls = [
      { hall_id: 1, theater_id: 1, hall_name: 'A관 Atmos', total_seats: 30, seat_rows: 3, seat_cols: 10 },
      { hall_id: 2, theater_id: 1, hall_name: 'B관 LASER', total_seats: 30, seat_rows: 3, seat_cols: 10 },
      { hall_id: 3, theater_id: 2, hall_name: 'A관', total_seats: 30, seat_rows: 3, seat_cols: 10 },
      { hall_id: 4, theater_id: 3, hall_name: 'A관', total_seats: 30, seat_rows: 3, seat_cols: 10 }
    ];

    const chosenMovies = movies.slice(0, Math.min(movies.length, 6));
    const schedules = [];
    const reservedSeats = {};
    let sequence = 100001;

    chosenMovies.forEach((movie, movieIndex) => {
      halls.forEach((hall, hallIndex) => {
        for (let offset = 0; offset < 7; offset += 1) {
          const target = new Date();
          target.setHours(0, 0, 0, 0);
          target.setDate(target.getDate() + offset);

          [11, 14, 19, 21].forEach((hour, timeIndex) => {
            if ((movieIndex + hallIndex + offset + timeIndex) % 2 !== 0) return;

            target.setHours(hour, timeIndex % 2 === 0 ? 0 : 30, 0, 0);

            const remainCount = 30 - ((movieIndex + hallIndex + offset + timeIndex) % 6);
            const scheduleId = sequence;
            sequence += 1;

            schedules.push({
              schedule_id: scheduleId,
              movie_id: toInt(movie.movie_id),
              hall_id: hall.hall_id,
              show_date: `${target.getFullYear()}-${pad2(target.getMonth() + 1)}-${pad2(target.getDate())} ${pad2(target.getHours())}:${pad2(target.getMinutes())}:00`,
              total_count: 30,
              remain_count: remainCount,
              status: 'OPEN',
              price: 14000,
              special_tag: buildSpecialTag(hall.hall_name),
              __demo: true
            });

            reservedSeats[String(scheduleId)] = [];
            const reservedCount = Math.max(0, 30 - remainCount);
            for (let seatIndex = 0; seatIndex < reservedCount; seatIndex += 1) {
              const row = Math.floor(seatIndex / 10) + 1;
              const col = (seatIndex % 10) + 1;
              reservedSeats[String(scheduleId)].push(`${row}-${col}`);
            }
          });
        }
      });
    });

    return { theaters, halls, schedules, reservedSeats };
  }

  async function loadDataset(movies) {
    if (typeof window.THEATERS_BOOKING_DATA_PROVIDER === 'function') {
      const provided = await window.THEATERS_BOOKING_DATA_PROVIDER();
      return normalizeBootstrap(provided);
    }

    if (window.THEATERS_BOOKING_BOOTSTRAP) {
      return normalizeBootstrap(window.THEATERS_BOOKING_BOOTSTRAP);
    }

    return buildDemoDataset(movies);
  }

  function getRegions(dataset) {
    const regionMap = new Map();
    dataset.theaters.forEach((theater) => {
      const key = theater.region_name || '서울';
      const count = regionMap.get(key) || 0;
      regionMap.set(key, count + 1);
    });

    return Array.from(regionMap.entries()).map(([name, count]) => ({ name, count }));
  }

  function getTheatersByRegion(dataset, regionName) {
    return dataset.theaters.filter((theater) => theater.region_name === regionName);
  }

  function getHallById(dataset, hallId) {
    return dataset.halls.find((item) => item.hall_id === hallId) || null;
  }

  function getTheaterById(dataset, theaterId) {
    return dataset.theaters.find((item) => item.theater_id === theaterId) || null;
  }

  function getMovieById(movieId) {
    return state.movies.find((item) => toInt(item.movie_id) === toInt(movieId)) || null;
  }

  function getTheaterSchedules(dataset, theaterId) {
    const hallIds = dataset.halls.filter((hall) => hall.theater_id === theaterId).map((hall) => hall.hall_id);
    return dataset.schedules.filter((schedule) => hallIds.includes(schedule.hall_id));
  }

  function getSchedulesForSelection() {
    if (!state.dataset || !state.selectedTheaterId || !state.selectedMovieId || !state.selectedDateKey) return [];

    return getTheaterSchedules(state.dataset, state.selectedTheaterId)
      .filter((schedule) => toInt(schedule.movie_id) === toInt(state.selectedMovieId))
      .filter((schedule) => toDateKey(schedule.show_date) === state.selectedDateKey)
      .filter((schedule) => String(schedule.status || '').toUpperCase() === 'OPEN')
      .filter((schedule) => {
        const hall = getHallById(state.dataset, schedule.hall_id);
        const specialTag = String(schedule.special_tag || buildSpecialTag(hall && hall.hall_name)).toUpperCase();
        if (state.selectedSpecial === 'ALL') return true;
        if (state.selectedSpecial === 'GENERAL') return specialTag === 'GENERAL';
        return specialTag === state.selectedSpecial;
      })
      .filter((schedule) => {
        if (state.selectedTimeBand === 'ALL') return true;
        return getTimeBand(schedule.show_date) === state.selectedTimeBand;
      })
      .sort((a, b) => parseDateValue(a.show_date) - parseDateValue(b.show_date));
  }

  function getAvailableMovies(dataset, theaterId) {
    const movieIds = new Set(getTheaterSchedules(dataset, theaterId).map((schedule) => toInt(schedule.movie_id)));
    return state.movies.filter((movie) => movieIds.has(toInt(movie.movie_id)));
  }

  function getAvailableDateKeys(dataset, theaterId, movieId) {
    const dateSet = new Set();

    getTheaterSchedules(dataset, theaterId)
      .filter((schedule) => toInt(schedule.movie_id) === toInt(movieId))
      .filter((schedule) => String(schedule.status || '').toUpperCase() === 'OPEN')
      .forEach((schedule) => {
        const key = toDateKey(schedule.show_date);
        if (key) dateSet.add(key);
      });

    return Array.from(dateSet).sort();
  }

  function ensureStateDefaults() {
    const dataset = state.dataset;
    if (!dataset) return;

    const regions = getRegions(dataset);
    if (!regions.length) return;

    if (!state.selectedRegion || !regions.some((item) => item.name === state.selectedRegion)) {
      state.selectedRegion = regions[0].name;
    }

    const theaters = getTheatersByRegion(dataset, state.selectedRegion);
    if (!theaters.length) return;

    if (!state.selectedTheaterId || !theaters.some((item) => item.theater_id === state.selectedTheaterId)) {
      state.selectedTheaterId = theaters[0].theater_id;
    }

    const movies = getAvailableMovies(dataset, state.selectedTheaterId);
    if (movies.length) {
      if (!state.selectedMovieId || !movies.some((item) => toInt(item.movie_id) === toInt(state.selectedMovieId))) {
        state.selectedMovieId = toInt(movies[0].movie_id);
      }
    } else {
      state.selectedMovieId = null;
    }

    const dateKeys = state.selectedMovieId ? getAvailableDateKeys(dataset, state.selectedTheaterId, state.selectedMovieId) : [];
    if (dateKeys.length) {
      if (!state.selectedDateKey || !dateKeys.includes(state.selectedDateKey)) {
        const todayKey = toDateKey(new Date());
        state.selectedDateKey = dateKeys.includes(todayKey) ? todayKey : dateKeys[0];
      }
    } else {
      state.selectedDateKey = '';
    }
  }

  function buildLayoutHtml() {
    const selectedTheater = state.selectedTheaterId ? getTheaterById(state.dataset, state.selectedTheaterId) : null;
    const selectedMovie = state.selectedMovieId ? getMovieById(state.selectedMovieId) : null;
    const selectedDateInfo = formatDayLabel(state.selectedDateKey);

    return `
      <div class="theaters-booking-page">
        <aside class="theaters-booking-stepbar">
          <div class="theaters-booking-step is-active">
            <span class="theaters-booking-step-no">01</span>
            <span class="theaters-booking-step-label">상영시간</span>
          </div>
          <div class="theaters-booking-step">
            <span class="theaters-booking-step-no">02</span>
            <span class="theaters-booking-step-label">인원/좌석</span>
          </div>
          <div class="theaters-booking-step">
            <span class="theaters-booking-step-no">03</span>
            <span class="theaters-booking-step-label">결제</span>
          </div>
          <div class="theaters-booking-step">
            <span class="theaters-booking-step-no">04</span>
            <span class="theaters-booking-step-label">결제완료</span>
          </div>
        </aside>

        <section class="theaters-booking-content">
          <div class="theaters-booking-topbar">
            <div class="theaters-booking-topcell">${escapeHtml(selectedTheater ? selectedTheater.theater_name : '극장')}</div>
            <div class="theaters-booking-topcell">${escapeHtml(selectedMovie ? selectedMovie.title : '영화')}</div>
            <div class="theaters-booking-topcell">${escapeHtml(selectedDateInfo ? `${selectedDateInfo.full}(${selectedDateInfo.week})` : '날짜')}</div>
          </div>

          <div class="theaters-booking-grid">
            <div class="theaters-booking-panel theaters-booking-region-panel"></div>
            <div class="theaters-booking-panel theaters-booking-theater-panel"></div>
            <div class="theaters-booking-panel theaters-booking-movie-panel"></div>
            <div class="theaters-booking-panel theaters-booking-date-panel"></div>
          </div>
        </section>
      </div>
    `;
  }

  function renderRegionPanel(container) {
    const regions = getRegions(state.dataset);

    container.innerHTML = `
      <div class="theaters-booking-panel-head">
        <button type="button" class="theaters-booking-tab is-active">전체</button>
      </div>
      <div class="theaters-booking-scroll theaters-booking-region-list"></div>
    `;

    const list = container.querySelector('.theaters-booking-region-list');

    regions.forEach((region) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `theaters-booking-list-button${region.name === state.selectedRegion ? ' is-active' : ''}`;
      button.innerHTML = `<span>${escapeHtml(region.name)}</span><span class="theaters-booking-list-count">(${region.count})</span>`;
      button.addEventListener('click', function () {
        state.selectedRegion = region.name;
        state.selectedTheaterId = null;
        state.selectedMovieId = null;
        state.selectedDateKey = '';
        state.selectedHallId = null;
        render();
      });
      list.appendChild(button);
    });
  }

  function renderTheaterPanel(container) {
    const theaters = getTheatersByRegion(state.dataset, state.selectedRegion);

    container.innerHTML = `
      <div class="theaters-booking-panel-head">
        <button type="button" class="theaters-booking-tab is-active">극장</button>
      </div>
      <div class="theaters-booking-scroll theaters-booking-theater-list"></div>
    `;

    const list = container.querySelector('.theaters-booking-theater-list');

    theaters.forEach((theater) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `theaters-booking-list-button${theater.theater_id === state.selectedTheaterId ? ' is-active' : ''}`;
      button.innerHTML = `
        <span>${escapeHtml(theater.theater_name)}</span>
        <span class="theaters-booking-check">${theater.theater_id === state.selectedTheaterId ? '✓' : ''}</span>
      `;
      button.addEventListener('click', function () {
        state.selectedTheaterId = theater.theater_id;
        state.selectedMovieId = null;
        state.selectedDateKey = '';
        state.selectedHallId = null;
        render();
      });
      list.appendChild(button);
    });
  }

  function renderMoviePanel(container) {
    const movies = state.selectedTheaterId ? getAvailableMovies(state.dataset, state.selectedTheaterId) : [];

    container.innerHTML = `
      <div class="theaters-booking-panel-head theaters-booking-panel-head-row">
        <select class="theaters-booking-select" id="theaters-booking-sort-select">
          <option value="ticketing">예매순</option>
        </select>
      </div>
      <div class="theaters-booking-scroll theaters-booking-movie-list"></div>
    `;

    const list = container.querySelector('.theaters-booking-movie-list');

    if (!movies.length) {
      list.innerHTML = '<div class="theaters-booking-empty">상영 가능한 영화가 없습니다.</div>';
      return;
    }

    movies.forEach((movie) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `theaters-booking-movie-button${toInt(movie.movie_id) === toInt(state.selectedMovieId) ? ' is-active' : ''}`;
      button.innerHTML = `
        <span class="theaters-booking-age">${escapeHtml(String(movie.runtime_minutes || 12).slice(0, 2).padStart(2, '0'))}</span>
        <span class="theaters-booking-movie-title">${escapeHtml(movie.title)}</span>
        <span class="theaters-booking-check">${toInt(movie.movie_id) === toInt(state.selectedMovieId) ? '✓' : ''}</span>
      `;
      button.addEventListener('click', function () {
        state.selectedMovieId = toInt(movie.movie_id);
        state.selectedDateKey = '';
        state.selectedHallId = null;
        render();
      });
      list.appendChild(button);
    });
  }

  function createDateButton(dateKey) {
    const info = formatDayLabel(dateKey);
    const todayKey = toDateKey(new Date());
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `theaters-booking-date-button${dateKey === state.selectedDateKey ? ' is-active' : ''}`;
    button.innerHTML = `
      <span class="theaters-booking-date-day">${info ? info.day : '-'}</span>
      <span class="theaters-booking-date-week">${info ? info.week : '-'}</span>
      <span class="theaters-booking-date-today">${dateKey === todayKey ? '오늘' : '&nbsp;'}</span>
    `;
    button.addEventListener('click', function () {
      state.selectedDateKey = dateKey;
      state.selectedHallId = null;
      render();
    });
    return button;
  }

  function createFilterButton(label, value, selectedValue, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `theaters-booking-filter-button${value === selectedValue ? ' is-active' : ''}`;
    button.textContent = label;
    button.addEventListener('click', function () {
      onClick(value);
    });
    return button;
  }

  async function openScheduleDetail(schedule) {
    const hall = getHallById(state.dataset, schedule.hall_id);
    const theater = hall ? getTheaterById(state.dataset, hall.theater_id) : null;
    const movie = getMovieById(schedule.movie_id);
    const reservedSeats = state.dataset.reservedSeats[String(schedule.schedule_id)] || [];

    await ensureDetailScript();

    if (typeof window.openTheatersDetail !== 'function') {
      throw new Error('openTheatersDetail이 없습니다.');
    }

    window.openTheatersDetail({
      schedule,
      hall,
      theater,
      movie,
      reservedSeats,
      onBooked(result) {
        const selectedSeats = Array.isArray(result && result.selectedSeats) ? result.selectedSeats : [];
        const seatStore = state.dataset.reservedSeats[String(schedule.schedule_id)] || [];
        selectedSeats.forEach((seatKey) => {
          if (!seatStore.includes(seatKey)) {
            seatStore.push(seatKey);
          }
        });
        state.dataset.reservedSeats[String(schedule.schedule_id)] = seatStore;
        schedule.remain_count = Math.max(0, toInt(schedule.remain_count) - selectedSeats.length);
        render();
      }
    });
  }

  function createScheduleCard(schedule) {
    const hall = getHallById(state.dataset, schedule.hall_id);
    const movie = getMovieById(schedule.movie_id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'theaters-booking-schedule-card';

    const rangeLabel = formatRangeLabel(schedule, movie);
    const specialTag = String(schedule.special_tag || buildSpecialTag(hall && hall.hall_name)).toUpperCase();

    button.innerHTML = `
      <div class="theaters-booking-schedule-time">${escapeHtml(rangeLabel)}</div>
      <div class="theaters-booking-schedule-meta">
        <span>${escapeHtml(hall ? hall.hall_name : '상영관')}</span>
        <span>${escapeHtml(specialTag === 'GENERAL' ? '일반관' : specialTag)}</span>
      </div>
      <div class="theaters-booking-schedule-remain">잔여좌석 ${escapeHtml(String(schedule.remain_count))} / ${escapeHtml(String(schedule.total_count))}</div>
    `;

    button.addEventListener('click', function () {
      openScheduleDetail(schedule).catch((error) => {
        console.error(error);
        alert(error.message || '상세 모달을 열지 못했습니다.');
      });
    });

    return button;
  }

  function renderDatePanel(container) {
    const dateKeys = state.selectedTheaterId && state.selectedMovieId
      ? getAvailableDateKeys(state.dataset, state.selectedTheaterId, state.selectedMovieId)
      : [];

    const schedules = getSchedulesForSelection();
    const selectedInfo = formatDayLabel(state.selectedDateKey);
    const monthLabel = state.selectedDateKey ? formatMonthLabel(state.selectedDateKey) : '';

    container.innerHTML = `
      <div class="theaters-booking-date-header">
        <div class="theaters-booking-month">${escapeHtml(monthLabel)}</div>
        <div class="theaters-booking-date-strip"></div>
      </div>
      <div class="theaters-booking-date-filters"></div>
      <div class="theaters-booking-date-divider"></div>
      <div class="theaters-booking-schedule-area"></div>
    `;

    const strip = container.querySelector('.theaters-booking-date-strip');
    const filters = container.querySelector('.theaters-booking-date-filters');
    const scheduleArea = container.querySelector('.theaters-booking-schedule-area');

    dateKeys.forEach((dateKey) => {
      strip.appendChild(createDateButton(dateKey));
    });

    const specialButtons = [
      { label: '전체', value: 'ALL' },
      { label: '일반관', value: 'GENERAL' },
      { label: 'Atmos', value: 'ATMOS' },
      { label: 'LASER', value: 'LASER' }
    ];

    const timeButtons = [
      { label: '전체', value: 'ALL' },
      { label: '13시 이후', value: 'AFTER_13' },
      { label: '19시 이후', value: 'AFTER_19' },
      { label: '심야', value: 'LATE' }
    ];

    const specialWrap = document.createElement('div');
    specialWrap.className = 'theaters-booking-filter-group';
    specialButtons.forEach((item) => {
      specialWrap.appendChild(createFilterButton(item.label, item.value, state.selectedSpecial, function (value) {
        state.selectedSpecial = value;
        render();
      }));
    });

    const timeWrap = document.createElement('div');
    timeWrap.className = 'theaters-booking-filter-group';
    timeButtons.forEach((item) => {
      timeWrap.appendChild(createFilterButton(item.label, item.value, state.selectedTimeBand, function (value) {
        state.selectedTimeBand = value;
        render();
      }));
    });

    filters.appendChild(specialWrap);
    filters.appendChild(timeWrap);

    if (!dateKeys.length) {
      scheduleArea.innerHTML = '<div class="theaters-booking-empty-large">조회 가능한 날짜가 없습니다.</div>';
      return;
    }

    if (!schedules.length) {
      scheduleArea.innerHTML = `
        <div class="theaters-booking-empty-large">
          <div class="theaters-booking-empty-icon">◌</div>
          <div>조회 가능한 상영시간이 없습니다.</div>
          <div>조건을 변경해주세요.</div>
        </div>
      `;
      return;
    }

    const groupMap = new Map();
    schedules.forEach((schedule) => {
      const hall = getHallById(state.dataset, schedule.hall_id);
      const key = hall ? hall.hall_name : '상영관';
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key).push(schedule);
    });

    groupMap.forEach((items, hallName) => {
      const group = document.createElement('section');
      group.className = 'theaters-booking-schedule-group';
      group.innerHTML = `
        <div class="theaters-booking-schedule-group-title">${escapeHtml(selectedInfo ? `${selectedInfo.full}(${selectedInfo.week})` : '')} · ${escapeHtml(hallName)}</div>
        <div class="theaters-booking-schedule-list"></div>
      `;

      const list = group.querySelector('.theaters-booking-schedule-list');
      items.forEach((schedule) => {
        list.appendChild(createScheduleCard(schedule));
      });
      scheduleArea.appendChild(group);
    });
  }

  function render() {
    ensureStateDefaults();

    const mount = ensureMountPoint();
    mount.innerHTML = buildLayoutHtml();

    renderRegionPanel(mount.querySelector('.theaters-booking-region-panel'));
    renderTheaterPanel(mount.querySelector('.theaters-booking-theater-panel'));
    renderMoviePanel(mount.querySelector('.theaters-booking-movie-panel'));
    renderDatePanel(mount.querySelector('.theaters-booking-date-panel'));
  }

  async function mountTheatersMain() {
    await ensureMainCss();

    if (window.APP_RUNTIME && typeof window.APP_RUNTIME.prefetchScripts === 'function') {
      window.APP_RUNTIME.prefetchScripts([THEATERS_DETAIL_SCRIPT_PATH]);
    }

    clearPrimarySections();
    const mount = ensureMountPoint();
    mount.innerHTML = '<div class="theaters-booking-page"><div class="theaters-booking-loading">예매 화면을 불러오는 중...</div></div>';

    try {
      state.movies = await loadMovies();
      state.dataset = await loadDataset(state.movies);
      render();
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } catch (error) {
      console.error(error);
      mount.innerHTML = '<div class="theaters-booking-page"><div class="theaters-booking-error">예매 화면을 불러오지 못했습니다.</div></div>';
    }
  }

  window.openTheatersMain = mountTheatersMain;
})();
