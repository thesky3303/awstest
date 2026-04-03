(function () {
  const BODY_CSS_PATH = '/css/main/body.css';
  const AUTO_SLIDE_INTERVAL = 5000;

  let sliderData = [];
  let currentIndex = 0;
  let autoSlideTimer = null;

  function ensureBodyCss() {
    const exists = document.querySelector(`link[href="${BODY_CSS_PATH}"]`);
    if (exists) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = BODY_CSS_PATH;
    document.head.appendChild(link);
  }

  function ensureMountPoint() {
    let mount = document.getElementById('main-body');
    if (mount) return mount;

    mount = document.createElement('div');
    mount.id = 'main-body';

    const siteHeader = document.getElementById('site-header');
    if (siteHeader && siteHeader.nextSibling) {
      siteHeader.parentNode.insertBefore(mount, siteHeader.nextSibling);
    } else {
      document.body.appendChild(mount);
    }

    return mount;
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

  function extractFileName(path) {
    if (!path) return '';
    const normalized = String(path).replaceAll('\\', '/');
    const parts = normalized.split('/');
    return parts[parts.length - 1] || '';
  }

  function resolveMainPosterUrl(url) {
    if (!url) return '';

    const value = String(url).trim();
    if (!value) return '';

    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }

    if (value.startsWith('/images/')) {
      return value;
    }

    if (value.includes('/mnt/hgfs/')) {
      return `/images/${extractFileName(value)}`;
    }

    if (value.includes('/images/')) {
      return `/images/${extractFileName(value)}`;
    }

    if (value.includes('/')) {
      return `/images/${extractFileName(value)}`;
    }

    return `/images/${value}`;
  }

  function goToMovieDetail(movieId) {
    if (!movieId) return;
    window.location.href = `/movie/detail.html?movie_id=${movieId}`;
  }

  function stopAutoSlide() {
    if (autoSlideTimer) {
      clearInterval(autoSlideTimer);
      autoSlideTimer = null;
    }
  }

  function startAutoSlide() {
    stopAutoSlide();

    if (!sliderData || sliderData.length <= 1) return;

    autoSlideTimer = setInterval(() => {
      currentIndex = (currentIndex + 1) % sliderData.length;
      renderCurrentSlide();
    }, AUTO_SLIDE_INTERVAL);
  }

  function renderIndicators() {
    const indicatorWrap = document.getElementById('main-hero-indicators');
    if (!indicatorWrap) return;

    indicatorWrap.innerHTML = '';

    sliderData.forEach((_, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `main-hero-indicator ${index === currentIndex ? 'active' : ''}`;
      button.setAttribute('aria-label', `${index + 1}번 슬라이드 보기`);
      button.addEventListener('click', () => {
        currentIndex = index;
        renderCurrentSlide();
        startAutoSlide();
      });
      indicatorWrap.appendChild(button);
    });
  }

  function renderCurrentSlide() {
    if (!sliderData.length) return;

    const movie = sliderData[currentIndex];
    const hero = document.getElementById('main-hero');
    const title = document.getElementById('main-hero-title');
    const rank = document.getElementById('main-hero-rank');
    const meta = document.getElementById('main-hero-meta');
    const desc = document.getElementById('main-hero-desc');
    const cta = document.getElementById('main-hero-cta');

    if (!hero || !title || !rank || !meta || !desc || !cta) return;

    const bgUrl = resolveMainPosterUrl(movie.main_poster_url || movie.poster_url || '');

    hero.style.backgroundImage = bgUrl
      ? `url('${bgUrl}')`
      : 'none';

    title.textContent = movie.title || '-';
    rank.textContent = `TOP ${currentIndex + 1}`;
    meta.textContent = [
      movie.genre || '장르 미정',
      movie.release_date || '개봉일 미정',
      `누적관객 ${Number(movie.audience_count || 0).toLocaleString()}명`
    ].join(' | ');
    desc.textContent = movie.synopsis || '상세 줄거리가 준비 중입니다.';

    cta.onclick = () => goToMovieDetail(movie.movie_id);

    renderIndicators();
  }

  function moveSlide(direction) {
    if (!sliderData.length) return;

    if (direction === 'prev') {
      currentIndex = (currentIndex - 1 + sliderData.length) % sliderData.length;
    } else {
      currentIndex = (currentIndex + 1) % sliderData.length;
    }

    renderCurrentSlide();
    startAutoSlide();
  }

  function createHeroLayout() {
    const section = document.createElement('section');
    section.className = 'main-hero-section';

    section.innerHTML = `
      <div id="main-hero" class="main-hero">
        <div class="main-hero-top-fade"></div>
        <div class="main-hero-bottom-fade"></div>
        <div class="main-hero-dark-layer"></div>

        <button type="button" class="main-hero-arrow main-hero-arrow-left" aria-label="이전 영화 보기">&lt;</button>

        <div class="main-hero-content">
          <div id="main-hero-rank" class="main-hero-rank">TOP 1</div>
          <h2 id="main-hero-title" class="main-hero-title">영화 제목</h2>
          <div id="main-hero-meta" class="main-hero-meta"></div>
          <p id="main-hero-desc" class="main-hero-desc"></p>

          <div class="main-hero-buttons">
            <button type="button" id="main-hero-cta" class="main-hero-detail-button">상세보기</button>
          </div>
        </div>

        <button type="button" class="main-hero-arrow main-hero-arrow-right" aria-label="다음 영화 보기">&gt;</button>

        <div id="main-hero-indicators" class="main-hero-indicators"></div>
      </div>
    `;

    const leftArrow = section.querySelector('.main-hero-arrow-left');
    const rightArrow = section.querySelector('.main-hero-arrow-right');
    const hero = section.querySelector('#main-hero');

    leftArrow.addEventListener('click', () => moveSlide('prev'));
    rightArrow.addEventListener('click', () => moveSlide('next'));

    hero.addEventListener('mouseenter', () => {
      hero.classList.add('hovered');
      stopAutoSlide();
    });

    hero.addEventListener('mouseleave', () => {
      hero.classList.remove('hovered');
      startAutoSlide();
    });

    hero.addEventListener('click', (e) => {
      const target = e.target;
      if (target.closest('.main-hero-arrow')) return;
      if (target.closest('.main-hero-detail-button')) return;

      const movie = sliderData[currentIndex];
      if (movie && movie.movie_id) {
        goToMovieDetail(movie.movie_id);
      }
    });

    return section;
  }

  async function loadMainMovies() {
    const response = await readApi('/movies');
    if (!Array.isArray(response)) return [];

    return response
      .filter(movie => movie.status === 'ACTIVE')
      .sort((a, b) => Number(b.audience_count || 0) - Number(a.audience_count || 0))
      .slice(0, 4);
  }

  async function mountBody() {
    ensureBodyCss();

    const mount = ensureMountPoint();
    mount.innerHTML = `
      <div class="main-body-wrap">
        <div class="main-body-loading">메인 영화를 불러오는 중...</div>
      </div>
    `;

    try {
      sliderData = await loadMainMovies();
      currentIndex = 0;

      if (!sliderData.length) {
        mount.innerHTML = `
          <div class="main-body-wrap">
            <div class="main-body-empty">표시할 메인 영화가 없습니다.</div>
          </div>
        `;
        return;
      }

      mount.innerHTML = '';
      mount.appendChild(createHeroLayout());

      renderCurrentSlide();
      startAutoSlide();
    } catch (e) {
      console.error(e);
      mount.innerHTML = `
        <div class="main-body-wrap">
          <div class="main-body-error">메인 영화 영역을 불러오지 못했습니다.</div>
        </div>
      `;
    }
  }

  window.renderMainBody = mountBody;
  window.goToMovieDetail = goToMovieDetail;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountBody);
  } else {
    mountBody();
  }
})();