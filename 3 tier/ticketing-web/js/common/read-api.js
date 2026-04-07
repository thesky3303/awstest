const READ_API_BASE = '/api/read';

async function readApi(path, options = {}) {
  const runtime = window.APP_RUNTIME;
  const targetPath = `${READ_API_BASE}${path}`;

  if (runtime && typeof runtime.getJson === 'function') {
    return runtime.getJson(targetPath, options);
  }

  const response = await fetch(targetPath, {
    method: 'GET',
    credentials: 'include',
    cache: options.cache || 'default'
  });

  if (!response.ok) {
    throw new Error(`READ API 오류: ${response.status}`);
  }

  return await response.json();
}
