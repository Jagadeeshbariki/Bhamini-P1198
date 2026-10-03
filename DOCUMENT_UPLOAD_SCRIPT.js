/**
 * GOOGLE APPS SCRIPT: CAPACITY BUILDING DOCUMENT MANAGEMENT
 * 
 * Version: 1.2.0
 */

// --- CONFIGURATION ---
const FOLDER_ID = '1kd81zYbr5_8qUzi__4fTid_ZjNb7jEJm'; 
const SPREADSHEET_ID = '1cFIHuzwpPrx0C_Z-gKBdg_2pLuHvEPUKA_Fh83NAclk'; 
// ---------------------

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    if (!e.postData || !e.postData.contents) throw new Error("No data received");

    const request = JSON.parse(e.postData.contents);
    const action = request.action;

    if (action === "deleteTrainingDocument") {
      return handleDelete(request);
    } else {
      // Default to upload for any other action or legacy calls
      return handleUpload(request);
    }
  } catch (error) {
    return createResponse("error", error.toString());
  } finally {
    lock.releaseLock();
  }
}

function handleUpload(data) {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const blob = Utilities.newBlob(Utilities.base64Decode(data.fileData || data.data), data.mimeType, data.fileName);
    const file = folder.createFile(blob);
    file.setDescription('ODK_LINK:' + (data.submissionId || 'general'));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const fileUrl = file.getUrl();
    const fileId = file.getId();
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheets()[0];
    
    sheet.appendRow([
      new Date(),                      
      data.submissionId || "general",  
      data.fileName,                   
      fileUrl,                         
      fileId,                          
      data.uploadedBy || 'Unknown'     
    ]);
    
    return createResponse("success", "Uploaded.", { url: fileUrl, fileId: fileId, success: true });
  } catch (err) {
    return createResponse("error", err.toString());
  }
}

function handleDelete(data) {
  try {
    const targetUrl = (data.url || "").toString().trim();
    const targetId = extractDriveId(targetUrl);
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheets()[0];
    const rows = sheet.getDataRange().getValues();
    let deleted = false;

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][3].toString().trim() === targetUrl) {
        sheet.deleteRow(i + 1);
        deleted = true;
        break;
      }
    }

    if (targetId) {
      try { DriveApp.getFileById(targetId).setTrashed(true); } catch (e) {}
    }

    return createResponse("success", "Deleted.", { success: true });
  } catch (err) {
    return createResponse("error", err.toString());
  }
}

function doGet(e) {
  try {
    const submissionId = e.parameter.submissionId;
    if (!submissionId) return createResponse("error", "Missing ID");
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    
    const results = data.slice(1)
      .filter(row => row[1].toString().trim() === submissionId.toString().trim())
      .map(row => ({ name: row[2], url: row[3], id: row[4] }));
    
    return createResponse("success", "Found.", { files: results, success: true });
  } catch (err) {
    return createResponse("error", err.toString());
  }
}

function createResponse(status, message, extra = {}) {
  const response = { status: status, message: message, ...extra };
  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

function extractDriveId(url) {
  if (!url) return null;
  const match = url.match(/(?:id=|\/d\/|folders\/|file\/d\/|open\?id=)([-\w]{25,})/);
  return match ? match[1] : null;
}
