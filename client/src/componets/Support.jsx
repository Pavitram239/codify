

const Support = () => {
  return (
    <div className="relative ui-page-height ui-page text-slate-900 font-sans text-justify">
      <div className="px-4 sm:px-8 w-full flex flex-col items-center ui-page ui-page-top sm:ui-page-top">
        <div className="w-full rounded-lg max-w-5xl ui-subtle border shadow-md p-4 sm:p-8">
          <div className="w-full">
            <h1 className="text-2xl sm:text-3xl font-bold text-black mb-4">Help &amp; Support</h1>
            <p className="text-slate-700 break-words leading-relaxed text-sm sm:text-base">
              Need help with the coding platform? Review the guidance below or contact your platform administrator for assistance.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 mt-6 text-slate-700 text-sm sm:text-base">
              <div className="bg-white/70 rounded-lg p-4">
                <h2 className="font-bold text-slate-700 mb-2">Account access</h2>
                <p>For registration, login, password, or profile issues, confirm your account details and try again.</p>
              </div>
              <div className="bg-white/70 rounded-lg p-4">
                <h2 className="font-bold text-slate-700 mb-2">Code submissions</h2>
                <p>Check your selected language, test cases, and code output before submitting a solution.</p>
              </div>
              <div className="bg-white/70 rounded-lg p-4">
                <h2 className="font-bold text-slate-700 mb-2">Contests</h2>
                <p>For contest access, invitations, timing, or result questions, contact the contest organizer.</p>
              </div>
              <div className="bg-white/70 rounded-lg p-4">
                <h2 className="font-bold text-slate-700 mb-2">Report a problem</h2>
                <p>When reporting an issue, include the page, steps to reproduce it, and any relevant error message.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Support;