import { useState, useEffect, useReducer } from "react";
import toast from "react-hot-toast";
import ProfileLeft from "./ProfileLeft";
import ProfileRight from "./ProfileRight";
import SubmissionPage from "../SubmissionPage";
import { useSelector, useDispatch } from "react-redux";
import axiosInstance from "../../utils/axiosInstance";
import {
  startNavigation,
  endNavigation,
} from "../../redux/slices/historySlice";
import { useLocation } from "react-router-dom";
import { isPageCached } from "../../utils/transitionManager";

import { setUser } from "../../redux/userSlice";
import { errorMessage } from "../../utils/errorMessage";

const initialState = {
  username: "",
  gender: "",
  location: "",
  birthday: "",
  github: "",
  linkedIn: "",
  skills: "",
  education: "",
  name: "",
  bio: "",
  email: "",
};

const reducer = (state, action) => {
  switch (action.type) {
    case "SET_FORM_DATA":
      return { ...state, ...action.payload };
    case "RESET_FORM":
      return initialState;
    default:
      return state;
  }
};

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, dispatch] = useReducer(reducer, initialState);
  const user = useSelector((state) => state.app.user);
  const imageUrl = useSelector((state) => state.app.imageUrl);
  const reduxDispatch = useDispatch();
  const location = useLocation();
  const isCached = isPageCached(location.pathname);
  const [, setRightColumnKey] = useState("submissions");

  useEffect(() => {
    // Only signal navigation start if we're not already cached
    if (!isCached) {
      reduxDispatch(startNavigation());
    }

    return () => {};
  }, [isCached, reduxDispatch]);

  useEffect(() => {
    if (user) {
      // No need to signal navigation start again
      // Just update form data from existing Redux state
      dispatch({
        type: "SET_FORM_DATA",
        payload: {
          username: user.username || "",
          name: user.profile?.name || "",
          gender: user.profile?.gender || "",
          bio: user.profile?.bio || "",
          location: user.profile?.location || "",
          birthday: user.profile?.birthday
            ? user.profile.birthday.slice(0, 10)
            : "",
          github: user.profile?.github ? (/^https?:\/\//.test(user.profile.github) ? user.profile.github : `https://github.com/${encodeURIComponent(user.profile.github)}`) : "",
          skills: user.profile?.skills || "",
          education: user.profile?.education || "",
          linkedIn: user.profile?.linkedIn || "",
          email: user.email || "",
        },
      });

      // Only end navigation if we started it
      if (!isCached) {
        reduxDispatch(endNavigation());
      }
    }
  }, [user, reduxDispatch, isCached]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    dispatch({ type: "SET_FORM_DATA", payload: { [name]: value } });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.username || !formData.name) {
      toast.error("Username and full name are required.");
      return;
    }

    try {
      const response = await axiosInstance.put("user/update", { ...formData });

      if (response.data.success) {
        reduxDispatch(setUser({ ...user, ...response.data.user }));
        // First update UI state to appear responsive
        toast.success("Profile updated successfully.");

        // Then smoothly transition out of edit mode
        setRightColumnKey("submissions");
        setTimeout(() => {
          setIsEditing(false);
        }, 300);
      } else {
        toast.error(response.data.message || "Profile update failed.");
      }
    } catch (error) {
      toast.error(
        errorMessage(error.response?.data?.errors || error.response?.data?.message)
      );
      console.error(error);
    }
  };

  const toggleEdit = () => {
    setRightColumnKey(isEditing ? "submissions" : "edit");
    setTimeout(() => {
      setIsEditing(!isEditing);
    }, 50);
  };

  if (!user) {
    return (
      <div className="text-center text-slate-600 ui-page-height flex items-center justify-center">
        <p>User data could not be loaded. Please refresh the page.</p>
      </div>
    );
  }

  return (
    <div className="relative ui-page-height ui-page text-slate-900">
      <section className="ui-page-top">
        <div className="container mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 p-4">
          <div className="md:col-span-1">
            <ProfileLeft
              formData={formData}
              toggleEdit={toggleEdit}
              isEditing={isEditing}
              imageUrl={imageUrl || null} // Placeholder image
            />
          </div>

          <div className="md:col-span-3">
            {isEditing ? (
              <ProfileRight
                formData={formData}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                user={user || {}} // Provide an empty object as fallback
              />
            ) : (
              <SubmissionPage />
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Profile;
