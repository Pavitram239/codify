import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchProfilePicThunk, setLoading, setUser } from "../redux/userSlice";
import axiosInstance from "../utils/axiosInstance";
import { errorMessage } from "../utils/errorMessage";
import { SEM, BRANCH } from "../utils/constants";
import PasswordChange from "./PassWordChange";


const Login = () => {
  
  const [isLogin, setIsLogin] = useState(true);
  const authStatus = useSelector((store) => store.app.authStatus);
  const [, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [idOrEmail, setIdOrEmail] = useState("");
  const [mobileNo, setMobileNo] = useState("");
  const [branch, setBranch] = useState("");
  const [sem, setSem] = useState("");
  const [batch, setBatch] = useState("");
  const [subject, setSubject] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isLoading = useSelector((store) => store.app.isLoading);
  const [userType, setUserType] = useState("");
  const [, setIsLoad] = useState(false);
  const [canTerminateSession, setCanTerminateSession] = useState(false);
  const [cachedCredentials, setCachedCredentials] = useState(null);

  const toggleLogin = () => {
    setIsLogin(!isLogin);
    setCanTerminateSession(false);
    setCachedCredentials(null);
  };

  useEffect(() => {
    if (authStatus) {
      navigate("/browse");
    } else {
      navigate("/");
    }
  }, [authStatus, navigate]);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        if (userType === "student") {
          setIsLoad(true);
          const res = await axiosInstance.get("auth/fetch-subjects");
          if (res.data.success) {
            // console.log(res.data.subjects);
            setSubjects(res.data.subjects);
          }
          setIsLoad(false);
        }
      } catch (error) {
        setIsLoad(false);
        console.error("Failed to fetch subjects:", error);
      }
    };

    fetchSubjects();
  }, [userType]);

  const validateRegistration = () => {
    if (!password || password.length < 8) {
      toast.error("Choose a password with at least 8 characters.");
      return false;
    }
    if (!username || !idOrEmail || !userType || !subject) {
      toast.error("Username, ID/Email, User Type, and Subject are required.");
      return false;
    }
    if (userType === "student") {
      if (!mobileNo || !branch || !sem || !batch) {
        toast.error("All fields are required for student registration.");
        return false;
      }
      if (mobileNo.length !== 10 || !/^\d+$/.test(mobileNo)) {
        toast.error("Mobile number must be 10 digits.");
        return false;
      }
    } else if (userType === "faculty") {
      if (!/\S+@\S+\.\S+/.test(idOrEmail)) {
        toast.error("Please enter a valid email for faculty.");
        return false;
      }
    }
    return true;
  };

  const handleRegistration = async (e) => {
    e.preventDefault();
    if (!validateRegistration()) return;

    const selectedSubject = subjects.find((subj) => subj.id === subject);
    const newUser = {
      username,
      id: userType === "student" ? idOrEmail.toLowerCase() : undefined, // Convert ID to lowercase
      facultyId: userType === "student" ? selectedSubject.id : undefined,
      email: userType === "faculty" ? idOrEmail.toLowerCase() : undefined, // Convert email to lowercase
      mobileNo: userType === "student" ? mobileNo : undefined,
      branch: userType === "student" ? branch.toLowerCase() : undefined, // Convert branch to lowercase
      semester: userType === "student" ? sem : undefined,
      batch: userType === "student" ? batch.toLowerCase() : undefined,
      subject: userType === "student" ? selectedSubject.subject : subject,
      role: userType,
      password,
    };

    // console.log(newUser);

    try {
      dispatch(setLoading(true));

      const res = await axiosInstance.post("auth/register", newUser);

      if (res.data.success) {
        toast.success(res.data.message);
        setIsLogin(true);
      }
    } catch (error) {
      toast.error(errorMessage(error.response?.data?.message, "Registration failed."));
    } finally {
      dispatch(setLoading(false));
    }
  };

  const validateLogin = () => {
    if (!idOrEmail || !password) {
      toast.error("ID/Email and password are required for login.");
      return false;
    }
    return true;
  };

  const handleLogin = async (e, options = {}) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!validateLogin()) return;

    dispatch(setLoading(true));
    const userPayload = {
      [idOrEmail.includes("@") ? "email" : "id"]: idOrEmail.toLowerCase().trim(),
      password,
      terminateExisting: Boolean(options.terminateExisting),
    };

    try {
      const url = `auth/login`;
      const res = await axiosInstance.post(url, userPayload);
      if (res.data.success) {
        setCanTerminateSession(false);
        setCachedCredentials(null);

        const { firstTimeLogin, message } = res.data;
        if (firstTimeLogin) {
          setIsFirstTime(true);
          toast.success("Welcome to your first login!");
          return;
        }

        const { user: loggedInUser } = res.data;
        toast.success(message || "Login successful!");
        dispatch(setUser(loggedInUser));
        dispatch(setLoading(true));
        dispatch(fetchProfilePicThunk());
        dispatch(setLoading(false));
        resetForm();
        navigate("/browse");
      } else {
        toast.error(errorMessage(res.data.message, "Login failed!"));
      }
    } catch (error) {
      const loginError =
        error?.response?.data?.message || "An error occurred during login.";
      toast.error(errorMessage(loginError));

      if (error?.response?.data?.canTerminate) {
        setCanTerminateSession(true);
        setCachedCredentials(userPayload);
      } else {
        setCanTerminateSession(false);
        setCachedCredentials(null);
      }
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleTerminateAndLogin = async () => {
    if (!cachedCredentials) return;
    dispatch(setLoading(true));
    try {
      const res = await axiosInstance.post("auth/login", {
        ...cachedCredentials,
        terminateExisting: true,
      });
      if (res.data.success) {
        setCanTerminateSession(false);
        setCachedCredentials(null);
        const { user: loggedInUser, message } = res.data;
        toast.success(message || "Previous session terminated. Welcome back!");
        dispatch(setUser(loggedInUser));
        dispatch(setLoading(true));
        dispatch(fetchProfilePicThunk());
        dispatch(setLoading(false));
        resetForm();
        navigate("/browse");
      } else {
        toast.error(res.data.message || "Login failed!");
      }
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to terminate session and log in."
      );
    } finally {
      dispatch(setLoading(false));
    }
  };

  const resetForm = () => {
    setFullName("");
    setUsername("");
    setIdOrEmail("");
    setPassword("");
    setCanTerminateSession(false);
    setCachedCredentials(null);
  };

  return (
    <>
      <div style={{ backgroundColor: "var(--background)" }}>
        <div className="relative ui-page-height flex items-center justify-center ui-gradient overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
          {isFirstTime ? (
            <PasswordChange id={idOrEmail} />
          ) : (
            <form
              onSubmit={isLogin ? handleLogin : handleRegistration}
              className="flex flex-col w-full max-w-lg p-8 space-y-6 ui-page bg-opacity-90 rounded-lg ui-card-shadow"
            >
              <h1 className="text-4xl text-slate-900 font-bold text-center">
                {isLogin ? "Login" : "Signup"}
              </h1>
              {!isLogin && (
                <>
                  {/* username */}
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    type="text"
                    placeholder="Username"
                    className="p-4 rounded-md ui-surface text-slate-900 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none w-full"
                  />

                  {/* idOrEmail and userType */}
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      value={idOrEmail}
                      onChange={(e) => setIdOrEmail(e.target.value)}
                      type={userType === "faculty" ? "email" : "text"}
                      placeholder={
                        userType === "faculty" ? "Faculty Email" : "Student ID"
                      }
                      className="p-4 rounded-md ui-surface text-slate-900 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />

                    <select
                      id="userType"
                      value={userType}
                      onChange={(e) => {
                        setUserType(e.target.value);
                        setSubject("");
                      }}
                      className="p-3 w-full cursor-pointer rounded-md ui-surface text-slate-900 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="" disabled>
                        -- Select User Type --
                      </option>
                      <option value="student">Student</option>
                      <option value="faculty">Faculty</option>
                    </select>
                  </div>

                  {/* For Students: branch, semester, batch, mobileNo */}
                  {userType === "student" && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <select
                          value={branch}
                          onChange={(e) => setBranch(e.target.value)}
                          className="p-4 cursor-pointer rounded-md ui-surface text-slate-900 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                          <option value="">Select Branch</option>
                          {Object.values(BRANCH).map((branchOption, index) => (
                            <option key={index} value={branchOption}>
                              {branchOption}
                            </option>
                          ))}
                        </select>

                        <select
                          value={sem}
                          onChange={(e) => setSem(e.target.value)}
                          className="p-4 cursor-pointer rounded-md ui-surface text-slate-900 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                          <option value="">Select Semester</option>
                          {Object.values(SEM).map((semOption, index) => (
                            <option key={index} value={semOption}>
                              Semester {semOption}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <select
                          value={batch}
                          onChange={(e) => setBatch(e.target.value)}
                          className="p-4 rounded-md ui-surface text-slate-900 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                          <option value="" disabled>
                            Select Batch
                          </option>
                          <option value="a1">A1</option>
                          <option value="b1">B1</option>
                          <option value="c1">C1</option>
                          <option value="d1">D1</option>
                          <option value="a2">A2</option>
                          <option value="b2">B2</option>
                          <option value="c2">C2</option>
                          <option value="d2">D2</option>
                        </select>

                        <input
                          value={mobileNo}
                          onChange={(e) => setMobileNo(e.target.value)}
                          type="text"
                          placeholder="Mobile No"
                          className="p-4 rounded-md ui-surface text-slate-900 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </>
                  )}

                  {/* Subject */}
                  <div className="mt-4">
                    {userType === "student" && (
                      <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="p-4 w-full cursor-pointer rounded-md ui-surface text-slate-900 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="" disabled>
                          -- Select Subject --
                        </option>
                        {subjects.map((subj, index) => (
                          <option key={index} value={subj.id}>
                            {subj.subject} ({subj.teacher})
                          </option>
                        ))}
                      </select>
                    )}

                    {userType === "faculty" && (
                      <input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        type="text"
                        placeholder="Enter Subject"
                        className="p-4 w-full rounded-md ui-surface text-slate-900 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    )}
                  </div>
                </>
              )}
              {!isLogin && (
                <input type="password" autoComplete="new-password" aria-label="Choose password" placeholder="Choose password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required className="p-4 w-full rounded-md ui-surface text-slate-900 border border-slate-200" />
              )}
              {isLogin && (
                <>
                  <input
                    value={idOrEmail}
                    onChange={(e) => {
                      setIdOrEmail(e.target.value);
                      setCanTerminateSession(false);
                    }}
                    type="name"
                    placeholder="Id"
                    className="p-4 rounded-md ui-surface text-slate-900 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <div className="relative w-full">
                    <input
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setCanTerminateSession(false);
                      }}
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      className="p-4 w-full rounded-md ui-surface text-slate-900 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-600 hover:text-blue-700 focus:outline-none"
                    >
                      {showPassword ? (
                        <span>🔓</span>
                      ) : (
                        <span>🔒</span> //
                      )}
                    </button>
                  </div>
                  {canTerminateSession && (
                    <div className="p-4 bg-amber-950/80 border border-amber-500/70 rounded-lg text-amber-200 text-sm flex flex-col gap-3">
                      <div>
                        <p className="font-bold text-amber-300 flex items-center gap-1.5">
                          <span>⚠️</span> Active Session Detected
                        </p>
                        <p className="mt-1 text-xs text-amber-100/90 leading-relaxed">
                          This administrator account is active in another tab or device (e.g., closed incognito window). As an admin, you can terminate that session and log in now.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleTerminateAndLogin}
                        className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-slate-900 font-semibold rounded-md shadow transition duration-150 active:scale-98"
                      >
                        Terminate Active Session &amp; Log In
                      </button>
                    </div>
                  )}
                </>
              )}
              <button
                type="submit"
                className="w-full py-4 bg-blue-600 text-slate-900 font-bold rounded-md transition-transform transform hover:scale-105 focus:scale-95"
              >
                {isLoading ? "Loading..." : isLogin ? "Login" : "Signup"}
              </button>
              <p className="text-slate-900 text-center">
                {isLogin ? "New to Coding App?" : "Already have an account?"}
                <button
                  type="button"
                  onClick={toggleLogin}
                  className="ml-2 text-blue-700 cursor-pointer hover:underline"
                >
                  {isLogin ? "Signup" : "Login"}
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default Login;
