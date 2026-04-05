
import React, { useState } from 'react';
import { 
    LayoutDashboard, Users, Database, Package, 
    ChevronRight, ArrowLeft, Info, TrendingUp,
    Activity, Globe, Search, Filter
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import ActivityDashboards from './ActivityDashboards';
import BeneficiaryExplorer from './BeneficiaryExplorer';
import AssetTrackingDashboard from './AssetTrackingDashboard';
import ODKAssetDistribution from './ODKAssetDistribution';

interface DashboardsPortalProps {
    onNavigate: (page: any) => void;
}

const DashboardsPortal: React.FC<DashboardsPortalProps> = ({ onNavigate }) => {
    const { user } = useAuth();
    const isProjectRole = user?.role === 'admin' || user?.role === 'da' || user?.role === 'project';

    const dashboards = [
        {
            id: 'activity-dashboards' as const,
            title: 'Activity Dashboards',
            description: 'Unified project monitoring and activity tracking with photo evidence.',
            icon: LayoutDashboard,
            color: 'bg-indigo-600',
            lightColor: 'bg-indigo-50',
            textColor: 'text-indigo-600',
            borderColor: 'border-indigo-100',
            allowed: true
        },
        {
            id: 'beneficiary-explorer' as const,
            title: 'Beneficiary Explorer',
            description: 'Deep dive into beneficiary demographics, socio-economic data, and mapping.',
            icon: Users,
            color: 'bg-emerald-600',
            lightColor: 'bg-emerald-50',
            textColor: 'text-emerald-600',
            borderColor: 'border-emerald-100',
            allowed: isProjectRole
        },
        {
            id: 'asset-tracking' as const,
            title: 'Asset Tracking',
            description: 'Inventory management and real-time tracking of project assets and stock.',
            icon: Database,
            color: 'bg-amber-600',
            lightColor: 'bg-amber-50',
            textColor: 'text-amber-600',
            borderColor: 'border-amber-100',
            allowed: isProjectRole
        },
        {
            id: 'odk-asset-distribution' as const,
            title: 'ODK Distribution',
            description: 'Material distribution status and material tracking from ODK data.',
            icon: Package,
            color: 'bg-rose-600',
            lightColor: 'bg-rose-50',
            textColor: 'text-rose-600',
            borderColor: 'border-rose-100',
            allowed: isProjectRole
        }
    ];

    return (
        <div className="max-w-7xl mx-auto space-y-12 pb-20">

            {/* Header */}
            <div className="relative">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
                <div className="relative">
                    <h1 className="text-5xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">
                        Project <span className="text-indigo-600">Dashboards</span>
                    </h1>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.3em] mt-4 flex items-center gap-3">
                        <TrendingUp className="w-4 h-4 text-indigo-600" />
                        Unified Monitoring & Analytics Portal
                    </p>
                </div>
            </div>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {dashboards.filter(d => d.allowed).map((dashboard) => (
                    <button
                        key={dashboard.id}
                        onClick={() => onNavigate(dashboard.id)}
                        className="group relative bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 text-left border border-gray-100 dark:border-gray-800 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 overflow-hidden"
                    >
                        {/* Background Accent */}
                        <div className={`absolute top-0 right-0 w-32 h-32 ${dashboard.color} opacity-[0.03] rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700`} />
                        
                        <div className="relative flex flex-col h-full">
                            <div className="flex items-center justify-between mb-8">
                                <div className={`w-16 h-16 ${dashboard.lightColor} dark:${dashboard.color}/10 ${dashboard.textColor} rounded-3xl flex items-center justify-center group-hover:rotate-12 transition-transform duration-500`}>
                                    <dashboard.icon className="w-8 h-8" />
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl text-gray-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                                    <ChevronRight className="w-5 h-5" />
                                </div>
                            </div>

                            <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-3">
                                {dashboard.title}
                            </h3>
                            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 leading-relaxed mb-8 flex-grow">
                                {dashboard.description}
                            </p>

                            <div className="flex items-center gap-3">
                                <span className={`px-4 py-2 ${dashboard.lightColor} dark:${dashboard.color}/10 ${dashboard.textColor} rounded-xl text-[10px] font-black uppercase tracking-widest`}>
                                    View Dashboard
                                </span>
                                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    Real-time Data
                                </span>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Info Section */}
            <div className="bg-indigo-600 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl shadow-indigo-200 dark:shadow-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full -mr-64 -mt-64 blur-3xl" />
                <div className="relative flex flex-col lg:flex-row items-center gap-12">
                    <div className="lg:w-1/2 space-y-6">
                        <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                            <Info className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">System Overview</span>
                        </div>
                        <h2 className="text-4xl font-black tracking-tight leading-none uppercase">
                            Integrated <br />Monitoring Framework
                        </h2>
                        <p className="text-indigo-100 font-medium text-lg leading-relaxed">
                            This portal provides a centralized access point to all project monitoring systems. 
                            From beneficiary demographics to material distribution and field activity tracking, 
                            all data is synchronized in real-time to ensure project transparency and accountability.
                        </p>
                    </div>
                    <div className="lg:w-1/2 grid grid-cols-2 gap-4 w-full">
                        <div className="bg-white/10 backdrop-blur-md p-6 rounded-[2rem] border border-white/10">
                            <Globe className="w-8 h-8 mb-4 opacity-50" />
                            <p className="text-2xl font-black">100%</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Data Accuracy</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md p-6 rounded-[2rem] border border-white/10">
                            <Activity className="w-8 h-8 mb-4 opacity-50" />
                            <p className="text-2xl font-black">Live</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Field Updates</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md p-6 rounded-[2rem] border border-white/10">
                            <Search className="w-8 h-8 mb-4 opacity-50" />
                            <p className="text-2xl font-black">Deep</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Analytics</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md p-6 rounded-[2rem] border border-white/10">
                            <Filter className="w-8 h-8 mb-4 opacity-50" />
                            <p className="text-2xl font-black">Smart</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Filtering</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardsPortal;
