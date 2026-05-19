import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('meditrack_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('meditrack_token');
      localStorage.removeItem('meditrack_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/profile')
};

// Manufacturer
export const manufacturerAPI = {
  getProducts: () => api.get('/manufacturer/products'),
  registerProduct: (data) => api.post('/manufacturer/products', data),
  generateSerials: (data) => api.post('/manufacturer/generate', data),
  getBatches: (productId) => api.get(`/manufacturer/batches/${productId}`),
  getQRCodes: (batchNumber) => api.get(`/manufacturer/qrcodes/${batchNumber}`)
};

// Pharmacy
export const pharmacyAPI = {
  receiveBox: (data) => api.post('/pharmacy/receive', data),
  verifyMedicine: (data) => api.post('/pharmacy/verify', data),
  dispenseMedicine: (data) => api.post('/pharmacy/dispense', data),
  getInventory: () => api.get('/pharmacy/inventory')
};

// Middleman
export const middlemanAPI = {
  receiveBox: (data) => api.post('/middleman/receive', data),
  shipBox: (data) => api.post('/middleman/ship', data),
  reportFake: (data) => api.post('/middleman/report', data),
  getInventory: () => api.get('/middleman/inventory'),
  getHistory: () => api.get('/middleman/history'),
  getShipTargets: () => api.get('/middleman/targets')
};

// Patient
export const patientAPI = {
  verifyMedicine: (data) => api.post('/patient/verify', data)
};

// Regulator
export const regulatorAPI = {
  getDashboard: () => api.get('/regulator/dashboard'),
  getAlerts: (params) => api.get('/regulator/alerts', { params }),
  updateAlert: (alertId, data) => api.put(`/regulator/alerts/${alertId}`, data),
  createRecall: (data) => api.post('/regulator/recalls', data),
  getRecalls: () => api.get('/regulator/recalls'),
  // Actor management
  registerActor: (data) => api.post('/regulator/actors', data),
  getActors: (type) => api.get('/regulator/actors', { params: { type } }),
  updateActorStatus: (actorId, data) => api.put(`/regulator/actors/${actorId}/status`, data),
  // Batch blocking
  blockBatch: (data) => api.post('/regulator/batch/block', data),
  // Notifications
  getNotifications: () => api.get('/regulator/notifications'),
  markNotificationRead: (alertId) => api.put(`/regulator/notifications/${alertId}/read`)
};

// Analytics
export const analyticsAPI = {
  getVerificationTrend: (days = 7) => api.get('/analytics/verifications', { params: { days } }),
  getAlertsByType: () => api.get('/analytics/alerts-by-type'),
  getSupplyChainFlow: () => api.get('/analytics/supply-chain-flow')
};

// Scanner
export const scannerAPI = {
  scan: (data) => api.post('/scanner/scan', data),
  registerDevice: (data) => api.post('/scanner/register', data)
};

export default api;
