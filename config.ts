
// Central configuration for the application
export const APP_VERSION = '1.4.1';

/**
 * 1. ATTENDANCE DATA SOURCE (Google Sheet)
 * Use "Publish to Web" as CSV for the main attendance tab.
 */
export const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2T6skNnpDlaFl8n93i0eO7zlF0bK-sdndW1-AIRRpWf-YJkYzXjiC8B1e5hFdZ2KqMsNTKN9NCmPG/pub?gid=0&single=true&output=csv';

/**
 * 2. IMAGE REGISTRY (Google Sheet - "Photos" Tab)
 * Directly access all field images without hardcoding them in the app.
 * Create a tab named 'Photos' with headers: URL, Type
 * Publish that specific tab as CSV and paste the link here.
 */
export const GOOGLE_SHEET_PHOTOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2T6skNnpDlaFl8n93i0eO7zlF0bK-sdndW1-AIRRpWf-YJkYzXjiC8B1e5hFdZ2KqMsNTKN9NCmPG/pub?gid=14172760&single=true&output=csv';

/**
 * 3. SUBMISSION ENDPOINT (Google Apps Script)
 */
export const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby4omIqQ9ANnowOT75v9b-7LJmrZ1_Fb1iZGfSNRVo8TbkmsuGv4Mf9h36MMwVPkjaiVw/exec';

// Global Placeholder (Shown only while syncing or if no photos are provided)
export const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200';
