const WRITE_API_BASE = '/api/write';

async function writeApi(path, method = 'POST', data = null, options = {}) {
  const runtime = window.APP_RUNTIME;
  const targetPath = `${WRITE_API_BASE}${path}`;

  if (runtime && typeof runtime.requestJson === 'function') {
    return runtime.requestJson(targetPath, {
      ...(options || {}),
      method,
      body: data
    });
  }

  const fetchOptions = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (data !== null) {
    fetchOptions.body = JSON.stringify(data);
  }

  const response = await fetch(targetPath, fetchOptions);

  if (!response.ok) {
    let errorMessage = `WRITE API 오류: ${response.status}`;

    try {
      const errorData = await response.json();
      if (errorData && errorData.message) {
        errorMessage = errorData.message;
      }
    } catch (error) {
      console.error(error);
    }

    throw new Error(errorMessage);
  }

  return await response.json();
}
