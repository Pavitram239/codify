import React, { useState, useEffect } from "react";
import {
  Save,
  User,
  Mail,
  Github,
  Linkedin,
  FileText,
  MapPin,
  Cake,
  BookOpen,
  Code,
  Loader2,
} from "lucide-react";

const ProfileRight = ({ formData, handleInputChange, handleSubmit, user }) => {
  const [isFormTouched, setIsFormTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contentReady, setContentReady] = useState(false);

  // Enable smooth transition on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setContentReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Track form changes to enable/disable submit button
  useEffect(() => {
    const isChanged = Object.keys(formData).some(key => {
      if (key === 'birthday' && user.profile?.birthday) {
        return formData[key] !== user.profile.birthday.slice(0, 10);
      }
      if (key === 'email') {
        return false; // Email is read-only
      }
      if (user.profile && key in user.profile) {
        return formData[key] !== user.profile[key];
      }
      return formData[key] !== user[key];
    });
    
    setIsFormTouched(isChanged);
  }, [formData, user]);

  // Enhanced submit handler with loading state
  const onSubmit = async (e) => {
    setIsSubmitting(true);
    await handleSubmit(e);
    setIsSubmitting(false);
  };

  const handleInputFieldChange = (e) => {
    handleInputChange(e);
  };

  // Prepare form field animations
  const getFieldAnimation = (index) => {
    return {
      animationDelay: `${index * 50}ms`,
      animationName: 'slide-up',
      animationDuration: '400ms',
      animationFillMode: 'both',
      animationTimingFunction: 'ease-out',
    };
  };

  return (
    <div 
      className={`flex flex-col space-y-4 transition-opacity duration-500 ease-in-out ${
        contentReady ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="bg-gradient-to-br from-gray-900 to-gray-900 rounded-xl shadow-2xl p-8 border border-blue-900/30">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Profile Information
          </h2>
          <div className="mt-2 h-1 w-24 mx-auto bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"></div>
        </div>

        <form
          onSubmit={onSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-8"
        >
          {/* Full Name */}
          <div className="col-span-2" style={getFieldAnimation(1)}>
            <label className="flex items-center text-white mb-3 text-sm font-medium">
              <User size={18} className="mr-3 text-blue-400" />
              Full Name
            </label>
            <div className="relative group">
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputFieldChange}
                className="w-full p-4 pl-5 bg-gray-800 border-2 border-gray-700 rounded-lg shadow-lg
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                           transition-all duration-300 group-hover:border-gray-600"
                placeholder="Enter your full name"
                autoComplete="name"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Username */}
          <div className="col-span-2" style={getFieldAnimation(2)}>
            <label className="flex items-center text-white mb-3 text-sm font-medium">
              <User size={18} className="mr-3 text-blue-400" />
              Username
            </label>
            <div className="relative group">
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputFieldChange}
                className="w-full p-4 pl-5 bg-gray-800 border-2 border-gray-700 rounded-lg shadow-lg
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                           transition-all duration-300 group-hover:border-gray-600"
                placeholder="Enter your username"
                autoComplete="username"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Email */}
          <div className="col-span-2" style={getFieldAnimation(3)}>
            <label className="flex items-center text-white mb-3 text-sm font-medium">
              <Mail size={18} className="mr-3 text-blue-400" />
              Email
            </label>
            <div className="relative">
              <input
                type="email"
                value={user.email}
                readOnly
                className="w-full p-4 pl-5 bg-gray-700 border-2 border-gray-600 rounded-lg shadow-lg
                           text-gray-300 cursor-not-allowed"
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xs font-semibold text-gray-400 bg-gray-800 px-3 py-1 rounded-full border border-gray-600">
                Read only
              </div>
            </div>
          </div>

          {/* Github */}
          <div className="col-span-1" style={getFieldAnimation(4)}>
            <label className="flex items-center text-white mb-3 text-sm font-medium">
              <Github size={18} className="mr-3 text-blue-400" />
              Github
            </label>
            <div className="relative group">
              <input
                name="github"
                value={formData.github}
                onChange={handleInputFieldChange}
                className="w-full p-4 pl-5 bg-gray-800 border-2 border-gray-700 rounded-lg shadow-lg
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                           transition-all duration-300 group-hover:border-gray-600"
                placeholder="Enter your GitHub profile name"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* LinkedIn */}
          <div className="col-span-1" style={getFieldAnimation(5)}>
            <label className="flex items-center text-white mb-3 text-sm font-medium">
              <Linkedin size={18} className="mr-3 text-blue-400" />
              LinkedIn
            </label>
            <div className="relative group">
              <input
                name="linkedIn"
                value={formData.linkedIn}
                onChange={handleInputFieldChange}
                className="w-full p-4 pl-5 bg-gray-800 border-2 border-gray-700 rounded-lg shadow-lg
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                           transition-all duration-300 group-hover:border-gray-600"
                placeholder="Enter your LinkedIn profile URL"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Bio */}
          <div className="col-span-2" style={getFieldAnimation(6)}>
            <label className="flex items-center text-white mb-3 text-sm font-medium">
              <FileText size={18} className="mr-3 text-blue-400" />
              Bio
            </label>
            <div className="relative group">
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleInputFieldChange}
                className="w-full p-4 pl-5 bg-gray-800 border-2 border-gray-700 rounded-lg shadow-lg
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                           transition-all duration-300 group-hover:border-gray-600 resize-none"
                placeholder="Tell us about yourself..."
                rows={4}
              ></textarea>
              <div className="absolute top-4 right-0 flex items-center pr-3 pointer-events-none">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Gender */}
          <div className="col-span-1" style={getFieldAnimation(7)}>
            <label className="flex items-center text-white mb-3 text-sm font-medium">
              <User size={18} className="mr-3 text-blue-400" />
              Gender
            </label>
            <div className="relative group">
              <select
                name="gender"
                value={formData.gender}
                onChange={handleInputFieldChange}
                className="w-full p-4 pl-5 bg-gray-800 border-2 border-gray-700 rounded-lg shadow-lg
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                           transition-all duration-300 group-hover:border-gray-600 appearance-none"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-5 pointer-events-none">
                <svg
                  className="w-5 h-5 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  ></path>
                </svg>
              </div>
            </div>
          </div>

          {/* Birthday */}
          <div className="col-span-1" style={getFieldAnimation(8)}>
            <label className="flex items-center text-white mb-3 text-sm font-medium">
              <Cake size={18} className="mr-3 text-blue-400" />
              Birthday
            </label>
            <div className="relative group">
              <input
                type="date"
                name="birthday"
                value={formData.birthday}
                onChange={handleInputFieldChange}
                className="w-full p-4 pl-5 bg-gray-800 border-2 border-gray-700 rounded-lg shadow-lg
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                           transition-all duration-300 group-hover:border-gray-600"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="col-span-2" style={getFieldAnimation(9)}>
            <label className="flex items-center text-white mb-3 text-sm font-medium">
              <MapPin size={18} className="mr-3 text-blue-400" />
              Location
            </label>
            <div className="relative group">
              <textarea
                name="location"
                value={formData.location}
                onChange={handleInputFieldChange}
                className="w-full p-4 pl-5 bg-gray-800 border-2 border-gray-700 rounded-lg shadow-lg
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                           transition-all duration-300 group-hover:border-gray-600 resize-none"
                placeholder="Enter your location details"
                rows={3}
              ></textarea>
              <div className="absolute top-4 right-0 flex items-center pr-3 pointer-events-none">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Skills */}
          <div className="col-span-2" style={getFieldAnimation(10)}>
            <label className="flex items-center text-white mb-3 text-sm font-medium">
              <Code size={18} className="mr-3 text-blue-400" />
              Skills
            </label>
            <div className="relative group">
              <input
                type="text"
                name="skills"
                value={formData.skills}
                onChange={handleInputFieldChange}
                className="w-full p-4 pl-5 bg-gray-800 border-2 border-gray-700 rounded-lg shadow-lg
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                           transition-all duration-300 group-hover:border-gray-600"
                placeholder="Enter your skills (e.g., JavaScript, React, Node.js)"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Education */}
          <div className="col-span-2" style={getFieldAnimation(11)}>
            <label className="flex items-center text-white mb-3 text-sm font-medium">
              <BookOpen size={18} className="mr-3 text-blue-400" />
              Education
            </label>
            <div className="relative group">
              <input
                type="text"
                name="education"
                value={formData.education}
                onChange={handleInputFieldChange}
                className="w-full p-4 pl-5 bg-gray-800 border-2 border-gray-700 rounded-lg shadow-lg
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                           transition-all duration-300 group-hover:border-gray-600"
                placeholder="Enter your education details"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="col-span-2 mt-6" style={getFieldAnimation(12)}>
            <button
              type="submit"
              disabled={isSubmitting || !isFormTouched}
              className={`w-full p-4 rounded-lg font-medium text-lg transition-all duration-300 transform ${
                isFormTouched && !isSubmitting ? 'hover:scale-[1.02]' : ''
              } 
                         bg-gradient-to-r from-blue-500 to-blue-700 ${
                           isFormTouched && !isSubmitting ? 'hover:from-blue-600 hover:to-blue-800' : 'opacity-70'
                         }
                         text-white shadow-xl flex items-center justify-center space-x-3 border border-blue-600`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={20} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileRight;