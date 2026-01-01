
import React, { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import Header from './components/Header';
import HomePage from './components/HomePage';
import ActivityPage from './components/ActivityPage';
import LoginPage from './components/LoginPage';
import ReportPage from './components/ReportPage';
import MarkAttendancePage from './components/MarkAttendancePage';
import AdminPage from './components/AdminPage';
import { APP_VERSION } from './config';

type Page = 'home' | 'activity' | 'login' | 'attendance-report' | 'mark-attendance' | 'admin';

const AppContent: React.FC = () => {
    const [page, setPage] = useState<Page>('home');
    const { user, logout } = useAuth();
    const [lastProtectedPage, setLastProtectedPage] = useState<Page>('activity');

    // AUTO-CLEAR OLD SESSIONS ON VERSION UPDATE
    // This solves the "old device" issue by ensuring the browser state matches the current code version.
    useEffect(() => {
        const storedVersion = localStorage.getItem('app_version');
        if (storedVersion !== APP_VERSION) {
            console.log(`Update detected: ${storedVersion || 'initial'} -> ${APP_VERSION}. Clearing cache...`);
            
            // Clear all local storage
            localStorage.clear();
            
            // Set the new version so we don't clear again until the next update
            localStorage.setItem('app_version', APP_VERSION);
            
            // If the user was logged in, reset the auth state
            if (user) {
                logout();
            }
            
            // Hard reload to ensure all service workers and caches are refreshed
            window.location.reload();
        }
    }, [user, logout]);

    useEffect(() => {
        const protectedPages: Page[] = ['activity', 'attendance-report', 'mark-attendance', 'admin'];
        if (!user && protectedPages.includes(page)) {
            setLastProtectedPage(page);
            setPage('login');
        }
        
        // Prevent non-admins from accessing admin page
        if (user && page === 'admin' && !user.isAdmin) {
            setPage('home');
        }
    }, [user, page]);

    const handleNavigate = (targetPage: Page) => {
        setPage(targetPage);
    };

    const handleLoginSuccess = () => {
        setPage(lastProtectedPage);
    };

    const handleLogout = () => {
        logout();
        setPage('home');
    };

    const renderPage = () => {
        switch (page) {
            case 'home':
                return <HomePage />;
            case 'activity':
                return <ActivityPage />;
            case 'attendance-report':
                return <ReportPage />;
            case 'mark-attendance':
                return <MarkAttendancePage onNavigate={handleNavigate} />;
            case 'admin':
                return <AdminPage />;
            case 'login':
                return <LoginPage onLoginSuccess={handleLoginSuccess} />;
            default:
                return <HomePage />;
        }
    };

    return (
        <div className="min-h-screen flex flex-col">
            <Header onNavigate={handleNavigate} onLogout={handleLogout} />
            <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
                {renderPage()}
            </main>
            <footer className="bg-white dark:bg-gray-800 shadow-md p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                <div className="flex flex-col items-center gap-2">
                    <p>© {new Date().getFullYear()} Bhamini-P1198. All rights reserved.</p>
                    <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest">Version {APP_VERSION}</p>
                </div>
            </footer>
        </div>
    );
}

const App: React.FC = () => {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
};

export default App;
