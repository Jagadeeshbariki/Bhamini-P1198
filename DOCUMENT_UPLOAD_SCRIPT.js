/**
 * GOOGLE APPS SCRIPT: CAPACITY BUILDING DOCUMENT UPLOAD & FETCHING
 * 
 * 1. Create a new Google Sheet for Capacity Building Documents.
 * 2. Add headers to Row 1: Timestamp, Submission ID, File Name, File URL, File ID, Uploaded By
 * 3. Go to Extensions > Apps Script.
 * 4. Paste this code.
 * 5. Update FOLDER_ID below.
 * 6. Deploy as Web App:
 *    - Execute as: Me
 *    - Who has access: Anyone
 */

const FOLDER_ID = '1kd81zYbr5_8qUzi__4fTid_ZjNb7jEJm'; 

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // Normalize Submission ID (Remove uuid: prefix)
    const rawId = data.submissionId || 'general';
    const submissionId = rawId.toString().replace(/^uuid:/i, '').trim();
    
    const folder = DriveApp.getFolderById(FOLDER_ID);
    
    // 1. Create the file in Drive
    const blob = Utilities.newBlob(Utilities.base64Decode(data.fileData), data.mimeType, data.fileName);
    const file = folder.createFile(blob);
    file.setDescription('ODK_LINK:' + submissionId);
    
    // 2. Set permissions (Makes it viewable by anyone with the link)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const fileUrl = file.getUrl();
    const fileId = file.getId();
    
    // 3. Log to Spreadsheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0]; 
    sheet.appendRow([
      new Date(),
      submissionId,
      data.fileName,
      fileUrl,
      fileId,
      data.uploadedBy || 'Unknown'
    ]);
    
    return createResponse("success", "File uploaded and logged successfully", {
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
    const rawId = e.parameter.submissionId;
    if (!rawId) throw new Error('Missing submissionId parameter');
    
    const submissionId = rawId.toString().replace(/^uuid:/i, '').trim();
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    
    // Filter rows by normalized submissionId (Column B / Index 1)
    const results = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowId = row[1].toString().replace(/^uuid:/i, '').trim();
      
      if (rowId === submissionId) {
        results.push({
          name: row[2],
          url: row[3],
          id: row[4]
        });
      }
    }
    
    return createResponse("success", results.length > 0 ? "Found " + results.length + " files." : "No files found.", {
      files: results,
      success: true
    });
    
  } catch (err) {
    return createResponse("error", err.toString(), { success: false, files: [] });
  }
}

function createResponse(status, message, extra = {}) {
  const response = { status: status, message: message, ...extra };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}
