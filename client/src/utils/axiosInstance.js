import axios from 'axios';

// console.log("Frontend Origin:", import.meta.env.VITE_FRONTEND_ORIGIN);

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_FRONTEND_ORIGIN,
  withCredentials: true,
});

let csrfTokenPromise;
let authGeneration = 0;
let sessionRecoveryPromise;
axiosInstance.interceptors.request.use(async (config) => {
  if (!["get", "head", "options"].includes((config.method || "get").toLowerCase())) {
    if (!csrfTokenPromise) {
      csrfTokenPromise = axiosInstance.get("auth/csrf")
        .then((response) => response.data.csrfToken)
        .catch((error) => {
          csrfTokenPromise = undefined;
          throw error;
        });
    }
    config.headers["X-CSRFToken"] = await csrfTokenPromise;
  }
  config.codifyAuthGeneration = authGeneration;
  return config;
});

export default axiosInstance;
axiosInstance.interceptors.response.use(
  (response) => {
    if (/auth\/login$/.test(response.config.url || "") && response.data?.token) authGeneration += 1;
    return response;
  },
  async (error) => {
    if (error.response?.status === 401 && error.config?.codifyAuthGeneration === authGeneration && !/auth\/logout$/.test(error.config?.url || "")) {
      authGeneration += 1;
      csrfTokenPromise = undefined;
      sessionRecoveryPromise = axiosInstance.post("auth/logout")
        .catch(() => {})
        .finally(() => {
          window.dispatchEvent(new Event("codify:session-expired"));
          sessionRecoveryPromise = undefined;
        });
      await sessionRecoveryPromise;
    }
    return Promise.reject(error);
  },
);


// import axios from 'axios';

// const axiosInstance = axios.create({
//   baseURL: 'http://192.168.24.235:3100/api/v1', // Ensure this URL is correct
//   withCredentials: true,
// });

// export default axiosInstance;
