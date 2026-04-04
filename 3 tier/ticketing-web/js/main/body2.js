(function () {
  const BODY2_CSS_PATH = '/css/main/body2.css';

  function ensureBody2Css() {
    const exists = document.querySelector(`link[href="${BODY2_CSS_PATH}"]`);
    if (exists) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = BODY2_CSS_PATH;
    document.head.appendChild(link);
  }

  function ensureMountPoint() {
    let mount = document.getElementById('main-body2');
    if (mount) return mount;

    mount = document.createElement('section');
    mount.id = 'main-body2';

    const mainBody = document.getElementById('main-body');
    if (mainBody && mainBody.parentNode) {
      if (mainBody.nextSibling) {
        mainBody.parentNode.insertBefore(mount, mainBody.nextSibling);
      } else {
        mainBody.parentNode.appendChild(mount);
      }
    } else {
      document.body.appendChild(mount);
    }

    return mount;
  }

  function extractFileName(path) {
    if (!path) return '';
    const normalized = String(path).replaceAll('\\', '/');
    const parts = normalized.split('/');
    return parts[parts.length - 1] || '';
  }

  function normalizeImageUrl(url) {
    if (!url) return '';

    const value = String(url).trim();
    if (!value) return '';

    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }

    if (value.startsWith('/')) {
      return value;
    }

    if (value.includes('/mnt/hgfs/')) {
      return `/images/${extractFileName(value)}`;
    }

    return `/${value}`;
  }

  function resolvePosterUrl(movie) {
    return normalizeImageUrl(movie.poster_url || '');
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

  function formatAudienceCount(value) {
    return Number(value || 0).toLocaleString();
  }

  function formatCurrentTimeLabel() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    return `${month}.${day} ${hours}:${minutes} 기준`;
  }

  function getTimeBadgeHtml() {
    return `
      <span class="main-body2-time-badge" aria-label="현재 시간 기준">
        <svg class="main-body2-time-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"></circle>
          <path d="M12 7.5v5l3.5 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
        <span class="main-body2-time-text">${formatCurrentTimeLabel()}</span>
      </span>
    `;
  }

  function goToMovieDetail(movieId) {
    if (!movieId) return;
    window.location.href = `/movie/detail.html?movie_id=${movieId}`;
  }

  async function loadRankedMovies() {
    const response = await readApi('/movies');
    if (!Array.isArray(response)) return [];

    return response
      .filter(movie => movie.status === 'ACTIVE')
      .sort((a, b) => Number(b.audience_count || 0) - Number(a.audience_count || 0))
      .slice(0, 4);
  }

  function createMovieCard(movie, index) {
    const rank = index + 1;
    const posterUrl = resolvePosterUrl(movie);

    const article = document.createElement('article');
    article.className = 'main-body2-card';
    article.addEventListener('click', () => goToMovieDetail(movie.movie_id));

    article.innerHTML = `
      <div class="main-body2-poster-wrap">
        <img
          class="main-body2-poster"
          src="${posterUrl}"
          alt="${escapeHtml(movie.title)}"
          loading="lazy"
        >
        <div class="main-body2-rank">${rank}</div>
      </div>

      <div class="main-body2-info">
        <div class="main-body2-title">${escapeHtml(movie.title)}</div>
        <div class="main-body2-meta">누적관객 ${formatAudienceCount(movie.audience_count)}명</div>
      </div>
    `;

    const img = article.querySelector('.main-body2-poster');
    img.onerror = function () {
      this.src = '/images/no-image.png';
    };

    return article;
  }

  async function mountBody2() {
    ensureBody2Css();

    const mount = ensureMountPoint();
    mount.innerHTML = `
      <div class="main-body2-wrap">
        <div class="main-body2-loading">영화 순위를 불러오는 중...</div>
      </div>
    `;

    try {
      const movies = await loadRankedMovies();

      if (!movies.length) {
        mount.innerHTML = `
          <div class="main-body2-wrap">
            <div class="main-body2-empty">표시할 순위 영화가 없습니다.</div>
          </div>
        `;
        return;
      }

      const wrap = document.createElement('div');
      wrap.className = 'main-body2-wrap';

      const section = document.createElement('section');
      section.className = 'main-body2-section';

      const header = document.createElement('div');
      header.className = 'main-body2-header';
      header.innerHTML = `
        <h3 class="main-body2-heading">인기 영화</h3>
        ${getTimeBadgeHtml()}
      `;

      const grid = document.createElement('div');
      grid.className = 'main-body2-grid';

      movies.forEach((movie, index) => {
        grid.appendChild(createMovieCard(movie, index));
      });

      section.appendChild(header);
      section.appendChild(grid);
      wrap.appendChild(section);

      mount.innerHTML = '';
      mount.appendChild(wrap);
    } catch (e) {
      console.error(e);
      mount.innerHTML = `
        <div class="main-body2-wrap">
          <div class="main-body2-error">영화 순위 영역을 불러오지 못했습니다.</div>
        </div>
      `;
    }
  }

  window.renderMainBody2 = mountBody2;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountBody2);
  } else {
    mountBody2();
  }
})();