import { can } from "../../utils/permissions";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import {
  Trophy,
  Clock,
  ArrowLeft,
  BookOpen,
  BarChart2,
  Code,
  Award,
} from "lucide-react";
import { useSelector } from "react-redux";

const Contest = () => {
  const user = useSelector((store) => store.app.user);
  const [contest, setContest] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [, setScreenWidth] = useState(window.innerWidth);
  const [isContestUpcoming, setIsContestUpcoming] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { id } = useParams();

  const handleDashboardConfirmation = (
    problemId,
    title,
    difficulty,
    createdAt
  ) => {
    // Passing the problem data using state with the navigate function
    navigate(`/dashboard/${problemId}`, {
      state: {
        problemTitle: title,
        difficulty: difficulty,
        createdAt: createdAt,
      },
    });
  };

  useEffect(() => {
    let contestInterval;
    let countdownInterval;

    const fetchContest = async () => {
      if (id) {
        try {
          const response = await axiosInstance.get(`/contests/${id}`);
          const contestData = response.data;
          console.log("Contest Data:", contestData);
          setContest(contestData);

          const startTime = new Date(contestData.start_time).getTime();
          const endTime = new Date(contestData.end_time).getTime();
          const currentTime = new Date().getTime();

          if (currentTime < startTime) {
            setTimeLeft(startTime - currentTime);
            setIsContestUpcoming(true);
          } else if (currentTime >= startTime && currentTime <= endTime) {
            setTimeLeft(endTime - currentTime);
            setIsContestUpcoming(false);
          } else {
            setTimeLeft(0);
            setIsContestUpcoming(false);
          }
        } catch (error) {
          console.error("Error fetching contest data:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    const updateCountdown = () => {
      setTimeLeft((prevTime) => Math.max(prevTime - 1000, 0));
    };

    fetchContest();
    contestInterval = setInterval(fetchContest, 60000);
    countdownInterval = setInterval(updateCountdown, 1000);

    return () => {
      clearInterval(contestInterval);
      clearInterval(countdownInterval);
    };
  }, [id]);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleProblemClick = (problemId) => {
    navigate(`/problems/${problemId}`);
  };

  const getContestStatus = () => {
    if (timeLeft <= 0 && contest) {
      const endTime = new Date(contest.end_time).getTime();
      return new Date().getTime() > endTime ? "ended" : "ongoing";
    }
    return isContestUpcoming ? "upcoming" : "ongoing";
  };

  const formatTime = (time) => {
    if (time <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

    const days = Math.floor(time / (1000 * 60 * 60 * 24));
    const hours = Math.floor((time % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((time % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((time % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds };
  };

  if (isLoading) {
    return (
      <div className="ui-page-height ui-gradient    flex justify-center items-center">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-blue-700 animate-pulse" />
            </div>
          </div>
          <p className="mt-6 text-slate-900 text-xl font-medium tracking-wide">
            Loading Contest
            <span className="animate-ellipsis">.</span>
            <span className="animate-ellipsis animation-delay-200">.</span>
            <span className="animate-ellipsis animation-delay-400">.</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-page-height ui-gradient    text-slate-900 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Contest Header with 3D Effect */}
        <div className="relative mb-12 transform perspective-1000 hover:rotate-y-1 transition-transform duration-500 ui-page-top">
          <div className="absolute inset-0 ui-gradient   rounded-lg blur-xl opacity-70 animate-pulse-slow"></div>
          <div className="relative ui-surface backdrop-blur-md rounded-lg overflow-hidden border border-indigo-500/30">
            <div className="absolute top-0 right-0 w-64 h-64 ui-subtle rounded-full filter blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 ui-subtle rounded-full filter blur-3xl opacity-20 translate-y-1/2 -translate-x-1/2"></div>

            <div className="relative z-10 p-8 flex flex-col items-center">
              <div className="ui-gradient   p-4 rounded-full mb-6 shadow-[0_0_20px_rgba(79,70,229,0.5)] animate-float">
                <Trophy size={40} className="text-slate-900" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-center  text-slate-900 ui-gradient    tracking-tight leading-tight mb-4 max-w-3xl">
                {contest?.name}
              </h1>

              {/* Contest Timer */}
              <div className="mt-6 mb-2">
                <h2 className="text-xl font-semibold text-center text-blue-700 mb-4">
                  {getContestStatus() === "upcoming"
                    ? "Starts in"
                    : getContestStatus() === "ongoing"
                    ? "Time Remaining"
                    : "Contest Ended"}
                </h2>
                {getContestStatus() !== "ended" && (
                  <div className="flex gap-4 justify-center">
                    {Object.entries(formatTime(timeLeft)).map(
                      ([unit, value]) => (
                        <div key={unit} className="group perspective">
                          <div className="relative w-20 h-24 ui-gradient   rounded-lg ui-card-shadow border border-indigo-500/30 flex flex-col items-center justify-center transform transition-transform duration-300 group-hover:rotate-y-180 preserve-3d">
                            <div className="absolute inset-0 backface-hidden">
                              <div className="h-full w-full flex flex-col items-center justify-center">
                                <span className="text-3xl font-bold text-slate-900">
                                  {value}
                                </span>
                                <span className="text-xs text-blue-700 uppercase tracking-wider mt-1">
                                  {unit}
                                </span>
                              </div>
                            </div>
                            <div className="absolute inset-0 backface-hidden rotate-y-180">
                              <div className="h-full w-full flex flex-col items-center justify-center bg-indigo-600 rounded-lg">
                                <span className="text-3xl font-bold text-slate-900">
                                  {value}
                                </span>
                                <span className="text-xs text-slate-900 uppercase tracking-wider mt-1">
                                  {unit}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex mb-8 border-b border-slate-200">
          <button
            className={`px-6 py-3 font-medium text-lg transition-all duration-300 relative ${
              activeTab === "details"
                ? "text-slate-900"
                : "text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => setActiveTab("details")}
          >
            <span className="flex items-center gap-2">
              <BookOpen size={18} />
              Details
            </span>
            {activeTab === "details" && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 ui-gradient   animate-grow-x"></span>
            )}
          </button>
          <button
            className={`px-6 py-3 font-medium text-lg transition-all duration-300 relative ${
              activeTab === "problems"
                ? "text-slate-900"
                : "text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => setActiveTab("problems")}
          >
            <span className="flex items-center gap-2">
              <Code size={18} />
              Problems
            </span>
            {activeTab === "problems" && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 ui-gradient   animate-grow-x"></span>
            )}
          </button>
        </div>

        {/* Content Area */}
        <div className="ui-surface backdrop-blur-xl rounded-lg shadow-[0_0_40px_rgba(76,29,149,0.2)] border border-slate-200 overflow-hidden">
          {activeTab === "details" && (
            <div className="p-8">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <BookOpen className="text-blue-700" size={24} />
                  Description
                </h2>
                <div className="ui-page border-2 border-indigo-500/20 rounded-lg p-6 shadow-inner">
                  <p className="text-slate-900 leading-relaxed whitespace-pre-wrap text-lg">
                    {contest.description}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Clock className="text-blue-700" size={20} />
                    Start Time
                  </h3>
                  <div className="ui-page border-2 border-indigo-500/20 rounded-lg p-4 flex items-center">
                    <span className="text-lg text-slate-900">
                      {new Date(contest.start_time).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Clock className="text-blue-700" size={20} />
                    End Time
                  </h3>
                  <div className="ui-page border-2 border-indigo-500/20 rounded-lg p-4 flex items-center">
                    <span className="text-lg text-slate-900">
                      {new Date(contest.end_time).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <h3 className="text-xl font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Award className="text-blue-700" size={20} />
                  Contest Rules
                </h3>
                <div className="ui-page border-2 border-indigo-500/20 rounded-lg p-6 shadow-inner">
                  <ul className="list-disc list-inside space-y-2 text-slate-900">
                    <li>All submissions are evaluated automatically</li>
                    <li>
                      Each problem has a specific score based on difficulty
                    </li>
                    <li>
                      Partial scores may be awarded for partially correct
                      solutions
                    </li>
                    <li>The leaderboard is updated in real-time</li>
                    <li>
                      In case of a tie, the contestant with earlier submission
                      wins
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === "problems" && (
            <div className="p-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Code className="text-blue-700" size={24} />
                Contest Problems
              </h2>

              <div className="space-y-6">
                {contest.problems.map((problem) => (
                  <div
                    key={problem._id}
                    className="ui-page border-2 border-indigo-500/20 rounded-lg overflow-hidden transform transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(79,70,229,0.3)] group"
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-blue-700 group-hover:text-blue-700 transition-colors duration-300">
                          {problem.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 bg-indigo-600/30 px-3 py-1 rounded-full text-sm">
                            Score: {problem.score}
                          </span>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                              problem.difficulty === "easy"
                                ? "bg-green-500/80"
                                : problem.difficulty === "medium"
                                ? "bg-yellow-500/80"
                                : "bg-red-500/80"
                            }`}
                          >
                            {problem.difficulty}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-4">
                        {problem.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="ui-surface px-3 py-1 rounded-full text-xs font-medium text-slate-600 border border-slate-200 group-hover:bg-indigo-50 group-hover:border-indigo-500/30 transition-all duration-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="mt-6 flex justify-end">
                        {can(user, "submissions.review_own", "submissions.review_all") && (
                          <button
                            className="p-2 mr-2 rounded-lg bg-green-600/20 text-green-700 hover:bg-green-600/40 transition-colors"
                            title="Dashboard"
                            onClick={() =>
                              handleDashboardConfirmation(
                                problem._id,
                                problem.title,
                                problem.difficulty,
                                problem.createdAt
                              )
                            }
                          >
                            <BarChart2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleProblemClick(problem._id)}
                          className="px-4 py-2 bg-indigo-600 text-slate-900 rounded-lg hover:bg-indigo-700 transition-colors duration-300 flex items-center gap-2 group"
                        >
                          <span>Solve Problem</span>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 transform transition-transform duration-300 group-hover:translate-x-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Back Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => navigate(-1)}
            className="group flex items-center space-x-2 px-6 py-3 ui-surface backdrop-blur-sm border border-slate-200 rounded-lg hover:bg-indigo-600/20 hover:border-indigo-500/50 transition-all duration-300"
          >
            <ArrowLeft
              className="transform group-hover:-translate-x-1 transition-transform duration-300"
              size={18}
            />
            <span>Back to Contests</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Contest;
