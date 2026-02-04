
import React, { useState, useEffect } from 'react';
import InstallInstructionsModal from './InstallInstructionsModal';

const AutoInstallBanner: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isAppInstalled, setIsAppInstalled] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
            setIsAppInstalled(true);
            return;
        }

        // Listen for install prompt
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            
            // Show banner after a slight delay for better UX
            const timer = setTimeout(() => {
                const hasDismissed = localStorage.getItem('bhamini_install_dismissed');
                if (!hasDismissed) {
                    setIsVisible(true);
                }
            }, 3000);
            
            return () => clearTimeout(timer);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        
        const handleAppInstalled = () => {
            setIsAppInstalled(true);
            setIsVisible(false);
        };
        window.addEventListener('appinstalled', handleAppInstalled);

        // Fallback for iOS/Non-supported browsers
        const checkIOS = () => {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
            if (isIOS && !isAppInstalled) {
                const timer = setTimeout(() => {
                    const hasDismissed = localStorage.getItem('bhamini_install_dismissed');
                    if (!hasDismissed) {
                        setIsVisible(true);
                    }
                }, 4000);
                return () => clearTimeout(timer);
            }
        };
        checkIOS();

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, [isAppInstalled]);

    const handleInstall = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setIsVisible(false);
            }
            setDeferredPrompt(null);
        } else {
            setIsModalOpen(true);
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
        // Don't show again for this session/day
        localStorage.setItem('bhamini_install_dismissed', 'true');
    };

    if (isAppInstalled || !isVisible) return null;

    return (
        <>
            <div className="fixed bottom-6 left-4 right-4 z-[100] animate-slide-up">
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-[0_20px_50px_rgba(0,0,0,0.15)] p-5 rounded-[2rem] flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg flex-shrink-0">
                            <span className="font-black text-xl">B</span>
                        </div>
                        <div>
                            <h4 className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-tight">Install Bhamini App</h4>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Better experience & Offline support</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleDismiss}
                            className="p-3 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                        <button 
                            onClick={handleInstall}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95"
                        >
                            Download
                        </button>
                    </div>
                </div>
            </div>

            {isModalOpen && <InstallInstructionsModal onClose={() => setIsModalOpen(false)} />}

            <style>{`
                @keyframes slide-up-banner {
                    from { transform: translateY(100px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up {
                    animation: slide-up-banner 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
        </>
    );
};

export default AutoInstallBanner;
