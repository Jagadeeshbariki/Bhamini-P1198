/**
 * GOOGLE APPS SCRIPT: CAPACITY BUILDING DOCUMENT MANAGEMENT
 * 
 * Version: 1.0.0
 * 
 * INSTRUCTIONS:
 * 1. Create a new Google Spreadsheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Delete any existing code and paste this entire script.
 * 4. Update FOLDER_ID below with your Google Drive Folder ID.
 * 5. Update SPREADSHEET_ID below with the ID of the spreadsheet you just created.
 * 6. Click "Deploy" > "New Deployment".
 * 7. Select "Web App".
 * 8. Execute as: "Me".
 * 9. Who has access: "Anyone".
 * 10. Copy the Web App URL and paste it into your app's config.ts as CAPACITY_BUILDING_SCRIPT_URL.
 */

// --- CONFIGURATION ---
const FOLDER_ID = '1kd81zYbr5_8qUzi__4fTid_ZjNb7jEJm'; // Folder for stored documents
const SPREADSHEET_ID = '1cFIHuzwpPrx0C_Z-gKBdg_2pLuHvEPUKA_Fh83NAclk'; // Spreadsheet for metadata tracking
// ---------------------

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // Wait for up to 30 seconds
    
    if (!e.postData || !e.postData.contents) {
      throw new Error("No data received");
    }

    const request = JSON.parse(e.postData.contents);
    const action = request.action;

    switch (action) {
      case "addTrainingDocument":
        return handleUpload(request);
      case "deleteTrainingDocument":
        return handleDelete(request);
      default:
        // Fallback for direct upload requests
        return handleUpload(request);
    }
  } catch (error) {
    return createResponse("error", error.toString());
  } finally {
    lock.releaseLock();
  }
}

/**
 * Handles the upload of documents to Google Drive and logging to Spreadsheet
 */
function handleUpload(data) {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    
    // 1. Create file from base64
    const blob = Utilities.newBlob(
      Utilities.base64Decode(data.fileData || data.data), 
      data.mimeType, 
      data.fileName
    );
    const file = folder.createFile(blob);
    
    // 2. Add ODK Link to description for easier searching in Drive
    file.setDescription('ODK_LINK:' + (data.submissionId || 'general'));
    
    // 3. Set sharing to anyone with link (view only)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const fileUrl = file.getUrl();
    const fileId = file.getId();
    
    // 4. Log metadata to Spreadsheet
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheets()[0]; // Log to the first sheet
    
    sheet.appendRow([
      new Date(),                      // Timestamp
      data.submissionId || "general",  // Submission ID (Link Key)
      data.fileName,                   // Original File Name
      fileUrl,                         // Public Drive URL
      fileId,                          // Drive File ID
      data.uploadedBy || 'Unknown'     // Submitter
    ]);
    
    return createResponse("success", "Document uploaded and registered successfully.", {
      url: fileUrl,
      fileId: fileId,
      status: 'success'
    });
    
  } catch (err) {
    return createResponse("error", "Upload failed: " + err.toString());
  }
}

/**
 * Handles the deletion of documents from Drive and Spreadsheet
 */
function handleDelete(data) {
  try {
    const targetUrl = (data.url || "").toString().trim();
    const targetId = extractDriveId(targetUrl);
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheets()[0];
    const rows = sheet.getDataRange().getValues();
    let deletedFromSheet = false;

    // Search for the row by URL
    for (let i = 1; i < rows.length; i++) {
      const rowUrl = (rows[i][3] || "").toString().trim(); // URL is column 4
      if (rowUrl === targetUrl) {
        sheet.deleteRow(i + 1);
        deletedFromSheet = true;
        break;
      }
    }

    // Attempt to trash the file in Google Drive
    if (targetId) {
      try {
        const file = DriveApp.getFileById(targetId);
        file.setTrashed(true);
      } catch (driveErr) {
        console.warn("Could not delete from Drive: " + driveErr.toString());
      }
    }

    return createResponse("success", deletedFromSheet ? "Document removed successfully." : "Reference not found, but cleanup attempted.");
  } catch (err) {
    return createResponse("error", "Deletion failed: " + err.toString());
  }
}

/**
 * Optional: Fetch documents via GET request
 */
function doGet(e) {
  try {
    const submissionId = e.parameter.submissionId;
    if (!submissionId) {
      return createResponse("error", "Missing submissionId parameter");
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    
    // Filter rows by submission ID (Column 2)
    const filtered = data.slice(1).filter(row => row[1].toString().trim() === submissionId.toString().trim());
    
    const results = filtered.map(row => ({
      name: row[2],
      url: row[3],
      id: row[4],
      timestamp: row[0]
    }));
    
    return createResponse("success", "Found " + results.length + " files.", { files: results });
    
  } catch (err) {
    return createResponse("error", err.toString());
  }
}

/**
 * Utility: Standard JSON Response
 */
function createResponse(status, message, extra = {}) {
  const response = { status: status, message: message, ...extra };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Utility: Extract ID from Drive URL
 */
function extractDriveId(url) {
  if (!url) return null;
  const match = url.match(/(?:id=|\/d\/|folders\/|file\/d\/|open\?id=)([-\w]{25,})/);
  return match ? match[1] : null;
}
