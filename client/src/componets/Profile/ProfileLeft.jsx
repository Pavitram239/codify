import React, { useState, useEffect, useRef } from "react";
import { User, Github, Linkedin, Edit, Upload, X } from "lucide-react";
import axiosInstance from "../../utils/axiosInstance";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import { setImageUrl } from "../../redux/userSlice";

const ProfileLeft = ({ formData, toggleEdit, isEditing, imageUrl }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [profilePic, setProfilePic] = useState(imageUrl || null);
  const [loading, setLoading] = useState(false);
  const [contentReady, setContentReady] = useState(false);
  const globalLoading = useSelector((state) => state.app.isLoading);
  const fileInputRef = useRef(null);
  const dispatch = useDispatch();

  // Preload and render content with a small delay for smooth transition
  useEffect(() => {
    const timer = setTimeout(() => {
      setContentReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (imageUrl) {
      setProfilePic(imageUrl);
      // Preload image to avoid flickering on render
      const img = new Image();
      img.src = imageUrl;
    }
  }, [imageUrl]);

  useEffect(() => {
    if (selectedFile) {
      const previewUrl = URL.createObjectURL(selectedFile);
      setImagePreview(previewUrl);
      return () => {
        URL.revokeObjectURL(previewUrl);
      };
    } else {
      setImagePreview(null);
    }
  }, [selectedFile]);

  const githubURL = formData.github
    ? `https://github.com/${formData.github}`
    : null;
  const linkedInURL = formData.linkedIn || null;

  // Add new optimized methods
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpdateProfilePic = async () => {
    if (!selectedFile) return;
    const uploadData = new FormData();
    uploadData.append("avatar", selectedFile);

    try {
      setLoading(true);
      // Create a temporary local preview immediately for better UX
      const localPreview = URL.createObjectURL(selectedFile);
      setProfilePic(localPreview);
      
      const response = await axiosInstance.post("/user/upload-avatar", uploadData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      
      if (response.status === 200) {
        toast.success(response.data.message);
        if (response.data.profilePicUrl) {
          // Replace local preview with server URL once available
          setProfilePic(response.data.profilePicUrl);
          dispatch(setImageUrl(response.data.profilePicUrl));
        } else {
          dispatch(setImageUrl(localPreview));
        }
        setSelectedFile(null);
      }
    } catch (error) {
      toast.error("Upload Error");
      console.error("Upload Error:", error);
      // Revert to previous image if there's an error
      setProfilePic(imageUrl);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveImage = async () => {
    try {
      setLoading(true);
      // Optimistically remove the image for better UX
      const oldImage = profilePic;
      setProfilePic(null);
      
      const response = await axiosInstance.delete("/user/profile/remove-profile-pic");
      if (response.status === 200) {
        toast.success("Profile picture removed successfully");
        if (oldImage && oldImage.startsWith("blob:")) {
          URL.revokeObjectURL(oldImage);
        }
        setSelectedFile(null);
        dispatch(setImageUrl(null));
      } else {
        // Restore the image if there was an error
        setProfilePic(oldImage);
      }
    } catch (error) {
      toast.error("Remove Error");
      console.error("Remove Error:", error);
      // Restore the image on error
      setProfilePic(imageUrl);
    } finally {
      setLoading(false);
    }
  };

  const combinedLoading = loading || globalLoading;

  return (
    <div 
      className={`sticky top-20 bg-gradient-to-br from-gray-800 to-gray-900 text-white rounded-xl shadow-2xl p-8 border border-gray-700 transition-opacity duration-500 ease-in-out ${
        contentReady ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="flex flex-col items-center">
        <div className="relative mb-6">
          {combinedLoading ? (
            <div className="w-40 h-40 rounded-full bg-gray-700 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="relative group">
              <div className="w-40 h-40 rounded-full overflow-hidden ring-4 ring-blue-500 shadow-lg transition-all duration-300 hover:ring-blue-400">
                {selectedFile ? (
                  <img
                    src={imagePreview}
                    alt="Selected"
                    className="w-full h-full object-cover transition-opacity duration-300"
                  />
                ) : profilePic ? (
                  <img
                    src={profilePic}
                    alt="Profile"
                    className="w-full h-full object-cover transition-opacity duration-300"
                    onError={(e) => {
                      // Handle image load errors
                      e.target.onerror = null;
                      e.target.src = "/default-img.png"; // Set to a default placeholder image
                      e.target.classList.add("bg-gray-700"); // Add a fallback background color
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                    <User size={80} className="text-gray-400" />
                  </div>
                )}
              </div>
              
              <div className={`absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center transition-opacity duration-300 ${
                isEditing ? "opacity-0 group-hover:opacity-100" : "hidden"
              }`}>
                <button
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full transition-all transform hover:scale-110"
                  disabled={combinedLoading}
                >
                  <Edit size={20} />
                </button>
              </div>
            </div>
          )}
        </div>

        <h2 className="text-2xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 transition-all duration-300">
          {formData.name || "Your Name"}
        </h2>

        <div className="flex items-center space-x-4 mb-6 transition-all duration-300">
          <a
            href={githubURL || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={`transition-all p-2 rounded-full ${
              githubURL
                ? "bg-gray-700 text-white hover:bg-gray-600 hover:scale-110"
                : "bg-gray-800 text-gray-500 cursor-not-allowed"
            }`}
            title={githubURL ? "GitHub Profile" : "No GitHub profile available"}
            onClick={(e) => !githubURL && e.preventDefault()}
          >
            <Github size={24} />
          </a>
          <a
            href={linkedInURL || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={`transition-all p-2 rounded-full ${
              linkedInURL
                ? "bg-gray-700 text-white hover:bg-gray-600 hover:scale-110"
                : "bg-gray-800 text-gray-500 cursor-not-allowed"
            }`}
            title={linkedInURL ? "LinkedIn Profile" : "No LinkedIn profile available"}
            onClick={(e) => !linkedInURL && e.preventDefault()}
          >
            <Linkedin size={24} />
          </a>
        </div>

        <button
          onClick={toggleEdit}
          className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 ${
            isEditing
              ? "bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800"
              : "bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800"
          } text-white shadow-lg`}
        >
          {isEditing ? "Cancel Edit" : "Edit Details"}
        </button>

        {isEditing && (
          <div className="mt-6 w-full space-y-4 animate-fade-in">
            <input
              ref={fileInputRef}
              id="fileInput"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {!selectedFile && (
              <button
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                disabled={combinedLoading}
                className="w-full bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-lg px-4 py-3 shadow-lg hover:from-indigo-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <Upload size={18} />
                <span>Select New Image</span>
              </button>
            )}

            {selectedFile && (
              <div className="space-y-3 animate-fade-in">
                <div className="text-sm text-gray-300 bg-gray-800 p-3 rounded-lg flex items-center">
                  <div className="flex-1 truncate">{selectedFile.name}</div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    disabled={combinedLoading}
                    className="text-gray-400 hover:text-red-400 ml-2 disabled:opacity-50"
                  >
                    <X size={16} />
                  </button>
                </div>
                <button
                  onClick={handleUpdateProfilePic}
                  disabled={combinedLoading}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg px-4 py-3 shadow-lg hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-400 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {combinedLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent border-white mr-2"></div>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      <span>Upload Profile Picture</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {profilePic && !selectedFile && (
              <button
                onClick={handleRemoveImage}
                disabled={combinedLoading}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg px-4 py-3 shadow-lg hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {combinedLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent border-white mr-2"></div>
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <X size={18} />
                    <span>Remove Profile Picture</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileLeft;