import PropTypes from "prop-types";
// ScoreAndLanguageSelector.js


const ScoreAndLanguageSelector = ({ language, handleLanguageChange, score }) => {
  return (
    <div className="flex justify-between items-center mb-4 mt-10">
      <span className="bg-blue-50 px-3 text-blue-700 py-2 rounded-lg shadow-md">
        Score: {score}
      </span>
      <div className="mb-4">
        <label htmlFor="language" className="block text-sm font-medium text-slate-600">
          Select Language:
        </label>
        <select
          id="language"
          className="w-full mt-1 p-3 ui-surface border border-slate-200 text-slate-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
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


ScoreAndLanguageSelector.propTypes = {
  language: PropTypes.string,
  handleLanguageChange: PropTypes.func,
  score: PropTypes.number,
};

export default ScoreAndLanguageSelector;
