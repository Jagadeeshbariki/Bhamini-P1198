
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

interface HeaderProps {
    onNavigate: (page: 'home' | 'activity') => void;
    onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ onNavigate, onLogout }) => {
    const { user } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const NavLink: React.FC<{ page: 'home' | 'activity'; children: React.ReactNode }> = ({ page, children }) => (
        <button
            onClick={() => {
                onNavigate(page);
                setIsMenuOpen(false);
            }}
            className="text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors"
        >
            {children}
        </button>
    );

    return (
        <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-50">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <span className="font-bold text-xl text-blue-600 dark:text-blue-400">Bhamini-P1198</span>
                    </div>
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-4">
                            <NavLink page="home">Home</NavLink>
                            <NavLink page="activity">Activity</NavLink>
                            {user && (
                                <button
                                    onClick={onLogout}
                                    className="bg-red-500 text-white hover:bg-red-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                                >
                                    Logout
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="-mr-2 flex md:hidden">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:bg-gray-700 focus:text-white transition"
                        >
                            <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                                {isMenuOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            {isMenuOpen && (
                <div className="md:hidden">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        <NavLink page="home">Home</NavLink>
                        <NavLink page="activity">Activity</NavLink>
                        {user && (
                            <button
                                onClick={() => {
                                    onLogout();
                                    setIsMenuOpen(false);
                                }}
                                className="w-full text-left bg-red-500 text-white hover:bg-red-600 block px-3 py-2 rounded-md text-base font-medium transition-colors"
                            >
                                Logout
                            </button>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
};

export default Header;
