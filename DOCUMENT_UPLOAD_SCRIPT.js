/**
 * GOOGLE APPS SCRIPT: DOCUMENT UPLOAD & TRACKING
 * 
 * 1. Create a new Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Paste this code.
 * 4. Update FOLDER_ID and SPREADSHEET_ID below.
 * 5. Deploy as Web App:
 *    - Execute as: Me
 *    - Who has access: Anyone
 */

const FOLDER_ID = '1kd81zYbr5_8qUzi__4fTid_ZjNb7jEJm'; // Folder you provided
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'; // The Sheet you created

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const folder = DriveApp.getFolderById(FOLDER_ID);
    
    // 1. Create the file in Drive
    const blob = Utilities.newBlob(Utilities.base64Decode(data.fileData), data.mimeType, data.fileName);
    const file = folder.createFile(blob);
    file.setDescription('ODK_LINK:' + data.submissionId);
    
    // 2. Set permissions (Optional: makes it viewable by anyone with the link)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const fileUrl = file.getUrl();
    const fileId = file.getId();
    
    // 3. Log to Spreadsheet
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheets()[0]; // Use first sheet
    sheet.appendRow([
      new Date(),
      data.submissionId,
      data.fileName,
      fileUrl,
      fileId
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      fileUrl: fileUrl,
      fileId: fileId
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const submissionId = e.parameter.submissionId;
    if (!submissionId) throw new Error('Missing submissionId');
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    
    // Skip header row
    const filtered = data.slice(1).filter(row => row[1] === submissionId);
    
    const results = filtered.map(row => ({
      name: row[2],
      url: row[3],
      id: row[4]
    }));
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      files: results
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
