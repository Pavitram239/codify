import { useEffect, useState } from "react";
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
    const expireSession = () => dispatch(logout());
    window.addEventListener("codify:session-expired", expireSession);
    return () => window.removeEventListener("codify:session-expired", expireSession);
  }, [dispatch]);

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
      <div className="flex flex-col items-center justify-center w-full ui-page-height ui-gradient   text-slate-900">
        <LoaderPinwheel size={60} className="animate-spin text-blue-700" />
        <p className="mt-4 text-xl text-blue-700 font-medium">
          Checking authentication...
        </p>
      </div>
    );
  }

  return (
    <div>
      <Body />
      <Toaster
        toastOptions={{
          style: {
            background: "var(--surface)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            fontFamily: "Inter, sans-serif",
            fontSize: "14px",
          },
        }}
      />
    </div>
  );
};

export default App;
