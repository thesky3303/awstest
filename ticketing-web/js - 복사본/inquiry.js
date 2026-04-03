async function createInquiry() {
  const user_id = Number(document.getElementById('inquiry-user-id').value);
  const title = document.getElementById('inquiry-title').value.trim();
  const content = document.getElementById('inquiry-content').value.trim();

  if (!user_id || !title || !content) {
    document.getElementById('inquiry-result').innerText = '입력값을 확인하세요';
    return;
  }

  try {
    const result = await writeApi('/inquiry', 'POST', {
      user_id,
      title,
      content
    });

    document.getElementById('inquiry-result').innerText = result.message || '문의 등록 완료';
  } catch (e) {
    console.error(e);
    document.getElementById('inquiry-result').innerText = e.message || '문의 등록 실패';
  }
}