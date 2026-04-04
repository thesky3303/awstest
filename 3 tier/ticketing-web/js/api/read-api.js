const READ_API_BASE = '/api/read';

async function readApi(path) {
  const response = await fetch(`${READ_API_BASE}${path}`);

  if (!response.ok) {
    throw new Error(`READ API 오류: ${response.status}`);
  }

  return await response.json();
}