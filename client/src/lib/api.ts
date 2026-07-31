import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

// ═══════════════════════════════════════════════════════════════════
// AegisVault Frontend API Client with Automatic Token Refresh
// ═══════════════════════════════════════════════════════════════════

const API_BASE_URL = typeof window === 'undefined' 
  ? (process.env.INTERNAL_API_URL || 'http://api-gateway:3000') 
  : '';


export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Helper for saving tokens
export const setTokens = (accessToken: string, refreshToken?: string, role?: string) => {
  if (typeof window !== 'undefined') {
    Cookies.set('accessToken', accessToken, { expires: 1 / 96, path: '/' }); // 15m
    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) {
      Cookies.set('refreshToken', refreshToken, { expires: 7, path: '/' }); // 7d
      localStorage.setItem('refreshToken', refreshToken);
    }
    if (role) {
      Cookies.set('userRole', role, { expires: 7, path: '/' });
      localStorage.setItem('userRole', role);
    }
    // Clear previously saved account selection from previous session to avoid hardcoded/stale account number bug
    localStorage.removeItem('aegisvault_selected_account_number');
  }
};

// Helper for clearing tokens
export const clearTokens = () => {
  if (typeof window !== 'undefined') {
    Cookies.remove('accessToken', { path: '/' });
    Cookies.remove('refreshToken', { path: '/' });
    Cookies.remove('userRole', { path: '/' });
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('aegisvault_selected_account_number');
    localStorage.removeItem('tempUserId');
    localStorage.removeItem('tempEmail');
  }
};

// Request Interceptor: Inject JWT Bearer token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = Cookies.get('accessToken') || localStorage.getItem('accessToken');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response Interceptor: Handle 401 & Auto-Refresh Token
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (originalRequest.url?.includes('/api/auth/login') || originalRequest.url?.includes('/api/auth/refresh')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = Cookies.get('refreshToken') || localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const res = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
          refreshToken,
        });

        if (res.data?.success && res.data?.accessToken) {
          const { accessToken, refreshToken: newRefresh } = res.data;
          setTokens(accessToken, newRefresh);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          processQueue(null, accessToken);
          return api(originalRequest);
        } else {
          throw new Error('Refresh failed');
        }
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null);
        clearTokens();
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ═══════════════════════════════════════════════════════════════════
// API Wrapper Methods
// ═══════════════════════════════════════════════════════════════════

export const authApi = {
  register: (data: Record<string, unknown>) => api.post('/api/auth/register', data),
  login: (data: Record<string, unknown>) => api.post('/api/auth/login', data),
  verifyOtp: (data: Record<string, unknown>) => api.post('/api/auth/verify-otp', data),
  getMe: () => api.get('/api/users/profile'),
  logout: () => api.post('/api/auth/logout'),
};

export const accountApi = {
  getAccounts: () => api.get('/api/accounts'),
  getBalance: (id: string) => api.get(`/api/accounts/${id}/balance`),
  executeTransfer: (data: Record<string, unknown>) => api.post('/api/transactions/transfer', data),
  payBill: (data: Record<string, unknown>) => api.post('/api/payments/bill', data),
  applyLoan: (data: Record<string, unknown>) => api.post('/api/loans/apply', data),
  payInstallment: (data: Record<string, unknown>) => api.post('/api/loans/pay', data),
};


export const txnApi = {
  transfer: (data: Record<string, unknown>) => api.post('/api/transactions/transfer', data),
  getTransactions: (params?: Record<string, unknown>) => api.get('/api/transactions', { params }),
  getTransactionById: (id: string) => api.get(`/api/transactions/${id}`),
};

export const notifApi = {
  getNotifications: () => api.get('/api/notifications'),
  markAsRead: (id: string) => api.put(`/api/notifications/${id}/read`),
  markAllAsRead: () => api.put('/api/notifications/read-all'),
};

export const adminApi = {
  getDashboard: () => api.get('/api/admin/dashboard'),
  getUsers: (params?: Record<string, unknown>) => api.get('/api/admin/users', { params }),
  getLoans: () => api.get('/api/loans'),
  approveLoan: (id: string) => api.put(`/api/loans/${id}/approve`),
  rejectLoan: (id: string, reason?: string) => api.put(`/api/loans/${id}/reject`, { reason }),
  suspendUser: (id: string, reason?: string) => api.put(`/api/admin/users/${id}/suspend`, { reason }),
  verifyKyc: (id: string, reason?: string) => api.put(`/api/admin/users/${id}/verify`, { reason }),
  rejectKyc: (id: string, reason?: string) => api.put(`/api/admin/users/${id}/reject-kyc`, { reason }),
  unlockUser: (id: string, reason?: string) => api.put(`/api/admin/users/${id}/unlock`, { reason }),
  getFraudAlerts: (params?: Record<string, unknown>) => api.get('/api/admin/fraud-alerts', { params }),
  getAuditLogs: (params?: Record<string, unknown>) => api.get('/api/audit', { params }),
  verifyChain: () => api.get('/api/audit/verify-chain'),
  getTransactions: (params?: Record<string, unknown>) => api.get('/api/admin/transactions', { params }),
  getDailyReports: () => api.get('/api/admin/reports/daily'),
};

export default api;
