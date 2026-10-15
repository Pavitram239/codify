import PropTypes from "prop-types";


const Statement = ({ problem }) => {
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <p className="whitespace-pre-wrap leading-7 tracking-wide text-slate-600 text-sm sm:text-base text-justify">
        {problem.description}
      </p>

      <p className="mt-4 flex flex-wrap items-center">
        <strong className="text-base sm:text-lg text-slate-900">Difficulty:</strong>
        <span
          className={`ml-3 px-3 py-2 text-sm sm:text-base text-slate-900 font-semibold rounded-lg shadow-md ${
            problem.difficulty === "easy"
              ? "bg-green-600"
              : problem.difficulty === "medium"
              ? "bg-yellow-600"
              : "bg-red-600"
          }`}
        >
          {problem.difficulty.charAt(0).toUpperCase() +
            problem.difficulty.slice(1)}
        </span>
      </p>

      <div className="mt-5">
        <h3 className="font-bold text-base sm:text-lg text-slate-900">
          Input Format:
        </h3>
        <p className="whitespace-pre-wrap m-2 ui-surface p-4 rounded-md shadow-sm text-slate-600 text-sm sm:text-base">
          {problem.inputFormat}
        </p>
      </div>

      <div className="mt-5">
        <h3 className="font-bold text-base sm:text-lg text-slate-900">
          Output Format:
        </h3>
        <p className="whitespace-pre-wrap m-2 ui-surface p-4 rounded-md shadow-sm text-slate-600 text-sm sm:text-base">
          {problem.outputFormat}
        </p>
      </div>

      <div className="mt-5">
        <h3 className="font-bold text-base sm:text-lg text-slate-900">
          Constraints:
        </h3>
        <p className="whitespace-pre-wrap m-2 ui-surface p-4 rounded-md shadow-sm text-slate-600 text-sm sm:text-base">
          {problem.constraints}
        </p>
      </div>

      {problem.sampleIO && problem.sampleIO.length > 0 && (
        <div className="m-2">
          <h3 className="font-bold mb-3 mt-5 text-base sm:text-lg text-slate-900">
            Sample Input/Output:
          </h3>
          {problem.sampleIO.map((sample, index) => (
            <div
              key={index}
              className="mb-4 ui-surface p-4 rounded-lg ui-card-shadow"
            >
              <div className="mb-4">
                <p className="text-slate-900 font-bold text-sm sm:text-base">
                  Input {index + 1}:
                </p>
                <pre className="block ui-surface p-4 rounded-md text-slate-600 text-sm sm:text-base shadow-sm overflow-x-auto">
                  {sample.input}
                </pre>
              </div>
              <div>
                <p className="text-slate-900 font-bold text-sm sm:text-base">
                  Output {index + 1}:
                </p>
                <pre className="block ui-surface p-4 rounded-md text-slate-600 text-sm sm:text-base shadow-sm overflow-x-auto">
                  {sample.output}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


Statement.propTypes = {
  problem: PropTypes.object,
};

export default Statement;
