// ScoreAndLanguageSelector.js
import React from "react";

const ScoreAndLanguageSelector = ({ language, handleLanguageChange, score }) => {
  return (
    <div className="flex justify-between items-center mb-4 mt-10">
      <span className="bg-blue-500 px-3 text-white py-2 rounded-lg shadow-md">
        Score: {score}
      </span>
      <div className="mb-4">
        <label htmlFor="language" className="block text-sm font-medium text-gray-300">
          Select Language:
        </label>
        <select
          id="language"
          className="w-full mt-1 p-3 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value)}
        >
          <option value="java">Java</option>
          <option value="python">Python</option>
          <option value="cpp">C++</option>
        </select>
      </div>
    </div>
  );
};

export default ScoreAndLanguageSelector;
