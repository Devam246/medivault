import axios from "axios";

// Create Axios instance
const api = axios.create({
  baseURL: "http://localhost:4000",
  withCredentials: true // send cookies for cross-origin
});

// Request interceptor
api.interceptors.request.use(config => {
  // Attach token if exists
  const token = localStorage.getItem("mv_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Set Content-Type only if not FormData
  if (config.data && !(config.data instanceof FormData)) {
    config.headers["Content-Type"] = "application/json";
  }

  return config;
}, error => Promise.reject(error));

// Response interceptor (optional: auto logout on 401)
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem("mv_token");
      localStorage.removeItem("mv_role");
      localStorage.removeItem("mv_refreshToken");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
