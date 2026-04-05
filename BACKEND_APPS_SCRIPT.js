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
    
    if (data.action === 'addPhoto') {
      return handleAddPhoto(data);
    }

    if (data.action === 'deletePhoto') {
      return handleDeletePhoto(data);
    }

    if (data.action === 'addAchievement') {
      return handleAddAchievement(data);
    }

    if (data.action === 'addBill') {
      return handleAddBill(data);
    }

    if (data.action === 'updateAsset') {
      return handleUpdateAsset(data);
    }

    if (data.action === 'updateBillStatus') {
      return handleUpdateBillStatus(data);
    }
    
    if (data.action === 'updateBudgetPerformance') {
      return handleBudgetUpdate(data);
    }
    
    if (data.action === 'updateBeneficiaryActivity') {
      return handleUpdateBeneficiaryActivity(data);
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

  const uploadedByCol = headers.findIndex(h => {
    const s = h.toString().toUpperCase();
    return s.includes('UPLOADED_BY') || s.includes('UPLOADED BY') || s.includes('USER') || s.includes('NAME');
  });
  
  if (hhIdCol === -1) throw new Error("HH_ID column not found in headers");
  if (photoCol === -1) throw new Error("PHOTO_LINK column not found in headers");
  
  let found = false;
  const targetId = normalizeId(data.hhId);
  console.log("Searching for ID: " + targetId);
  
  for (let i = 1; i < rows.length; i++) {
    if (normalizeId(rows[i][hhIdCol]) === targetId) {
      sheet.getRange(i + 1, photoCol + 1).setValue(fileUrl);
      if (uploadedByCol !== -1) {
        sheet.getRange(i + 1, uploadedByCol + 1).setValue(data.uploadedBy || 'Unknown');
      }
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

function handleBudgetUpdate(data) {
  const { year, month, type, updates } = data;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("HDFC_Target");
  
  if (!sheet) throw new Error("Sheet 'HDFC_Target' not found. Please ensure the tab name is exactly 'HDFC_Target'.");
  
  const range = sheet.getDataRange();
  const rows = range.getValues();
  const headers = rows[0].map(h => h.toString().toUpperCase().replace(/[\s_]+/g, ''));
  
  const yearCol = headers.indexOf('YEAR');
  const monthsCol = headers.indexOf('MONTHS');
  const headCodeCol = headers.findIndex(h => h === 'HEADCODE' || h === 'HEAD_CODE');
  const spentCol = headers.findIndex(h => h === 'SPENTAMONT' || h === 'SPENTAMOUNT');
  const unitsCol = headers.indexOf('UNITSCOVERED');
  
  if (yearCol === -1 || monthsCol === -1 || headCodeCol === -1) {
    throw new Error("Required columns (YEAR, MONTHS, HEADCODE) not found in 'HDFC_Target' sheet.");
  }
  
  const updateCol = type === 'budget' ? spentCol : unitsCol;
  if (updateCol === -1) {
    throw new Error("Update column (" + (type === 'budget' ? 'SPENTAMONT' : 'UNITSCOVERED') + ") not found.");
  }
  
  let updatedCount = 0;
  updates.forEach(update => {
    const { code, value } = update;
    for (let i = 1; i < rows.length; i++) {
      const rowYear = rows[i][yearCol].toString().trim();
      const rowMonths = rows[i][monthsCol].toString().toLowerCase();
      const rowCode = rows[i][headCodeCol].toString().trim();
      
      if (rowYear === year && rowMonths.includes(month.toLowerCase()) && rowCode === code) {
        // Add the new value to the existing value (Additive Update)
        const currentValue = parseFloat(rows[i][updateCol]) || 0;
        sheet.getRange(i + 1, updateCol + 1).setValue(currentValue + value);
        updatedCount++;
        break; 
      }
    }
  });
  
  return ContentService.createTextOutput(JSON.stringify({ 
    status: 'success', 
    message: "Updated " + updatedCount + " activities in HDFC_Target successfully." 
  })).setMimeType(ContentService.MimeType.JSON);
}

function handleAddPhoto(data) {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const blob = Utilities.newBlob(Utilities.base64Decode(data.data), data.mimeType, data.fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const url = file.getUrl();
  
  const sheet = getSheetByGid(14172760); // PHOTOS sheet
  if (sheet) {
    sheet.appendRow([new Date(), url, data.type, data.description, data.activity, data.uploadedBy || 'Unknown']);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'success', url: url }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleDeletePhoto(data) {
  const sheet = getSheetByGid(14172760);
  if (!sheet) throw new Error("Photos sheet not found");
  
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === data.url) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  
  // Also try to delete from Drive
  try {
    const id = data.url.split('id=')[1] || data.url.split('/d/')[1].split('/')[0];
    DriveApp.getFileById(id).setTrashed(true);
  } catch (e) {
    console.error("Could not delete from Drive: " + e.message);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleAddAchievement(data) {
  const sheet = getSheetByGid(1127739857); // MIS_ACHIEVEMENTS
  if (!sheet) throw new Error("Achievements sheet not found");
  
  sheet.appendRow([new Date(), data.id, data.value, data.gp, data.remarks]);
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleAddBill(data) {
  let url = '';
  if (data.data) {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const blob = Utilities.newBlob(Utilities.base64Decode(data.data), 'application/pdf', 'bill_' + Date.now() + '.pdf');
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    url = file.getUrl();
  }
  
  const sheet = getSheetByGid(1851901743); // MAINTENANCE
  if (!sheet) throw new Error("Maintenance sheet not found");
  
  const id = 'BILL-' + Math.floor(Math.random() * 1000000);
  sheet.appendRow([new Date(), id, data.date, data.category, data.description, data.amount, 'Pending with me', url]);
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleUpdateAsset(data) {
  const sheet = getSheetByGid(0); // ASSETS
  if (!sheet) throw new Error("Assets sheet not found");
  
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0].map(h => h.toString().toUpperCase());
  const idCol = headers.indexOf('SNO') === -1 ? headers.indexOf('ID') : headers.indexOf('SNO');
  const statusCol = headers.indexOf('STATUSOFTHEASSET');
  const paymentCol = headers.indexOf('PAYMENTSTATUS');
  const receivedCol = headers.indexOf('HOWMANYRECEIVED');
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idCol].toString() === data.id.toString()) {
      if (statusCol !== -1) sheet.getRange(i + 1, statusCol + 1).setValue(data.assetStatus);
      if (paymentCol !== -1) sheet.getRange(i + 1, paymentCol + 1).setValue(data.paymentStatus);
      if (receivedCol !== -1) sheet.getRange(i + 1, receivedCol + 1).setValue(data.qtyReceived);
      break;
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleUpdateBillStatus(data) {
  const sheet = getSheetByGid(1851901743);
  if (!sheet) throw new Error("Maintenance sheet not found");
  
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1].toString() === data.id.toString()) {
      sheet.getRange(i + 1, 7).setValue(data.status); // Status is usually 7th column
      break;
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleUpdateBeneficiaryActivity(data) {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const blob = Utilities.newBlob(Utilities.base64Decode(data.photoData), data.mimeType, data.fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const url = file.getUrl();
  
  const sheet = getSheetByGid(0); // Assuming gid 0 is the Beneficiary Sheet
  if (!sheet) throw new Error("Beneficiary sheet not found");
  
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0].map(h => h.toString().toUpperCase());
  
  const hhIdCol = headers.findIndex(h => h.includes('HH_ID') || h.includes('HHID') || h.includes('FARMER ID') || h.includes('FARMER_ID'));
  const latCol = headers.findIndex(h => h === 'LAT' || h === 'LATITUDE');
  const longCol = headers.findIndex(h => h === 'LONG' || h === 'LONGITUDE' || h === 'LNG');
  const imageCol = headers.findIndex(h => h === 'IMAGE' || h === 'PHOTO' || h === 'PICTURE');
  const uploadedByCol = headers.findIndex(h => h.includes('UPLOADED_BY') || h.includes('USER'));
  
  if (hhIdCol === -1) throw new Error("HH_ID column not found");
  
  let found = false;
  const targetId = data.hhId.toString().trim().toUpperCase();
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][hhIdCol].toString().trim().toUpperCase() === targetId) {
      if (latCol !== -1) sheet.getRange(i + 1, latCol + 1).setValue(data.lat);
      if (longCol !== -1) sheet.getRange(i + 1, longCol + 1).setValue(data.long);
      if (imageCol !== -1) sheet.getRange(i + 1, imageCol + 1).setValue(url);
      if (uploadedByCol !== -1) sheet.getRange(i + 1, uploadedByCol + 1).setValue(data.uploadedBy || 'Unknown');
      found = true;
      break;
    }
  }
  
  if (!found) throw new Error("Beneficiary ID not found");
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'success', url: url }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetByGid(gid) {
  const sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() == gid) return sheets[i];
  }
  return null;
}

function normalizeId(id) {
  if (!id) return '';
  return id.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
