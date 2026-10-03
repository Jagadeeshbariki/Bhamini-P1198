/**
 * BHAMINI P1198 - MASTER BACKEND v8
 * FULLY INTEGRATED: Attendance, Photos, MIS, and Maintenance
 */

// 1. CONFIGURATION - Update these with your IDs
const PHOTO_FOLDER_ID = "1GP52fAokhGYYUU8QT9oMiMykBo9MH9nA"; 
const BILL_FOLDER_ID = "1g7H-IBWQEN_bKOHTbkFv1j0QrvMLpFB0"; 

// The ID of your "Beneficiary List" spreadsheet
const BENEFICIARY_SS_ID = "1Fex87lW89bQE1cafm_JE0wK8tFZkGtdasI2u0zYCbEo"; 

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); 
    
    if (!e.postData || !e.postData.contents) {
      throw new Error("No data received");
    }

    const request = JSON.parse(e.postData.contents);
    let action = request.action;
    
    // Normalize action for robustness
    if (action) {
      if (action === "ADD Photo") action = "addPhoto";
      if (action === "uploadFarmpondPhoto") action = "uploadFarmpondPhoto"; // Stay same
    }

    if (!action) return handleAttendance(request);

    switch (action) {
      case "addPhoto": return handlePhotoUpload(request);
      case "uploadFarmpondPhoto": return handleUpdateBeneficiaryActivity(request);
      case "updateBeneficiaryActivity": return handleUpdateBeneficiaryActivity(request);
      case "deletePhoto": return handleDeletePhoto(request);
      case "addAchievement": return handleAchievement(request);
      case "addMaintenanceBill": return handleMaintenanceBill(request);
      case "updateBillStatus": return handleUpdateBillStatus(request);
      case "updateAsset": return handleUpdateAsset(request);
      case "updateBudgetPerformance": return handleBudgetUpdate(request);
      default: return createResponse("error", "Unknown action: " + action);
    }
  } catch (error) {
    return createResponse("error", error.toString());
  } finally {
    lock.releaseLock();
  }
}

function createResponse(status, message, extra = {}) {
  const response = { status: status, message: message, ...extra };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizeId(id) {
  if (!id) return '';
  return id.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function getSheetByGid(gid) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return null;
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() == gid) return sheets[i];
  }
  return null;
}

/**
 * Handle general photo upload
 */
function handlePhotoUpload(data) {
  const folder = DriveApp.getFolderById(PHOTO_FOLDER_ID);
  const blob = Utilities.newBlob(Utilities.base64Decode(data.photoData || data.data), data.mimeType, data.fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const url = file.getUrl();
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = (ss ? ss.getSheetByName("Photos") : null) || getSheetByGid(14172760);
  if (sheet) {
    sheet.appendRow([
      url, 
      data.type || "General", 
      data.description || "", 
      new Date(), 
      data.activity || "", 
      data.uploadedBy || 'Unknown'
    ]);
  }
  
  return createResponse("success", "Photo uploaded successfully", { url: url });
}

/**
 * Handle beneficiary activity photo update
 */
function handleUpdateBeneficiaryActivity(data) {
  const folder = DriveApp.getFolderById(PHOTO_FOLDER_ID);
  const blob = Utilities.newBlob(Utilities.base64Decode(data.photoData), data.mimeType, data.fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const fileUrl = file.getUrl();
  
  let ss;
  try {
    ss = SpreadsheetApp.openById(BENEFICIARY_SS_ID);
  } catch (e) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  
  let sheet = ss.getSheetByName("Master_Sheet") || ss.getSheets()[0];
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0].map(h => h.toString().toUpperCase().replace(/[\s_]+/g, ''));
  const hhIdCol = headers.findIndex(h => h === 'HHID' || h === 'FARMERID' || h === 'ID' || h.includes('HHID'));
  
  let activity = (data.activity || "").trim().toUpperCase();
  let photoColName = "PHOTO";
  if (activity.includes("FARMPOND")) photoColName = "FARMPONDPHOTO";
  else if (activity.includes("POULTRY")) photoColName = "POULTRYPHOTO";
  else if (activity.includes("GOAT")) photoColName = "GOATPHOTO";
  
  let photoCol = headers.findIndex(h => h === photoColName || h === 'PHOTO' || h === 'IMAGE' || h.includes('PHOTO'));
  const latCol = headers.findIndex(h => h === 'LAT' || h === 'LATITUDE');
  const longCol = headers.findIndex(h => h === 'LONG' || h === 'LONGITUDE' || h === 'LNG');
  const accuracyCol = headers.findIndex(h => h === 'ACCURACY' || h === 'GPS_ACCURACY');
  const userCol = headers.findIndex(h => h.includes('UPLOADEDBY') || h.includes('USER'));

  if (hhIdCol === -1) return createResponse("error", "HH ID column not found");

  const targetId = normalizeId(data.hhId);
  let found = false;
  for (let i = 1; i < rows.length; i++) {
    if (normalizeId(rows[i][hhIdCol]) === targetId) {
      if (photoCol !== -1) sheet.getRange(i + 1, photoCol + 1).setValue(fileUrl);
      if (latCol !== -1) sheet.getRange(i + 1, latCol + 1).setValue(data.lat);
      if (longCol !== -1) sheet.getRange(i + 1, longCol + 1).setValue(data.long);
      if (accuracyCol !== -1) sheet.getRange(i + 1, accuracyCol + 1).setValue(data.accuracy || 0);
      if (userCol !== -1) sheet.getRange(i + 1, userCol + 1).setValue(data.uploadedBy || "Unknown");
      found = true;
      break;
    }
  }

  if (found) return createResponse("success", "Activity photo updated.", { url: fileUrl });
  return createResponse("error", "Beneficiary ID not found.");
}

/**
 * Handle attendance logging
 */
function handleAttendance(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  sheet.appendRow([new Date(), data.name, data.date, data.workingStatus, data.reasonNotWorking, data.placeOfVisit, data.purposeOfVisit, data.workingHours, data.outcome]);
  return createResponse("success", "Attendance logged.");
}

/**
 * Handle achievement logging
 */
function handleAchievement(data) {
  const sheet = getSheetByGid(1127739857) || SpreadsheetApp.getActiveSpreadsheet().getSheetByName("MIS_Achievements");
  if (!sheet) return createResponse("error", "Achievements sheet not found");
  sheet.appendRow([new Date(), data.id, data.value, data.gp, data.remarks]);
  return createResponse("success", "Achievement logged.");
}

/**
 * Handle maintenance bill upload
 */
function handleMaintenanceBill(data) {
  let url = '';
  if (data.data) {
    const folder = DriveApp.getFolderById(BILL_FOLDER_ID);
    const blob = Utilities.newBlob(Utilities.base64Decode(data.data), 'application/pdf', 'bill_' + Date.now() + '.pdf');
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    url = file.getUrl();
  }
  const sheet = getSheetByGid(1851901743) || SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Maintenance");
  if (!sheet) return createResponse("error", "Maintenance sheet not found");
  const id = 'BILL-' + Math.floor(Math.random() * 1000000);
  sheet.appendRow([new Date(), id, data.date, data.category, data.description, data.amount, 'Pending with me', url]);
  return createResponse("success", "Bill uploaded successfully.", { id: id, url: url });
}

/**
 * Handle asset update
 */
function handleUpdateAsset(data) {
  const sheet = getSheetByGid(0) || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (!sheet) return createResponse("error", "Assets sheet not found");
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0].map(h => h.toString().toUpperCase());
  const idCol = headers.indexOf('SNO') === -1 ? headers.indexOf('ID') : headers.indexOf('SNO');
  const statusCol = headers.indexOf('STATUSOFTHEASSET');
  const paymentCol = headers.indexOf('PAYMENTSTATUS');
  const receivedCol = headers.indexOf('HOWMANYRECEIVED');
  if (idCol === -1) return createResponse("error", "ID column not found");
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idCol].toString() === data.id.toString()) {
      if (statusCol !== -1) sheet.getRange(i + 1, statusCol + 1).setValue(data.assetStatus);
      if (paymentCol !== -1) sheet.getRange(i + 1, paymentCol + 1).setValue(data.paymentStatus);
      if (receivedCol !== -1) sheet.getRange(i + 1, receivedCol + 1).setValue(data.qtyReceived);
      return createResponse("success", "Asset updated.");
    }
  }
  return createResponse("error", "Asset ID not found.");
}

/**
 * Handle bill status update
 */
function handleUpdateBillStatus(data) {
  const sheet = getSheetByGid(1851901743) || SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Maintenance");
  if (!sheet) return createResponse("error", "Maintenance sheet not found");
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1].toString() === data.id.toString()) {
      sheet.getRange(i + 1, 7).setValue(data.status); 
      return createResponse("success", "Bill status updated.");
    }
  }
  return createResponse("error", "Bill ID not found.");
}

/**
 * Handle budget performance update
 */
function handleBudgetUpdate(data) {
  const { year, month, type, updates } = data;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("HDFC_Target");
  if (!sheet) return createResponse("error", "HDFC_Target sheet not found");
  const range = sheet.getDataRange();
  const rows = range.getValues();
  const headers = rows[0].map(h => h.toString().toUpperCase().replace(/[\s_]+/g, ''));
  const yearCol = headers.indexOf('YEAR');
  const monthsCol = headers.indexOf('MONTHS');
  const headCodeCol = headers.findIndex(h => h === 'HEADCODE' || h === 'HEAD_CODE');
  const spentCol = headers.findIndex(h => h === 'SPENTAMONT' || h === 'SPENTAMOUNT');
  const unitsCol = headers.indexOf('UNITSCOVERED');
  if (yearCol === -1 || monthsCol === -1 || headCodeCol === -1) return createResponse("error", "Required columns not found");
  const updateCol = type === 'budget' ? spentCol : unitsCol;
  if (updateCol === -1) return createResponse("error", "Update column not found");
  let updatedCount = 0;
  updates.forEach(update => {
    const { code, value } = update;
    for (let i = 1; i < rows.length; i++) {
      const rowYear = rows[i][yearCol].toString().trim();
      const rowMonths = rows[i][monthsCol].toString().toLowerCase();
      const rowCode = rows[i][headCodeCol].toString().trim();
      if (rowYear === year && rowMonths.includes(month.toLowerCase()) && rowCode === code) {
        const currentValue = parseFloat(rows[i][updateCol]) || 0;
        sheet.getRange(i + 1, updateCol + 1).setValue(currentValue + value);
        updatedCount++;
        break; 
      }
    }
  });
  return createResponse("success", "Updated " + updatedCount + " budget items.");
}

/**
 * ROBUST: Handle photo deletion
 */
function handleDeletePhoto(data) {
  const sheet = getSheetByGid(14172760) || SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Photos");
  if (!sheet) return createResponse("error", "Photos sheet not found");
  
  const rows = sheet.getDataRange().getValues();
  let deletedFromSheet = false;
  
  const targetUrl = (data.url || "").toString().trim();
  const targetId = extractDriveId(targetUrl);

  // Search for the URL or ID in the FIRST column (index 0)
  for (let i = 1; i < rows.length; i++) {
    const rowUrl = (rows[i][0] || "").toString().trim();
    const rowId = extractDriveId(rowUrl);
    
    // Match by full URL or by Drive ID
    if (rowUrl === targetUrl || (targetId && rowId === targetId)) {
      sheet.deleteRow(i + 1);
      deletedFromSheet = true;
      break; 
    }
  }
  
  // Also attempt to delete from Google Drive
  if (targetId) {
    try {
      DriveApp.getFileById(targetId).setTrashed(true);
    } catch (e) {
      console.error("Drive deletion error: " + e.message);
    }
  }
  
  return createResponse("success", deletedFromSheet ? "Photo deleted successfully." : "Photo removed from Drive (Registry entry not found).");
}

function extractDriveId(url) {
  if (!url) return null;
  const match = url.match(/(?:id=|\/d\/|folders\/|file\/d\/|open\?id=)([-\w]{25,})/);
  return match ? match[1] : null;
}
