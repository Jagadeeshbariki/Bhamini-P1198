
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
import BudgetTrackerPage from './components/BudgetTrackerPage';
import FieldMISPage from './components/FieldMISPage';
import BaselinePage from './components/BaselinePage';
import ContributionPage from './components/ContributionPage';
import AutoInstallBanner from './components/AutoInstallBanner';
import { APP_VERSION } from './config';

type Page = 'home' | 'activity' | 'login' | 'attendance-report' | 'mark-attendance' | 'admin' | 'budget-tracker' | 'field-mis' | 'baseline' | 'contribution';

const AppContent: React.FC = () => {
    const [page, setPage] = useState<Page>('home');
    const { user, logout } = useAuth();
    const [lastProtectedPage, setLastProtectedPage] = useState<Page>('home');

    useEffect(() => {
        const storedVersion = localStorage.getItem('app_version');
        if (storedVersion !== APP_VERSION) {
            localStorage.clear();
            localStorage.setItem('app_version', APP_VERSION);
            if (user) logout();
            window.location.reload();
        }
    }, [user, logout]);

    useEffect(() => {
        const protectedPages: Page[] = ['activity', 'attendance-report', 'mark-attendance', 'admin', 'budget-tracker', 'field-mis', 'baseline', 'contribution'];
        
        // Handle unauthenticated access to protected pages
        if (!user && protectedPages.includes(page)) {
            setLastProtectedPage(page);
            setPage('login');
            return;
        }

        // Role-based Access Enforcement
        if (user) {
            const isField = user.role === 'field';
            const isProject = user.role === 'project';
            const isAdmin = user.role === 'admin';

            if (isField) {
                // Field staff: Allow Gallery, Attendance, Reports, MIS, Baseline, Contribution
                const restrictedPages: Page[] = ['activity', 'budget-tracker', 'admin'];
                if (restrictedPages.includes(page)) setPage('home');
            } else if (isProject) {
                // Project staff: Allow Gallery, Dashboards, Budget, MIS, Baseline, Contribution
                const restrictedPages: Page[] = ['mark-attendance', 'attendance-report', 'admin'];
                if (restrictedPages.includes(page)) setPage('home');
            }
            // Admin has no restrictions
        }
    }, [user, page]);

    const handleNavigate = (targetPage: Page) => {
        setPage(targetPage);
    };

    const handleLoginSuccess = () => {
        if (lastProtectedPage && lastProtectedPage !== 'login') {
            setPage(lastProtectedPage);
        } else {
            setPage('home');
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
            case 'attendance-report':
                return <ReportPage />;
            case 'mark-attendance':
                return <MarkAttendancePage onNavigate={handleNavigate} />;
            case 'admin':
                return <AdminPage />;
            case 'budget-tracker':
                return <BudgetTrackerPage />;
            case 'field-mis':
                return <FieldMISPage />;
            case 'baseline':
                return <BaselinePage />;
            case 'contribution':
                return <ContributionPage />;
            case 'login':
                return <LoginPage onLoginSuccess={handleLoginSuccess} />;
            default:
                return <HomePage />;
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 transition-colors">
            <Header currentPage={page} onNavigate={handleNavigate} onLogout={handleLogout} />
            <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
                {renderPage()}
            </main>
            <footer className="bg-white dark:bg-gray-900 border-t dark:border-gray-800 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                <div className="flex flex-col items-center gap-2">
                    <p>© {new Date().getFullYear()} Bhamini-P1198. CSR MIS Framework.</p>
                    <p className="text-[10px] font-mono opacity-50 uppercase tracking-[0.3em]">System v{APP_VERSION}</p>
                </div>
            </footer>
            
            {/* Automatic Install Notification */}
            <AutoInstallBanner />
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
