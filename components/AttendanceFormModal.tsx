
import React, { useState } from 'react';
import type { AuthUser } from '../types';

// IMPORTANT: Instructions for Google Apps Script
// To submit data to your Google Sheet, you need to create a Google Apps Script Web App.
// 1. Open your Google Sheet where you collect attendance.
// 2. Go to Extensions > Apps Script.
// 3. Paste the following code into the script editor, replacing any existing content.
//
//    function doPost(e) {
//      try {
//        var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]; // Or specify sheet by name
//        var data = JSON.parse(e.postData.contents);
//
//        // The order of columns in your sheet MUST match this order.
//        var newRow = [
//          new Date(), // Timestamp
//          data.name,
//          data.date,
//          data.workingStatus,
//          data.reasonNotWorking,
//          data.placeOfVisit,
//          data.purposeOfVisit,
//          data.workingHours,
//          data.outcome
//        ];
//
//        sheet.appendRow(newRow);
//
//        return ContentService.createTextOutput(JSON.stringify({ result: 'success' }))
//          .setMimeType(ContentService.MimeType.JSON);
//      } catch (error) {
//        return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: error.toString() }))
//          .setMimeType(ContentService.MimeType.JSON);
//      }
//    }
//
// 4. IMPORTANT: Make sure your Google Sheet columns are in this exact order:
//    Timestamp, SELECT YOUR NAME, CHOOSE DATE, WORKING/LEAVE/HOLIDAY, WRITE THE REASON FOR NOT WORKING, 
//    PLACE OF VISIT, PURPOSE OF VISIT, WORKING HOURS, OUTCOME
//
// 5. Save the script (File > Save).
// 6. Deploy the script:
//    - Click the "Deploy" button (top right) and select "New deployment".
//    - For "Select type", choose "Web app" (the gear icon).
//    - In the "Description" field, you can write "Attendance Form Handler".
//    - For "Execute as", select "Me".
//    - For "Who has access", select "Anyone". This is crucial.
//    - Click "Deploy".
// 7. Authorize the script when prompted.
// 8. Copy the "Web app URL" provided after deployment.
// 9. Paste that URL into the `GOOGLE_APPS_SCRIPT_URL` constant below.

// FIX: Explicitly type the constant as a string to prevent TypeScript from inferring a too-specific literal type.
const GOOGLE_APPS_SCRIPT_URL: string = 'https://script.google.com/macros/s/AKfycby4omIqQ9ANnowOT75v9b-7LJmrZ1_Fb1iZGfSNRVo8TbkmsuGv4Mf9h36MMwVPkjaiVw/exec';

interface AttendanceFormModalProps {
    user: AuthUser;
    date: Date;
    onClose: () => void;
    onSubmitSuccess: (submittedDate: Date) => void;
}

const AttendanceFormModal: React.FC<AttendanceFormModalProps> = ({ user, date, onClose, onSubmitSuccess }) => {
    const [workingStatus, setWorkingStatus] = useState('Working');
    const [reasonNotWorking, setReasonNotWorking] = useState('');
    const [placeOfVisit, setPlaceOfVisit] = useState('');
    const [purposeOfVisit, setPurposeOfVisit] = useState('');
    const [workingHours, setWorkingHours] = useState('');
    const [outcome, setOutcome] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Changed format from M/D/YYYY to D/M/YYYY
    const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (GOOGLE_APPS_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
            setError('The application is not configured for submissions. Please contact the administrator.');
            return;
        }

        setIsSubmitting(true);
        setError('');

        const formData = {
            name: user.username,
            date: formattedDate,
            workingStatus,
            reasonNotWorking: workingStatus === 'Working' ? '' : reasonNotWorking,
            placeOfVisit,
            purposeOfVisit,
            workingHours,
            outcome
        };

        try {
            const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 
                    'Content-Type': 'text/plain' 
                },
                body: JSON.stringify(formData),
            });
            
            if (response.ok) {
                onSubmitSuccess(date);
                onClose();
            } else {
                 const responseText = await response.text();
                 console.error('Submission failed. Status:', response.status, 'Response:', responseText);
                 throw new Error(`Submission failed. The server responded with status ${response.status}.`);
            }

        } catch (err) {
            console.error("Submission error:", err);
            setError(`Submission error: ${err instanceof Error ? err.message : 'An unknown error occurred.'} This can happen due to network issues or browser security policies (CORS). Please check your connection and try again.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 m-4 max-w-lg w-full" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <h3 className="text-xl leading-6 font-medium text-gray-900 dark:text-white">Attendance for {formattedDate}</h3>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                        <input type="text" value={user.username} readOnly className="mt-1 block w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 rounded-md shadow-sm text-gray-500"/>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                        <select value={workingStatus} onChange={e => setWorkingStatus(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                            <option>Working</option>
                            <option>Leave</option>
                            <option>Holiday</option>
                        </select>
                    </div>

                    {workingStatus !== 'Working' ? (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reason for Not Working</label>
                            <textarea value={reasonNotWorking} onChange={e => setReasonNotWorking(e.target.value)} required rows={2} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"></textarea>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Place of Visit</label>
                                <input type="text" value={placeOfVisit} onChange={e => setPlaceOfVisit(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Purpose of Visit</label>
                                <textarea value={purposeOfVisit} onChange={e => setPurposeOfVisit(e.target.value)} required rows={3} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"></textarea>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Working Hours</label>
                                <input type="text" value={workingHours} onChange={e => setWorkingHours(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Outcome</label>
                                <textarea value={outcome} onChange={e => setOutcome(e.target.value)} required rows={3} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"></textarea>
                            </div>
                        </>
                    )}

                    {error && <p className="text-sm text-red-500">{error}</p>}
                    
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 text-base font-medium rounded-md shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300">
                            Cancel
                        </button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-400">
                            {isSubmitting ? 'Submitting...' : 'Submit'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AttendanceFormModal;
