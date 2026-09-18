import React, { useState, useEffect, useReducer } from "react";
import toast from "react-hot-toast";
import ProfileLeft from "./ProfileLeft";
import ProfileRight from "./ProfileRight";
import SubmissionPage from "../SubmissionPage";
import { useSelector, useDispatch } from "react-redux";
import axiosInstance from "../../utils/axiosInstance";
import { fetchSubmissions } from "../../redux/slices/submissionSlice";
import {
  startNavigation,
  endNavigation,
} from "../../redux/slices/historySlice";
import { useLocation } from "react-router-dom";
import { isPageCached } from "../../utils/transitionManager";
import { motion, AnimatePresence } from "framer-motion";

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
  const submissions = useSelector((state) => state.submissions.submissions);
  const submissionsLoading = useSelector((state) => state.submissions.loading);
  const location = useLocation();
  const isCached = isPageCached(location.pathname);
  const [rightColumnKey, setRightColumnKey] = useState("submissions");

  useEffect(() => {
    // Only signal navigation start if we're not already cached
    if (!isCached) {
      reduxDispatch(startNavigation());
    }

    return () => {};
  }, []);

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
          github: user.profile?.github || "",
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

  // Only fetch submissions if we don't have them already
  useEffect(() => {
    // Don't make API call if:
    // 1. We don't have a user yet
    // 2. We already have submissions data
    // 3. We're currently loading submissions
    // 4. The page is cached (recently visited)
    if (user && submissions.length === 0 && !submissionsLoading && !isCached) {
      reduxDispatch(fetchSubmissions({ page: 1, limit: 7 }));
    }
  }, [reduxDispatch, user, submissions.length, submissionsLoading, isCached]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    dispatch({ type: "SET_FORM_DATA", payload: { [name]: value } });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.username || !formData.email) {
      toast.error("Username and email are required.");
      return;
    }

    try {
      const response = await axiosInstance.put("user/update", { ...formData });

      if (response.data.success) {
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
        error.response?.data?.message || "An error occurred. Please try again."
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
      <div className="text-center text-gray-500 h-screen flex items-center justify-center">
        <p>User data could not be loaded. Please refresh the page.</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gray-900 text-white">
      <section className="pt-16 dark:bg-gray-900">
        <div className="container mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 p-4">
          <div className="md:col-span-1">
            <ProfileLeft
              formData={formData}
              toggleEdit={toggleEdit}
              isEditing={isEditing}
              imageUrl={imageUrl || "https://via.placeholder.com/150"} // Placeholder image
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
              <div>
                {submissionsLoading ? (
                  <div className="flex justify-center items-center p-10 h-64">
                    <div className="animate-pulse flex flex-col items-center">
                      <div className="h-12 w-12 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin mb-4"></div>
                      <div className="text-blue-400">Loading submissions...</div>
                    </div>
                  </div>
                ) : (
                  <SubmissionPage />
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Profile;
