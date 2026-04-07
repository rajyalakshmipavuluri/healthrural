const hostname = window.location.hostname || 'localhost';
const API_URL = `http://${hostname}:5000/api`;

const api = {
  // Helpers
  getToken: () => localStorage.getItem('token'),
  setToken: (token) => localStorage.setItem('token', token),
  removeToken: () => localStorage.removeItem('token'),
  getUser: () => JSON.parse(localStorage.getItem('user') || 'null'),
  setUser: (user) => localStorage.setItem('user', JSON.stringify(user)),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
  },

  // Auth api calls
  login: async (email, password) => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      return await res.json();
    } catch (err) {
      return { message: 'Network error. Could not connect to API.' };
    }
  },

  register: async (name, email, password, role) => {
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      });
      return await res.json();
    } catch (err) {
      return { message: 'Network error. Could not connect to API.' };
    }
  },

  // Articles & Tips
  getArticles: async () => {
    try {
      const res = await fetch(`${API_URL}/content/articles`);
      return await res.json();
    } catch (err) {
      return [];
    }
  },
  
  getTips: async () => {
    try {
      const res = await fetch(`${API_URL}/content/tips`);
      return await res.json();
    } catch (err) {
      return [];
    }
  },

  // Protected Requests wrapper
  request: async (endpoint, method = 'GET', body = null) => {
    try {
      const headers = {
        'Authorization': `Bearer ${api.getToken()}`
      };
      if (body) {
        headers['Content-Type'] = 'application/json';
      }

      const res = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
      });
      
      if (res.status === 401) {
        api.logout();
      }
      
      return await res.json();
    } catch (err) {
      return { message: 'Network error. Server might be offline.' };
    }
  }
};
