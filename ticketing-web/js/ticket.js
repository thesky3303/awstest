function extractFileName(path) {
  if (!path) return '';
  const normalized = String(path).replaceAll('\\', '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || '';
}

function resolvePosterUrl(posterUrl) {
  if (!posterUrl) return '/images/no-image.png';

  const value = String(posterUrl).trim();

  if (!value) return '/images/no-image.png';

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  if (value.startsWith('/images/')) {
    return value;
  }

  if (value.includes('/mnt/hgfs/ticketing-db/images/')) {
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

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatSchedules(schedules) {
  if (!Array.isArray(schedules) || schedules.length === 0) {
    return '<div>상영 정보 없음</div>';
  }

  return schedules.map(schedule => `
    <div class="schedule-item">
      상영 ID: ${schedule.schedule_id}<br>
      상영일시: ${schedule.show_date}<br>
      총 좌석: ${schedule.total_count}<br>
      남은 좌석: ${schedule.remain_count}<br>
      상태: ${schedule.status}
    </div>
  `).join('');
}

function formatReviews(reviews) {
  if (!Array.isArray(reviews) || reviews.length === 0) {
    return '<div>리뷰 없음</div>';
  }

  return reviews.map(review => `
    <div class="review-item">
      리뷰 ID: ${review.review_id}<br>
      작성자: ${escapeHtml(review.user_name || `user-${review.user_id}`)}<br>
      평점: ${review.rating}<br>
      내용: ${escapeHtml(review.content)}<br>
      작성일: ${review.created_at}
    </div>
  `).join('');
}

async function loadMovies() {
  const list = document.getElementById('ticket-list');
  list.innerHTML = '불러오는 중...';

  try {
    const movies = await readApi('/movies');
    list.innerHTML = '';

    if (!Array.isArray(movies) || movies.length === 0) {
      list.innerHTML = '등록된 영화가 없습니다';
      return;
    }

    for (const movie of movies) {
      let detail = { schedules: [], reviews: [] };

      try {
        detail = await readApi(`/movie/${movie.movie_id}`);
      } catch (detailError) {
        console.error(detailError);
      }

      const div = document.createElement('div');
      div.className = 'ticket-item';
      div.innerHTML = `
        <strong>${escapeHtml(movie.title)}</strong><br>
        영화 ID: ${movie.movie_id}<br>
        장르: ${escapeHtml(movie.genre || '-')}<br>
        감독: ${escapeHtml(movie.director || '-')}<br>
        개봉일: ${movie.release_date || '-'}<br>
        다음 상영: ${movie.next_show_date || '-'}<br>
        남은 좌석 합계: ${movie.total_remain_count ?? 0}<br>
        상태: ${escapeHtml(movie.status || '-')}<br>
        <img src="${resolvePosterUrl(movie.poster_url)}" alt="${escapeHtml(movie.title)}" width="150"><br>
        줄거리: ${escapeHtml(movie.synopsis || '-')}<br><br>
        <strong>상영 목록</strong><br>
        ${formatSchedules(detail.schedules)}<br>
        <strong>리뷰 목록</strong><br>
        ${formatReviews(detail.reviews)}
      `;

      list.appendChild(div);
    }
  } catch (e) {
    console.error(e);
    list.innerHTML = '영화 목록 조회 실패';
  }
}

function loadTickets() {
  loadMovies();
}