const WRITE_API_BASE = '/api/write';

async function writeApi(path, method = 'POST', data = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (data !== null) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`${WRITE_API_BASE}${path}`, options);

  if (!response.ok) {
    let errorMessage = `WRITE API 오류: ${response.status}`;

    try {
      const errorData = await response.json();
      if (errorData && errorData.message) {
        errorMessage = errorData.message;
      }
    } catch (e) {
      console.error(e);
    }

    throw new Error(errorMessage);
  }

  return await response.json();
}