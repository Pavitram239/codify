import PropTypes from "prop-types";
import Editor from "@monaco-editor/react";

const CodeEditorArea = ({
  language,
  code,
  handleEditorChange,
  title = "Code Editor",
  theme,
  handleThemeChange,
}) => {
  

  

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden ui-card-shadow">
      <div className="flex justify-between items-center  text-slate-900 p-3 border-b border-slate-200" style={{backgroundColor: "var(--surface)"}}>
        <div className="text-lg font-bold">{title}</div>
        <div className="relative inline-block">
          <select
            className="border border-slate-200 text-slate-900 rounded-md py-2 pl-3 pr-10 appearance-none outline-none cursor-pointer"
            style={{ backgroundColor: "var(--surface)" }}
            onChange={(e) => handleThemeChange(e.target.value)}
            value={theme}
          >
            <option value="vs-dark">Dark</option>
            <option value="light">Light</option>
            <option value="hc-black">High Contrast</option>
            {/* Add more themes as needed */}
          </select>
          {/* Custom Arrow */}
          <div
            className="absolute top-1/2 right-3 transform -translate-y-1/2 pointer-events-none"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5 8L1 4H9L5 8Z"
                fill="currentColor" // Arrow color
              />
            </svg>
          </div>
        </div>
      </div>
      <Editor
        height="400px"
        language={language}
        value={code}
        onChange={handleEditorChange}
        theme={theme}
        // options={{
        //   fontSize: 14,
        //   automaticLayout: true,
        //   minimap: { enabled: false },
        //   scrollBeyondLastLine: false,
        //   wordWrap: "on",
        //   lineNumbers: "on",
        //   smoothScrolling: true,
        //   cursorSmoothCaretAnimation: true,
        //   suggestOnTriggerCharacters: true, // Enable auto-suggestions
        // }}
        // onMount={onMount}
      />
    </div>
  );
};


CodeEditorArea.propTypes = {
  language: PropTypes.string,
  code: PropTypes.string,
  handleEditorChange: PropTypes.func,
  title: PropTypes.string,
  theme: PropTypes.string,
  handleThemeChange: PropTypes.func,
};

export default CodeEditorArea;
