
import React, { useState, useEffect } from 'react';
import type { AuthUser } from '../types';
import { GOOGLE_APPS_SCRIPT_URL } from '../config';

interface AttendanceRecord {
    workingStatus: string;
    reasonNotWorking: string;
    placeOfVisit: string;
    purposeOfVisit: string;
    workingHours: string;
    outcomes: string;
}

interface AttendanceFormModalProps {
    user: AuthUser;
    date: Date;
    initialData?: any; // Record to edit
    onClose: () => void;
    onSubmitSuccess: (submittedDate: Date) => void;
}

const AttendanceFormModal: React.FC<AttendanceFormModalProps> = ({ user, date, initialData, onClose, onSubmitSuccess }) => {
    const [workingStatus, setWorkingStatus] = useState(initialData?.workingStatus || 'Working');
    const [reasonNotWorking, setReasonNotWorking] = useState(initialData?.reasonNotWorking || '');
    const [placeOfVisit, setPlaceOfVisit] = useState(initialData?.placeOfVisit || '');
    const [purposeOfVisit, setPurposeOfVisit] = useState(initialData?.purposeOfVisit || '');
    const [workingHours, setWorkingHours] = useState(initialData?.workingHours || '');
    const [outcome, setOutcome] = useState(initialData?.outcomes || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        const formData = {
            name: user.username,
            date: formattedDate,
            workingStatus,
            reasonNotWorking: workingStatus === 'Working' ? '' : reasonNotWorking,
            placeOfVisit: workingStatus === 'Working' ? placeOfVisit : '',
            purposeOfVisit: workingStatus === 'Working' ? purposeOfVisit : '',
            workingHours: workingStatus === 'Working' ? workingHours : '0',
            outcome: workingStatus === 'Working' ? outcome : ''
        };

        try {
            const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(formData),
            });
            
            if (response.ok) {
                onSubmitSuccess(date);
                onClose();
            } else {
                 throw new Error(`Submission failed with status ${response.status}`);
            }
        } catch (err) {
            setError(`Network error. Ensure your script is deployed as 'Anyone' can access.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 m-4 max-w-lg w-full overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xl font-black text-gray-900 dark:text-white">
                            {initialData ? '📝 Correct Entry' : '➕ Add Entry'}
                        </h3>
                        <span className="text-xs font-bold bg-blue-100 text-blue-600 px-3 py-1 rounded-full">{formattedDate}</span>
                    </div>
                    
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Status</label>
                        <select 
                            value={workingStatus} 
                            onChange={e => setWorkingStatus(e.target.value)} 
                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:ring-0 outline-none transition-all font-semibold"
                        >
                            <option>Working</option>
                            <option>Leave</option>
                            <option>Holiday</option>
                        </select>
                    </div>

                    {workingStatus !== 'Working' ? (
                        <div className="animate-fade-in">
                            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Reason</label>
                            <textarea 
                                value={reasonNotWorking} 
                                onChange={e => setReasonNotWorking(e.target.value)} 
                                required 
                                rows={2} 
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 rounded-xl focus:border-blue-500 outline-none"
                                placeholder="E.g. Sick leave, Festival..."
                            ></textarea>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-fade-in">
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Place of Visit</label>
                                <input type="text" value={placeOfVisit} onChange={e => setPlaceOfVisit(e.target.value)} required className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 rounded-xl focus:border-blue-500 outline-none" placeholder="Village / GP name"/>
                            </div>
                             <div>
                                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Purpose / Activity</label>
                                <textarea value={purposeOfVisit} onChange={e => setPurposeOfVisit(e.target.value)} required rows={2} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 rounded-xl focus:border-blue-500 outline-none" placeholder="What did you do today?"/>
                            </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Hours Spent</label>
                                    <input type="number" step="0.5" value={workingHours} onChange={e => setWorkingHours(e.target.value)} required className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 rounded-xl focus:border-blue-500 outline-none" placeholder="8.0"/>
                                </div>
                             </div>
                             <div>
                                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Outcome</label>
                                <textarea value={outcome} onChange={e => setOutcome(e.target.value)} required rows={2} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 rounded-xl focus:border-blue-500 outline-none" placeholder="Results achieved..."/>
                            </div>
                        </div>
                    )}

                    {error && <p className="text-xs font-bold text-red-500 text-center bg-red-50 p-2 rounded-lg">{error}</p>}
                    
                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 font-bold text-gray-500 hover:text-gray-700 transition-colors">
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSubmitting} 
                            className="px-8 py-2.5 bg-blue-600 text-white font-black rounded-xl shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? 'Syncing...' : initialData ? 'Update Record' : 'Save Attendance'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AttendanceFormModal;
