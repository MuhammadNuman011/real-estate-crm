import axios from 'axios';
import { getCookie } from 'cookies-next';
import { authSessionKey } from '@/context/useAuthContext';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json'
  }
});

client.interceptors.request.use(config => {
  const raw = getCookie(authSessionKey)?.toString();
  if (!raw) return config;
  try {
    const session = JSON.parse(raw);
    if (session?.token) {
      config.headers.Authorization = `Bearer ${session.token}`;
    }
  } catch {
    return config;
  }
  return config;
});

function HttpClient() {
  return {
    get: (url, config) => client.get(url, config),
    post: (url, data, config) => client.post(url, data, config),
    patch: (url, data, config) => client.patch(url, data, config),
    put: (url, data, config) => client.put(url, data, config),
    delete: (url, config) => client.delete(url, config)
  };
}
export default HttpClient();