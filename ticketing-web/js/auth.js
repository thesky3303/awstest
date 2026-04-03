async function signup() {
  const name = document.getElementById('signup-name').value.trim();
  const phone = document.getElementById('signup-phone').value.trim();
  const password = document.getElementById('signup-password').value.trim();

  if (!name || !phone || !password) {
    document.getElementById('signup-result').innerText = '입력값을 확인하세요';
    return;
  }

  try {
    const result = await writeApi('/signup', 'POST', {
      name,
      phone,
      password
    });

    document.getElementById('signup-result').innerText = result.message || '회원가입 완료';
  } catch (e) {
    console.error(e);
    document.getElementById('signup-result').innerText = e.message || '회원가입 실패';
  }
}

async function login() {
  const phone = document.getElementById('login-phone').value.trim();
  const password = document.getElementById('login-password').value.trim();

  if (!phone || !password) {
    document.getElementById('login-result').innerText = '입력값을 확인하세요';
    return;
  }

  try {
    const result = await writeApi('/login', 'POST', {
      phone,
      password
    });

    if (result.user) {
      localStorage.setItem('loginUser', JSON.stringify(result.user));
    }

    document.getElementById('login-result').innerText =
      `${result.message || '로그인 완료'} / 사용자ID: ${result.user?.user_id ?? '-'}`;
  } catch (e) {
    console.error(e);
    document.getElementById('login-result').innerText = e.message || '로그인 실패';
  }
}