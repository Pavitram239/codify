import axios from 'axios';

// console.log("Frontend Origin:", import.meta.env.VITE_FRONTEND_ORIGIN);

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_FRONTEND_ORIGIN,
  withCredentials: true,
});

export default axiosInstance;


// import axios from 'axios';

// const axiosInstance = axios.create({
//   baseURL: 'http://192.168.24.235:3100/api/v1', // Ensure this URL is correct
//   withCredentials: true,
// });

// export default axiosInstance;