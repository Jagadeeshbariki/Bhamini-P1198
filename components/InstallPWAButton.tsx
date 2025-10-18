import React, { useState, useEffect } from 'react';
import InstallInstructionsModal from './InstallInstructionsModal';

const InstallPWAButton: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isAppInstalled, setIsAppInstalled] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        // Check if the app is already running in standalone mode
        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
            setIsAppInstalled(true);
            return;
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        
        // Listen for the appinstalled event to hide the button after installation
        const handleAppInstalled = () => {
            setIsAppInstalled(true);
            setDeferredPrompt(null);
        };
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                console.log('User accepted the A2HS prompt');
            } else {
                console.log('User dismissed the A2HS prompt');
            }
        } else {
            // If the deferred prompt isn't available, show instructions.
            setIsModalOpen(true);
        }
    };

    if (isAppInstalled) {
        return null; // Don't show the button if the app is already installed.
    }

    return (
        <>
            <button
                onClick={handleInstallClick}
                className="bg-green-500 text-white hover:bg-green-600 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2"
                aria-label="Install application"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 9.293a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span>Install App</span>
            </button>
            {isModalOpen && <InstallInstructionsModal onClose={() => setIsModalOpen(false)} />}
        </>
    );
};

export default InstallPWAButton;
