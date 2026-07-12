import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('studyrandom_token_v2') || localStorage.getItem('studyrandom_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('studyrandom_token_v2');
      localStorage.removeItem('studyrandom_token');
      localStorage.removeItem('studyrandom_user_v2');
      localStorage.removeItem('studyrandom_user');
      window.dispatchEvent(new Event('studyrandom:auth-expired'));
    }
    return Promise.reject(error);
  }
);

export default api;
