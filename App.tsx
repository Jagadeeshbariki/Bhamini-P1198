
import React, { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import Header from './components/Header';
import HomePage from './components/HomePage';
import ActivityPage from './components/ActivityPage';
import LoginPage from './components/LoginPage';

type Page = 'home' | 'activity' | 'login';

const AppContent: React.FC = () => {
    const [page, setPage] = useState<Page>('home');
    const { user, logout } = useAuth();

    useEffect(() => {
        if (!user && page === 'activity') {
            setPage('login');
        }
    }, [user, page]);

    const handleNavigate = (targetPage: 'home' | 'activity') => {
        if (targetPage === 'activity' && !user) {
            setPage('login');
        } else {
            setPage(targetPage);
        }
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
            case 'login':
                return <LoginPage onLoginSuccess={() => setPage('home')} />;
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
