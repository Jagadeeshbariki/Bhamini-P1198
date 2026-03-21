/**
 * GOOGLE APPS SCRIPT BACKEND CODE
 * 
 * FIXING PERMISSION ERRORS:
 * If you see "You do not have permission to call DriveApp", follow these steps:
 * 1. In this editor, click the 'Run' button (triangle icon) at the top.
 * 2. It will ask for "Authorization Required". Click 'Review Permissions'.
 * 3. Select your Google Account.
 * 4. Click 'Advanced' -> 'Go to [Project Name] (unsafe)'.
 * 5. Click 'Allow'.
 * 6. IMPORTANT: After allowing, click 'Deploy' > 'New Deployment' and re-deploy.
 */

const FOLDER_ID = '19Wr3jpYB_DU0VkGu0J9oJnJvjTqY1zHk'; // <--- PASTE YOUR FOLDER ID HERE

/**
 * RUN THIS FUNCTION ONCE TO AUTHORIZE DRIVE ACCESS
 * Click 'Run' at the top while this function is selected.
 */
function authorizeDrive() {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  // Create a dummy file to force the 'Write' permission authorization
  const dummyFile = folder.createFile('auth_test.txt', 'This is a temporary file to authorize write access.');
  console.log("Drive write access authorized. Created temporary file: " + dummyFile.getName());
  // Delete the dummy file immediately
  dummyFile.setTrashed(true);
  console.log("Temporary file deleted. Authorization complete.");
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); 
    
    if (FOLDER_ID === 'YOUR_DRIVE_FOLDER_ID') {
      throw new Error("FOLDER_ID is still the placeholder. Please paste your Google Drive Folder ID in the Apps Script code.");
    }
    
    if (!e.postData || !e.postData.contents) {
      throw new Error("No data received in request body");
    }
    
    const data = JSON.parse(e.postData.contents);
    console.log("Received action: " + data.action);
    
    if (data.action === 'uploadFarmpondPhoto') {
      return handlePhotoUpload(data);
    }
    
    return handleAttendance(data);
    
  } catch (error) {
    console.error("Error in doPost: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'error', 
      message: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function handlePhotoUpload(data) {
  if (!data.photoData || !data.hhId) {
    throw new Error("Missing photo data or HH ID");
  }
  
  let folder;
  try {
    let id = FOLDER_ID.trim();
    // If user pasted the full URL, extract the ID automatically
    if (id.includes('folders/')) {
      id = id.split('folders/')[1].split('?')[0].split('/')[0];
    }
    folder = DriveApp.getFolderById(id);
  } catch (e) {
    throw new Error("Could not access Google Drive folder. Ensure FOLDER_ID is correct and the Apps Script has permission to access it. Error: " + e.message);
  }
  
  const blob = Utilities.newBlob(Utilities.base64Decode(data.photoData), data.mimeType || 'image/jpeg', data.fileName || 'photo.jpg');
  const file = folder.createFile(blob);
  
  // Set file to be viewable by anyone with the link
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const fileUrl = file.getUrl();
  console.log("File created: " + fileUrl);
  
  // Update the Spreadsheet
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('ECO-FARMPOND'); // Ensure this matches your sheet name
  
  if (!sheet) {
    throw new Error("Sheet 'ECO-FARMPOND' not found. Please check the sheet name in Apps Script.");
  }
  
  const range = sheet.getDataRange();
  const rows = range.getValues();
  const headers = rows[0];
  
  // Find Column Indices (case-insensitive fuzzy match)
  const hhIdCol = headers.findIndex(h => {
    const s = h.toString().toUpperCase();
    return s.includes('HH_ID') || s.includes('HHID') || s.includes('FARMERID');
  });
  
  const photoCol = headers.findIndex(h => {
    const s = h.toString().toUpperCase();
    return s.includes('PHOTO_LINK') || s.includes('PHOTO');
  });
  
  if (hhIdCol === -1) throw new Error("HH_ID column not found in headers");
  if (photoCol === -1) throw new Error("PHOTO_LINK column not found in headers");
  
  let found = false;
  const targetId = normalizeId(data.hhId);
  console.log("Searching for ID: " + targetId);
  
  for (let i = 1; i < rows.length; i++) {
    if (normalizeId(rows[i][hhIdCol]) === targetId) {
      sheet.getRange(i + 1, photoCol + 1).setValue(fileUrl);
      found = true;
      console.log("Updated row " + (i + 1) + " with URL: " + fileUrl);
      break;
    }
  }
  
  if (!found) {
    throw new Error("Beneficiary ID '" + data.hhId + "' not found in the 'ECO-FARMPOND' sheet.");
  }
  
  return ContentService.createTextOutput(JSON.stringify({ 
    status: 'success', 
    url: fileUrl 
  })).setMimeType(ContentService.MimeType.JSON);
}

function handleAttendance(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Sheet1'); // Adjust if your attendance sheet has a different name
  
  sheet.appendRow([
    new Date(),
    data.name,
    data.date,
    data.workingStatus,
    data.reasonNotWorking,
    data.placeOfVisit,
    data.purposeOfVisit,
    data.workingHours,
    data.outcome
  ]);
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizeId(id) {
  if (!id) return '';
  return id.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
