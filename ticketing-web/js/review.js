async function createReview() {
  const user_id = Number(document.getElementById('review-user-id').value);
  const movie_id = Number(document.getElementById('review-movie-id').value);
  const rating = Number(document.getElementById('review-rating').value);
  const content = document.getElementById('review-content').value.trim();

  if (!user_id || !movie_id || !rating || !content) {
    document.getElementById('review-result').innerText = '입력값을 확인하세요';
    return;
  }

  try {
    const result = await writeApi('/review', 'POST', {
      user_id,
      movie_id,
      rating,
      content
    });

    document.getElementById('review-result').innerText = result.message || '리뷰 등록 완료';
  } catch (e) {
    console.error(e);
    document.getElementById('review-result').innerText = e.message || '리뷰 등록 실패';
  }
}