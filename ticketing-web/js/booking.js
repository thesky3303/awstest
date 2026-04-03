async function createBooking() {
  const user_id = Number(document.getElementById('booking-user-id').value);
  const schedule_id = Number(document.getElementById('booking-schedule-id').value);
  const req_count = Number(document.getElementById('booking-count').value);

  if (!user_id || !schedule_id || !req_count) {
    document.getElementById('booking-result').innerText = '입력값을 확인하세요';
    return;
  }

  try {
    const result = await writeApi('/booking', 'POST', {
      user_id,
      schedule_id,
      req_count
    });

    document.getElementById('booking-result').innerText =
      `${result.message || '예매 완료'} / 예매ID: ${result.booking_id ?? '-'}`;
  } catch (e) {
    console.error(e);
    document.getElementById('booking-result').innerText = e.message || '예매 실패';
  }
}