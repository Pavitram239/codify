import PropTypes from "prop-types";


const ConfirmationModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="ui-surface rounded-lg ui-card-shadow p-6 md:p-8 lg:p-10 w-11/12 md:w-96 lg:w-1/3">
        <h2 className="text-lg md:text-xl lg:text-2xl font-bold text-slate-900 mb-4 md:mb-5 text-center">
          Are you sure?
        </h2>
        <hr className="border-slate-200 mb-4"/>
        <p className="text-slate-600 mb-6 text-center text-sm md:text-base lg:text-lg">
          Your changes will not be saved if you go back. Do you want to proceed?
        </p>
        <div className="flex flex-col md:flex-row justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 md:px-5 md:py-3 ui-subtle text-slate-900 rounded-lg hover:ui-surface transition duration-200 mb-2 md:mb-0 md:mr-2"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 md:px-5 md:py-3 bg-red-600 text-slate-900 rounded-lg hover:bg-red-50 transition duration-200"
          >
            Yes, Go Back
          </button>
        </div>
      </div>
    </div>
  );
};


ConfirmationModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  onConfirm: PropTypes.func,
};

export default ConfirmationModal;
