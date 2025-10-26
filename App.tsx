
import React, { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import Header from './components/Header';
import HomePage from './components/HomePage';
import ActivityPage from './components/ActivityPage';
import LoginPage from './components/LoginPage';
import ReportPage from './components/ReportPage';
import MarkAttendancePage from './components/MarkAttendancePage';

type Page = 'home' | 'activity' | 'login' | 'attendance-report' | 'mark-attendance';

const AppContent: React.FC = () => {
    const [page, setPage] = useState<Page>('home');
    const { user, logout } = useAuth();
    const [lastProtectedPage, setLastProtectedPage] = useState<Page>('activity');


    useEffect(() => {
        const protectedPages: Page[] = ['activity', 'attendance-report', 'mark-attendance'];
        if (!user && protectedPages.includes(page)) {
            setLastProtectedPage(page);
            setPage('login');
        }
    }, [user, page]);

    const handleNavigate = (targetPage: 'home' | 'activity' | 'attendance-report' | 'mark-attendance') => {
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
                return <MarkAttendancePage />;
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
            <footer className="bg-white dark:bg-gray-800 shadow-md p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                © {new Date().getFullYear()} Bhamini-P1198. All rights reserved.
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
