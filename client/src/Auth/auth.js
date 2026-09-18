import axiosInstance from "../utils/axiosInstance";

class Auth {
  async getCurrentUser() {
    try {
      const response = await axiosInstance.get("auth/get-current-user");
      const data = response.data;
      if (data.success) {
        return { data, authStatus: true };
      }
      return { authStatus: false };
    } catch (error) {
      console.error("Error in getCurrentUser:", error);
      return { authStatus: false };
    }
  }
}

const AuthService = new Auth();
export default AuthService;