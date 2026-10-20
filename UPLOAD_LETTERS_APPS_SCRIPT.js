/**
 * GOOGLE APPS SCRIPT: UPLOAD SIGNED ACKNOWLEDGEMENT LETTERS
 * 
 * Instructions:
 * 1. Create a NEW Google Spreadsheet (Separate spreadsheet - do not disturb existing sheets).
 * 2. Add headers to Row 1: Timestamp | Cluster | GP | Village | Activity | Beneficiary | File Name | File URL | File ID | Uploaded By | Submission UUID
 * 3. Go to Extensions > Apps Script.
 * 4. Paste this code.
 * 5. Update SPREADSHEET_ID and FOLDER_ID below with your Google Spreadsheet ID and Google Drive Folder ID.
 * 6. Deploy as Web App:
 *    - Execute as: Me
 *    - Who has access: Anyone
 */

const SPREADSHEET_ID = 'YOUR_GOOGLE_SPREADSHEET_ID_HERE'; // Replace with your separate Google Spreadsheet ID (or leave blank if container-bound)
const FOLDER_ID = 'YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE'; // Replace with your Google Drive Folder ID

function getSpreadsheet() {
  if (typeof SPREADSHEET_ID !== 'undefined' && SPREADSHEET_ID && SPREADSHEET_ID !== 'YOUR_GOOGLE_SPREADSHEET_ID_HERE') {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    const cluster = data.cluster || '';
    const gp = data.gp || '';
    const village = data.village || '';
    const activity = data.activity || '';
    const beneficiary = data.beneficiary || '';
    const uploadedBy = data.uploadedBy || 'Unknown User';
    const submissionId = data.submissionId || '';
    
    let fileUrl = '';
    let fileId = '';
    let fileName = data.fileName || 'Signed_Letter.pdf';
    
    if (data.fileData) {
      const folder = DriveApp.getFolderById(FOLDER_ID);
      const blob = Utilities.newBlob(Utilities.base64Decode(data.fileData), data.mimeType || 'application/pdf', fileName);
      const file = folder.createFile(blob);
      file.setDescription('Signed Acknowledgement Letter for ' + beneficiary + ' (UUID: ' + submissionId + ')');
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      fileUrl = file.getUrl();
      fileId = file.getId();
    }
    
    // Log to spreadsheet
    const ss = getSpreadsheet();
    const sheet = ss.getSheets()[0];
    
    sheet.appendRow([
      new Date(),
      cluster,
      gp,
      village,
      activity,
      beneficiary,
      fileName,
      fileUrl,
      fileId,
      uploadedBy,
      submissionId
    ]);
    
    return createResponse("success", "Signed letter uploaded and logged successfully", {
      fileUrl: fileUrl,
      fileId: fileId,
      success: true
    });
    
  } catch (err) {
    return createResponse("error", err.toString(), { success: false });
  }
}

function doGet(e) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheets()[0];
    const rows = sheet.getDataRange().getValues();
    
    const records = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      records.push({
        timestamp: r[0],
        cluster: r[1],
        gp: r[2],
        village: r[3],
        activity: r[4],
        beneficiary: r[5],
        fileName: r[6],
        fileUrl: r[7],
        fileId: r[8],
        uploadedBy: r[9],
        submissionId: r[10] || ''
      });
    }
    
    return createResponse("success", "Fetched records successfully", {
      records: records,
      success: true
    });
  } catch (err) {
    return createResponse("error", err.toString(), { success: false, records: [] });
  }
}

function doOptions(e) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
}

function createResponse(status, message, extra = {}) {
  const response = { status: status, message: message, ...extra };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}
