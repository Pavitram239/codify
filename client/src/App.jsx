import React, { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import AuthService from "./Auth/auth";
import { useDispatch } from "react-redux";
import { setUser, logout, setLoading } from "./redux/userSlice";
import { fetchProfilePicThunk } from "./redux/userSlice";
import Body from "./componets/Body";
import { LoaderPinwheel } from "lucide-react";

const App = () => {
  const dispatch = useDispatch();
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authResponse = await AuthService.getCurrentUser();
        setIsAuthenticated(authResponse.authStatus);
        if (authResponse.authStatus) {
          dispatch(setUser(authResponse.data.user));
          dispatch(setLoading(true));
          dispatch(fetchProfilePicThunk());
          dispatch(setLoading(false));
        } else {
          dispatch(logout());
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, [dispatch]);

  if (isAuthenticated === null) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-screen bg-gradient-to-br from-gray-900 to-gray-950 text-white">
        <LoaderPinwheel size={60} className="animate-spin text-blue-400" />
        <p className="mt-4 text-xl text-blue-400 font-medium">
          Checking authentication...
        </p>
      </div>
    );
  }

  return (
    <div>
      <Body />
      <Toaster />
    </div>
  );
};

export default App;