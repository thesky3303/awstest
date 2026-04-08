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
    const httpError = new Error(errorMessage);
    httpError.status = response.status;
    httpError.data = null;

    try {
      const errorData = await response.json();
      httpError.data = errorData;
      if (errorData && errorData.message) {
        errorMessage = errorData.message;
      }
    } catch (error) {
      console.error(error);
    }

    httpError.message = errorMessage;
    throw httpError;
  }

  return await response.json();
}
