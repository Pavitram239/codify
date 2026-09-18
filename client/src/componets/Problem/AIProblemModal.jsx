import React, { useState } from "react";
import toast from "react-hot-toast";
import {
  Sparkles,
  Wand2,
  FileCode,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import axiosInstance from "../../utils/axiosInstance";

const QUICK_TOPICS = [
  "Array",
  "String",
  "Binary Search",
  "Two Pointers",
  "Stack & Queue",
  "Linked List",
  "Recursion",
  "Dynamic Programming",
  "Trees & Graphs",
  "Hash Map",
];

const AIProblemModal = ({ isOpen, onClose, onApplyProblem }) => {
  const [activeTab, setActiveTab] = useState("generate"); // 'generate' | 'convert'
  const [topic, setTopic] = useState("Array");
  const [difficulty, setDifficulty] = useState("easy");
  const [customPrompt, setCustomPrompt] = useState("");
  const [rawText, setRawText] = useState("");

  const [loading, setLoading] = useState(false);
  const [generatedProblem, setGeneratedProblem] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setErrorMsg("");
    setGeneratedProblem(null);

    if (activeTab === "generate" && !topic.trim()) {
      toast.error("Please enter or select a topic.");
      return;
    }
    if (activeTab === "convert" && !rawText.trim()) {
      toast.error("Please paste the problem content to convert.");
      return;
    }

    setLoading(true);

    try {
      const payload =
        activeTab === "generate"
          ? {
              mode: "generate",
              topic: topic.trim(),
              difficulty,
              prompt: customPrompt.trim(),
            }
          : {
              mode: "convert",
              rawText: rawText.trim(),
              difficulty,
            };

      const response = await axiosInstance.post("/problems/ai-generate/", payload);

      if (response.data && response.data.success) {
        setGeneratedProblem(response.data.data);
        toast.success("Problem generated successfully!");
      } else {
        const msg = response.data?.message || "Failed to generate problem.";
        setErrorMsg(msg);
        toast.error(msg);
      }
    } catch (err) {
      console.error("AI Generation error:", err);
      const msg =
        err.response?.data?.message ||
        "Failed to communicate with AI service. Please check your GEMINI_API_KEY configuration.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!generatedProblem) return;
    onApplyProblem(generatedProblem);
    toast.success("AI generated problem applied to form!");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gradient-to-r from-gray-900 via-indigo-950/40 to-gray-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <Sparkles className="w-6 h-6 animate-pulse text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                AI Problem Assistant
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  Gemini Powered
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Draft new problems or convert LeetCode/HackerRank questions in seconds.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-gray-800 bg-gray-950/60 px-6">
          <button
            onClick={() => {
              setActiveTab("generate");
              setErrorMsg("");
            }}
            className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition ${
              activeTab === "generate"
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/10"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <Wand2 className="w-4 h-4" />
            Generate from Scratch
          </button>
          <button
            onClick={() => {
              setActiveTab("convert");
              setErrorMsg("");
            }}
            className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition ${
              activeTab === "convert"
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/10"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <FileCode className="w-4 h-4" />
            Import from LeetCode / Text
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-gray-200">
          {/* Difficulty Selector (Shared) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Difficulty Level
            </label>
            <div className="flex gap-3">
              {[
                { id: "easy", label: "Easy", color: "border-green-500/50 text-green-400 bg-green-500/10" },
                { id: "medium", label: "Medium", color: "border-yellow-500/50 text-yellow-400 bg-yellow-500/10" },
                { id: "hard", label: "Hard", color: "border-red-500/50 text-red-400 bg-red-500/10" },
              ].map((diff) => (
                <button
                  key={diff.id}
                  type="button"
                  onClick={() => setDifficulty(diff.id)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition ${
                    difficulty === diff.id
                      ? `${diff.color} ring-1 ring-offset-0 ring-white/20 font-bold shadow`
                      : "border-gray-800 bg-gray-950/40 text-gray-400 hover:border-gray-700"
                  }`}
                >
                  {diff.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "generate" ? (
            <>
              {/* Topic Input & Quick Suggestions */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Topic / Category
                </label>
                <input
                  type="text"
                  placeholder="e.g. Array, Dynamic Programming, Two Pointers..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-xs text-gray-400 self-center mr-1">Quick pick:</span>
                  {QUICK_TOPICS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTopic(t)}
                      className={`text-xs px-2 py-0.5 rounded-md border transition ${
                        topic.toLowerCase() === t.toLowerCase()
                          ? "bg-indigo-600 text-white border-indigo-500"
                          : "bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Guidance Prompt */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Additional Guidance / Instructions (Optional)
                </label>
                <textarea
                  rows="3"
                  placeholder="e.g. Focus on prefix sums, include a test case with all negative numbers, story about a library..."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </>
          ) : (
            <>
              {/* LeetCode / Raw Text Paste */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Paste Problem Statement & Examples
                </label>
                <textarea
                  rows="7"
                  placeholder="Paste problem copied from LeetCode, HackerRank, GeeksforGeeks, or PDF assignment..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  💡 The AI will parse the title, description, constraints, and format test cases automatically.
                </p>
              </div>
            </>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="flex items-start gap-3 p-3 bg-red-950/50 border border-red-800/80 rounded-lg text-red-300 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" />
              <div>
                <p className="font-semibold">Generation Failed</p>
                <p className="text-xs text-red-300/90 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Trigger Generate Button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={loading}
              onClick={handleGenerate}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-medium rounded-lg shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Problem with AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {generatedProblem ? "Regenerate Problem" : "Generate with AI"}
                </>
              )}
            </button>
          </div>

          {/* Generated Result Preview */}
          {generatedProblem && (
            <div className="mt-6 p-5 bg-gray-950/70 border border-indigo-500/30 rounded-xl space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    Preview Generated Problem
                  </span>
                  <h3 className="text-lg font-bold text-white mt-1.5 flex items-center gap-2">
                    {generatedProblem.title}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full capitalize font-semibold ${
                        generatedProblem.difficulty === "easy"
                          ? "bg-green-950 text-green-400 border border-green-800"
                          : generatedProblem.difficulty === "medium"
                          ? "bg-yellow-950 text-yellow-400 border border-yellow-800"
                          : "bg-red-950 text-red-400 border border-red-800"
                      }`}
                    >
                      {generatedProblem.difficulty}
                    </span>
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={handleApply}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg shadow-md shadow-green-600/20 transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Apply to Form
                </button>
              </div>

              {/* Description preview */}
              <div>
                <span className="text-xs font-semibold text-gray-400">Description:</span>
                <p className="text-xs text-gray-300 mt-1 line-clamp-3 bg-gray-900/80 p-2.5 rounded border border-gray-800">
                  {generatedProblem.description}
                </p>
              </div>

              {/* Tags */}
              {generatedProblem.tags && generatedProblem.tags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400">Tags:</span>
                  {generatedProblem.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded border border-gray-700"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Test cases breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-800">
                <div className="p-2.5 bg-gray-900/60 rounded-lg border border-gray-800 text-center">
                  <p className="text-xs text-gray-400">Sample I/O</p>
                  <p className="text-base font-bold text-white mt-0.5">
                    {generatedProblem.sampleIO?.length || 0} pairs
                  </p>
                </div>
                <div className="p-2.5 bg-gray-900/60 rounded-lg border border-gray-800 text-center">
                  <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-blue-400" /> Visible Test Cases
                  </p>
                  <p className="text-base font-bold text-white mt-0.5">
                    {generatedProblem.testCases?.filter((tc) => !tc.is_hidden).length || 0}
                  </p>
                </div>
                <div className="p-2.5 bg-gray-900/60 rounded-lg border border-gray-800 text-center">
                  <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
                    <EyeOff className="w-3.5 h-3.5 text-red-400" /> Hidden Test Cases
                  </p>
                  <p className="text-base font-bold text-white mt-0.5">
                    {generatedProblem.testCases?.filter((tc) => tc.is_hidden).length || 0}
                  </p>
                </div>
              </div>

              {/* Bottom apply action */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleApply}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-semibold rounded-lg shadow-lg shadow-green-600/30 transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Apply Problem & Fill Form
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-800 bg-gray-950/60 flex items-center justify-between text-xs text-gray-400">
          <span>You can always review and edit all fields after applying.</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIProblemModal;
