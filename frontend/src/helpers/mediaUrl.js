const apiOrigin = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function mediaUrl(storedPath) {
  if (typeof storedPath !== 'string' || !storedPath) return '';
  if (!storedPath.startsWith('/uploads/')) return storedPath;
  return apiOrigin + '/api' + storedPath;
}
