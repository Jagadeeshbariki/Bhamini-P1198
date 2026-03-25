
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ChevronDown, LayoutDashboard, Users, Database, Droplets, Bird, Home } from 'lucide-react';

interface HeaderProps {
    currentPage: string;
    onNavigate: (page: any) => void;
    onLogout: () => void;
}

interface NavLinkProps {
    page: string;
    targetPage: string;
    currentPage: string;
    onNavigate: (page: any) => void;
    setIsMenuOpen: (open: boolean) => void;
    children: React.ReactNode;
    primary?: boolean;
}

const NavLink: React.FC<NavLinkProps> = ({ page: targetPage, currentPage, onNavigate, setIsMenuOpen, children, primary }) => {
    const isActive = currentPage === targetPage;
    
    return (
        <button
            onClick={() => {
                onNavigate(targetPage);
                setIsMenuOpen(false);
            }}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                isActive 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none scale-105' 
                : primary 
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/40' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600'
            }`}
        >
            {children}
        </button>
    );
};

const Header: React.FC<HeaderProps> = ({ currentPage, onNavigate, onLogout }) => {
    const { user } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isDashboardDropdownOpen, setIsDashboardDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const navLinkProps = { currentPage, onNavigate, setIsMenuOpen };

    // Permission Logic based on User Roles
    const isFieldRole = user?.role === 'field' || user?.role === 'admin' || user?.role === 'da';
    const isProjectRole = user?.role === 'project' || user?.role === 'admin' || user?.role === 'da';
    const canAccessAdmin = user?.role === 'admin';

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDashboardDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const dashboardPages = ['activity', 'beneficiary-explorer', 'asset-tracking', 'eco-farmpond', 'byp-poultry', 'elevated-goat-shed'];
    const isDashboardActive = dashboardPages.includes(currentPage);

    return (
        <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50">
            <div className="container mx-auto px-4 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => onNavigate('home')}
                            className="flex items-center gap-2 focus:outline-none group"
                        >
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xl transition-all duration-500 ${currentPage === 'home' ? 'bg-indigo-600 rotate-12 scale-110' : 'bg-gray-400 dark:bg-gray-700 group-hover:bg-indigo-500 group-hover:rotate-12'}`}>
                                <span className="font-black text-xl">B</span>
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="font-black text-lg tracking-tighter text-gray-900 dark:text-white leading-none">BHAMINI</span>
                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">P1198 MIS</span>
                            </div>
                        </button>
                    </div>

                    <div className="hidden xl:block">
                        <div className="flex items-center gap-2">
                            <NavLink {...navLinkProps} page="home">Gallery</NavLink>
                            
                            {user && (
                                <>
                                    <NavLink {...navLinkProps} page="baseline">Baseline Explorer</NavLink>
                                    <NavLink {...navLinkProps} page="contribution">Contributions</NavLink>
                                    <NavLink {...navLinkProps} page="field-mis" primary>Target vs Achievements</NavLink>
                                </>
                            )}

                            {isProjectRole && (
                                <div className="relative" ref={dropdownRef}>
                                    <button
                                        onClick={() => setIsDashboardDropdownOpen(!isDashboardDropdownOpen)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                                            isDashboardActive 
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
                                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600'
                                        }`}
                                    >
                                        Dashboards
                                        <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isDashboardDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isDashboardDropdownOpen && (
                                        <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <button
                                                onClick={() => { onNavigate('activity'); setIsDashboardDropdownOpen(false); }}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors group"
                                            >
                                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/40 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                    <LayoutDashboard className="w-4 h-4" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-[10px] font-black uppercase text-gray-900 dark:text-white">Activity Dashboard</p>
                                                    <p className="text-[8px] font-bold text-gray-400 uppercase">General Progress</p>
                                                </div>
                                            </button>

                                            <button
                                                onClick={() => { onNavigate('beneficiary-explorer'); setIsDashboardDropdownOpen(false); }}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors group"
                                            >
                                                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/40 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                                    <Users className="w-4 h-4" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-[10px] font-black uppercase text-gray-900 dark:text-white">Beneficiary Explorer</p>
                                                    <p className="text-[8px] font-bold text-gray-400 uppercase">Demographics & Data</p>
                                                </div>
                                            </button>

                                            <button
                                                onClick={() => { onNavigate('asset-tracking'); setIsDashboardDropdownOpen(false); }}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors group"
                                            >
                                                <div className="p-2 bg-amber-50 dark:bg-amber-900/40 rounded-lg group-hover:bg-amber-600 group-hover:text-white transition-colors">
                                                    <Database className="w-4 h-4" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-[10px] font-black uppercase text-gray-900 dark:text-white">Asset Tracking</p>
                                                    <p className="text-[8px] font-bold text-gray-400 uppercase">Inventory & Stock</p>
                                                </div>
                                            </button>

                                            <button
                                                onClick={() => { onNavigate('eco-farmpond'); setIsDashboardDropdownOpen(false); }}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors group"
                                            >
                                                <div className="p-2 bg-blue-50 dark:bg-blue-900/40 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                    <Droplets className="w-4 h-4" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-[10px] font-black uppercase text-gray-900 dark:text-white">Eco-farmpond</p>
                                                    <p className="text-[8px] font-bold text-gray-400 uppercase">GPS Map & Contributions</p>
                                                </div>
                                            </button>

                                            <button
                                                onClick={() => { onNavigate('byp-poultry'); setIsDashboardDropdownOpen(false); }}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors group"
                                            >
                                                <div className="p-2 bg-orange-50 dark:bg-orange-900/40 rounded-lg group-hover:bg-orange-600 group-hover:text-white transition-colors">
                                                    <Bird className="w-4 h-4" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-[10px] font-black uppercase text-gray-900 dark:text-white">BYP Poultry</p>
                                                    <p className="text-[8px] font-bold text-gray-400 uppercase">Project Monitoring</p>
                                                </div>
                                            </button>

                                            <button
                                                onClick={() => { onNavigate('elevated-goat-shed'); setIsDashboardDropdownOpen(false); }}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors group"
                                            >
                                                <div className="p-2 bg-purple-50 dark:bg-purple-900/40 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                                    <Home className="w-4 h-4" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-[10px] font-black uppercase text-gray-900 dark:text-white">Elevated Goat Shed</p>
                                                    <p className="text-[8px] font-bold text-gray-400 uppercase">Project Monitoring</p>
                                                </div>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {isProjectRole && (
                                <NavLink {...navLinkProps} page="budget-tracker">Budget Analysis</NavLink>
                            )}

                            {isFieldRole && (
                                <>
                                    <NavLink {...navLinkProps} page="mark-attendance">Log Work</NavLink>
                                    <NavLink {...navLinkProps} page="attendance-report">My Reports</NavLink>
                                </>
                            )}

                            {canAccessAdmin && <NavLink {...navLinkProps} page="admin">Admin Panel</NavLink>}
                            
                            <div className="h-6 w-px bg-gray-100 dark:bg-gray-800 mx-2"></div>
                            {user ? (
                                <button
                                    onClick={onLogout}
                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors flex items-center gap-2 group"
                                    title="Logout"
                                >
                                    <span className="text-[9px] font-black uppercase group-hover:text-red-500">{user.username}</span>
                                    <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                                </button>
                            ) : (
                                <NavLink {...navLinkProps} page="login">Sign In</NavLink>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="xl:hidden p-2 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-100"
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
                <div className="xl:hidden bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 animate-fade-in overflow-hidden">
                    <div className="px-4 py-6 flex flex-col gap-2">
                        <NavLink {...navLinkProps} page="home">Gallery</NavLink>
                        {user && (
                            <>
                                <NavLink {...navLinkProps} page="baseline">Baseline Explorer</NavLink>
                                <NavLink {...navLinkProps} page="contribution">Contributions</NavLink>
                                <NavLink {...navLinkProps} page="field-mis" primary>Target vs Achievements</NavLink>
                            </>
                        )}
                        {isProjectRole && (
                            <>
                                <button
                                    onClick={() => {
                                        onNavigate('activity');
                                        setIsMenuOpen(false);
                                    }}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                                        isDashboardActive 
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none scale-105' 
                                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600'
                                    }`}
                                >
                                    Dashboards
                                </button>
                                <NavLink {...navLinkProps} page="budget-tracker">Budget Analysis</NavLink>
                            </>
                        )}
                        {isFieldRole && (
                            <>
                                <NavLink {...navLinkProps} page="mark-attendance">Log Work</NavLink>
                                <NavLink {...navLinkProps} page="attendance-report">Monthly Reports</NavLink>
                            </>
                        )}
                        {canAccessAdmin && <NavLink {...navLinkProps} page="admin">Admin Console</NavLink>}
                        {user ? (
                            <button
                                onClick={() => { onLogout(); setIsMenuOpen(false); }}
                                className="w-full text-center py-4 text-xs font-black uppercase text-red-500 bg-red-50 dark:bg-red-900/10 rounded-2xl mt-4"
                            >
                                Logout ({user.username})
                            </button>
                        ) : (
                            <NavLink {...navLinkProps} page="login">Sign In</NavLink>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
};

export default Header;
