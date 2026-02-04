
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import InstallPWAButton from './InstallPWAButton';

interface HeaderProps {
    onNavigate: (page: any) => void;
    onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ onNavigate, onLogout }) => {
    const { user } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const NavLink: React.FC<{ page: string; children: React.ReactNode; primary?: boolean }> = ({ page, children, primary }) => (
        <button
            onClick={() => {
                onNavigate(page);
                setIsMenuOpen(false);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                primary 
                ? 'bg-indigo-600 text-white shadow-lg hover:bg-indigo-700' 
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600'
            }`}
        >
            {children}
        </button>
    );

    // Permission Logic based on User Roles
    const isFieldRole = user?.role === 'field' || user?.role === 'admin';
    const isProjectRole = user?.role === 'project' || user?.role === 'admin';
    const isAdmin = user?.role === 'admin';

    return (
        <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50">
            <div className="container mx-auto px-4 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => onNavigate('home')}
                            className="flex items-center gap-2 focus:outline-none group"
                        >
                            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl transition-transform group-hover:rotate-12">
                                <span className="font-black text-xl">B</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-black text-lg tracking-tighter text-gray-900 dark:text-white leading-none">BHAMINI</span>
                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">P1198 MIS</span>
                            </div>
                        </button>
                    </div>

                    <div className="hidden xl:block">
                        <div className="flex items-center gap-2">
                            <NavLink page="home">Gallery</NavLink>
                            
                            {/* Baseline & Target vs Achievement visible to everyone logged in */}
                            {user && (
                                <>
                                    <NavLink page="baseline">Baseline Explorer</NavLink>
                                    <NavLink page="field-mis" primary>Target vs Achievements</NavLink>
                                </>
                            )}

                            {/* Project Staff: Dashboard, Budget */}
                            {isProjectRole && (
                                <>
                                    <NavLink page="activity">Dashboards</NavLink>
                                    <NavLink page="budget-tracker">Budget Analysis</NavLink>
                                </>
                            )}

                            {/* Field Staff: Attendance & Reports */}
                            {isFieldRole && (
                                <>
                                    <NavLink page="mark-attendance">Log Work</NavLink>
                                    <NavLink page="attendance-report">My Reports</NavLink>
                                </>
                            )}

                            {/* Admin Section */}
                            {isAdmin && <NavLink page="admin">Admin Panel</NavLink>}
                            
                            <div className="h-6 w-px bg-gray-100 dark:bg-gray-800 mx-2"></div>
                            {user ? (
                                <button
                                    onClick={onLogout}
                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors flex items-center gap-2"
                                    title="Logout"
                                >
                                    <span className="text-[9px] font-black uppercase">{user.username}</span>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                                </button>
                            ) : (
                                <NavLink page="login">Sign In</NavLink>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <InstallPWAButton />
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="xl:hidden p-2 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                        >
                            <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                                {isMenuOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="xl:hidden bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 animate-fade-in">
                    <div className="px-4 py-6 space-y-3">
                        <NavLink page="home">Gallery</NavLink>
                        {user && (
                            <>
                                <NavLink page="baseline">Baseline Explorer</NavLink>
                                <NavLink page="field-mis" primary>Target vs Achievements</NavLink>
                            </>
                        )}
                        {isProjectRole && (
                            <>
                                <NavLink page="activity">Visual Dashboards</NavLink>
                                <NavLink page="budget-tracker">Budget Analysis</NavLink>
                            </>
                        )}
                        {isFieldRole && (
                            <>
                                <NavLink page="mark-attendance">Log Work</NavLink>
                                <NavLink page="attendance-report">Monthly Reports</NavLink>
                            </>
                        )}
                        {isAdmin && <NavLink page="admin">Admin Console</NavLink>}
                        {user ? (
                            <button
                                onClick={() => { onLogout(); setIsMenuOpen(false); }}
                                className="w-full text-center py-4 text-xs font-black uppercase text-red-500 bg-red-50 dark:bg-red-900/10 rounded-2xl"
                            >
                                Logout ({user.username})
                            </button>
                        ) : (
                            <NavLink page="login">Sign In</NavLink>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
};

export default Header;
