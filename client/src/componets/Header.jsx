import React, { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { logout, setUser } from "../redux/userSlice";
import axiosInstance from "../utils/axiosInstance";
import { persistor } from "../redux/store";
import { logoutHistory } from "../redux/slices/historySlice";
import { logoutSubmissions } from "../redux/slices/submissionSlice";
import {
  Menu,
  X,
  Home,
  User,
  History,
  HelpCircle,
  Code2,
  ClipboardList,
  LogOut,
  ChevronDown,
  Plus,
  Terminal,
} from "lucide-react";
import { navigateWithTransition } from '../utils/transitionManager.jsx';

const Header = () => {
  const user = useSelector((store) => store.app.user);
  const authStatus = useSelector((store) => store.app.authStatus);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScreenSmall, setIsScreenSmall] = useState(false);
  const [isOnMakeContest, setIsOnMakeContest] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const userMenuRef = useRef(null);
  const headerRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const scrollThreshold = 20;
      
      // Use requestAnimationFrame for smoother animation
      requestAnimationFrame(() => {
        if (scrollPosition > scrollThreshold) {
          if (!scrolled) setScrolled(true);
        } else {
          if (scrolled) setScrolled(false);
        }
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [scrolled]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (authStatus === false) {
      navigate("/");
    }
  }, [authStatus, navigate]);

  useEffect(() => {
    setIsAdmin(user?.role);
  }, [user?.role]);

  useEffect(() => {
    const handleResize = () => {
      setIsScreenSmall(window.innerWidth <= 1200);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    setIsOnMakeContest(location.pathname === "/make-contest");
  }, [location]);

  const logoutHandler = async () => {
    try {
      await axiosInstance.get("auth/logout");
      localStorage.removeItem("UserToken");
      
      // Dispatch actions in the correct order
      dispatch(logoutSubmissions());
      dispatch(logoutHistory());
      dispatch(logout());
      
      await persistor.purge();
      toast.success("Logged out successfully");
      navigate("/");
    } catch (error) {
      console.error("Logout Error:", error);
      toast.error("Failed to log out. Please try again.");
    }
  };

  const toggleMakeContest = () => {
    if (isOnMakeContest) {
      navigate("/browse");
    } else {
      navigate("/make-contest");
    }
  };

  const handleNavigate = (path) => {
    // Smooth navigation with transition
    dispatch(navigateWithTransition(navigate, path));
  };

  const isActive = (path) => location.pathname === path;
  const makeContestButtonText =
    user?.role === "student" ? "Contest" : "Make Contest";

  const navLinks = [
    { path: "/browse", label: "Home", icon: <Home size={18} /> },
    {
      path: "/make-problem",
      label: user?.role === "student" ? "Problems" : "Problem",
      icon: <Code2 size={18} />,
    },
    { path: "/profile", label: "Profile", icon: <User size={18} /> },
    { path: "/history", label: "History", icon: <History size={18} /> },
    { path: "/support", label: "Support", icon: <HelpCircle size={18} /> },
  ];

  if (user?.role === "admin") {
    navLinks.push({
      path: "/pending-requests",
      label: "Requests",
      icon: <ClipboardList size={18} />,
    });
  }
  if (user?.role === "faculty") {
    navLinks.push({
      path: "/faculty-section",
      label: "Requests",
      icon: <ClipboardList size={18} />,
    });
  }

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      ref={headerRef}
      className={`z-50 w-full fixed ${
        scrolled 
          ? "top-0 bg-black shadow-sm" 
          : "top-3 mx-auto max-w-[95%] left-0 right-0 bg-black rounded-full px-2"
      } transition-all duration-300`}
    >
      <div className={`mx-auto px-4 ${scrolled ? "max-w-7xl sm:px-6 lg:px-8" : "max-w-7xl"}`}>
        <div className="flex items-center justify-between h-14">
          <motion.div 
            whileHover={{ scale: 1.03 }} 
            className="flex items-center space-x-2"
            onClick={() => navigate('/browse')}
            style={{ cursor: 'pointer' }}
          >
            <div className="relative flex items-center">
              <Terminal 
                size={24} 
                className={`${
                  scrolled 
                    ? "text-blue-500" 
                    : "text-blue-400"
                } transition-colors duration-300`}
              />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
            </div>
            <h1 className={`text-2xl font-bold ${
              scrolled ? "translate-y-0" : "translate-y-0.5"
            } transition-transform duration-300`}>
              <span className="font-medium italic text-white" style={{ fontFamily: "'Pacifico', cursive, system-ui" }}>
                Codify
              </span>
              <span className="text-blue-500 text-xl font-normal">.</span>
            </h1>
          </motion.div>

          {isScreenSmall && user ? (
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`text-white p-2 rounded-md transition-colors ${
                scrolled ? "hover:bg-blue-500/20" : "hover:bg-white/10"
              }`}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          ) : (
            user && (
              <div className="hidden md:flex items-center space-x-3">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavigate(link.path);
                    }}
                    to={link.path}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                      isActive(link.path)
                        ? `bg-blue-500/20 text-blue-400 ${scrolled ? 'shadow-inner' : ''}`
                        : `text-gray-300 hover:bg-blue-500/10 hover:text-blue-300 ${
                            scrolled ? 'hover:shadow-sm' : ''
                          }`
                    }`}
                  >
                    {link.icon}
                    <span>{link.label}</span>
                  </Link>
                ))}

                {/* User Dropdown */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                      isUserMenuOpen
                        ? "bg-blue-500/20 text-blue-400"
                        : `text-gray-300 hover:bg-blue-500/10 hover:text-blue-300 ${
                            scrolled ? 'hover:shadow-sm' : ''
                          }`
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-500/30 flex items-center justify-center text-blue-200 text-xs mr-1">
                      {user?.username?.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium">{user?.username?.split(' ')[0]}</span>
                    <ChevronDown 
                      size={16} 
                      className={`transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : 'rotate-0'}`}
                    />
                  </button>

                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 overflow-hidden"
                      >
                        <div className="px-4 py-3 border-b border-gray-700">
                          <p className="text-sm text-gray-400">Logged in as</p>
                          <p className="text-sm font-medium text-white truncate">{user?.email}</p>
                        </div>
                        <button
                          onClick={logoutHandler}
                          className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-300 hover:bg-red-500/10 hover:text-red-300"
                        >
                          <LogOut size={16} />
                          <span>Logout</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Make Contest Button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleMakeContest}
                  className={`flex items-center space-x-1 px-4 py-2 text-white rounded-md font-medium shadow-lg transition-all duration-300 ${
                    scrolled 
                      ? "bg-blue-600 hover:bg-blue-700" 
                      : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  }`}
                >
                  {isOnMakeContest ? <Home size={18} /> : <Plus size={18} />}
                  <span>{isOnMakeContest ? "Home" : makeContestButtonText}</span>
                </motion.button>
              </div>
            )
          )}
        </div>
      </div>

      <AnimatePresence>
        {isScreenSmall && isMenuOpen && user && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-blue-500/20"
          >
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium ${
                    isActive(link.path)
                      ? "bg-blue-500/20 text-blue-400"
                      : "text-gray-300 hover:bg-blue-500/10 hover:text-blue-300"
                  }`}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              ))}

              <button
                onClick={logoutHandler}
                className="flex items-center space-x-2 w-full px-3 py-2 rounded-md text-base font-medium text-red-400 hover:bg-red-500/10"
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  toggleMakeContest();
                }}
                className="flex items-center space-x-2 w-full px-3 py-2 rounded-md text-base font-medium bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
              >
                {isOnMakeContest ? <Home size={18} /> : <Plus size={18} />}
                <span>{isOnMakeContest ? "Home" : makeContestButtonText}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Header;
