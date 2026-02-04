
// Central configuration for the Bhamini-P1198 Application
export const APP_VERSION = '1.8.0';

/**
 * PROJECT MASTER SPREADSHEET SETUP
 * All data is pulled from different tabs of the SAME spreadsheet.
 * Ensure the spreadsheet is "Published to the Web" as CSV for each specific tab.
 */

// 1. ATTENDANCE DATA (gid=0)
export const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2T6skNnpDlaFl8n93i0eO7zlF0bK-sdndW1-AIRRpWf-YJkYzXjiC8B1e5hFdZ2KqMsNTKN9NCmPG/pub?gid=0&single=true&output=csv';

// 2. USER REGISTRY (gid=1468151139)
export const GOOGLE_SHEET_USERS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2T6skNnpDlaFl8n93i0eO7zlF0bK-sdndW1-AIRRpWf-YJkYzXjiC8B1e5hFdZ2KqMsNTKN9NCmPG/pub?gid=1468151139&single=true&output=csv';

// 3. IMAGE REGISTRY (gid=14172760)
export const GOOGLE_SHEET_PHOTOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2T6skNnpDlaFl8n93i0eO7zlF0bK-sdndW1-AIRRpWf-YJkYzXjiC8B1e5hFdZ2KqMsNTKN9NCmPG/pub?gid=14172760&single=true&output=csv';

/**
 * 4. MIS DASHBOARD DATA
 */
export const MIS_TARGETS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2T6skNnpDlaFl8n93i0eO7zlF0bK-sdndW1-AIRRpWf-YJkYzXjiC8B1e5hFdZ2KqMsNTKN9NCmPG/pub?gid=2011622883&single=true&output=csv';
export const MIS_ACHIEVEMENTS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2T6skNnpDlaFl8n93i0eO7zlF0bK-sdndW1-AIRRpWf-YJkYzXjiC8B1e5hFdZ2KqMsNTKN9NCmPG/pub?gid=1127739857&single=true&output=csv';

/**
 * 5. BASELINE HOUSEHOLD DATA
 */
export const BASELINE_DATA_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRChs5F_pm2wiyLm9ZWvacWEyp86OpEUORX8WxUvmeVhTlZ3Vs9YXNEbb7ZP2zew8DRjXRrrJRjHkZW/pub?gid=0&single=true&output=csv';

// 6. SYSTEM ENDPOINT
export const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby4omIqQ9ANnowOT75v9b-7LJmrZ1_Fb1iZGfSNRVo8TbkmsuGv4Mf9h36MMwVPkjaiVw/exec';

// UI Fallbacks
export const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200';
