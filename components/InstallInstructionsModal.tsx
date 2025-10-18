import React from 'react';

interface InstallInstructionsModalProps {
    onClose: () => void;
}

const InstallInstructionsModal: React.FC<InstallInstructionsModalProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 m-4 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                <div className="text-center">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Install Application</h3>
                    <div className="mt-2 px-7 py-3">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            To install this app, please use your browser's "Add to Home Screen" or "Install" feature.
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                            <strong>On Desktop:</strong> Look for an install icon in the address bar or find the "Install" option in your browser's main menu (usually three dots or lines).
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                            <strong>On Mobile:</strong> Tap the "Share" button (on iOS) or the three-dot menu (on Android) and select "Add to Home Screen".
                        </p>
                    </div>
                    <div className="items-center px-4 py-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
                            Got it
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InstallInstructionsModal;
