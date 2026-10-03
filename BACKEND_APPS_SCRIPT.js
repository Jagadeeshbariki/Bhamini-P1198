/**
 * BHAMINI MASTER BACKEND v3
 * Explicitly targets your Master Spreadsheet and Logs errors
 */

const TRAINING_DOC_FOLDER_ID = "1kd81zYbr5_8qUzi__4fTid_ZjNb7jEJm"; 
const MASTER_SPREADSHEET_ID = "1cFIHuzwpPrx0C_Z-gKBdg_2pLuHvEPUKA_Fh83NAclk"; 

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.action === "addTrainingDocument") return handleTrainingDocument(data);
    return createResponse("error", "Unknown action: " + data.action);
  } catch (error) {
    return createResponse("error", "doPost failed: " + error.toString());
  }
}

function doGet(e) {
  try {
    if (e.parameter.action === "getTrainingDocuments") return handleGetTrainingDocuments(e.parameter);
    return createResponse("error", "No action");
  } catch (error) {
    return createResponse("error", "doGet failed: " + error.toString());
  }
}

function handleTrainingDocument(data) {
  // 1. Upload to Drive
  var folder = DriveApp.getFolderById(TRAINING_DOC_FOLDER_ID);
  var blob = Utilities.newBlob(Utilities.base64Decode(data.fileData), data.mimeType, data.fileName);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var fileUrl = file.getUrl();
  
  // 2. Write to Spreadsheet (This is where it was likely failing)
  try {
    var ss = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    var sheet = ss.getSheetByName("Training_Documents");
    
    if (!sheet) {
      sheet = ss.insertSheet("Training_Documents");
      sheet.appendRow(["Timestamp", "Submission ID", "File Name", "File URL", "Uploaded By"]);
    }
    
    // Ensure we are sending the UUID (submissionId) correctly
    sheet.appendRow([
      new Date(), 
      data.submissionId || "no_uuid", 
      data.fileName, 
      fileUrl, 
      data.uploadedBy || "Unknown"
    ]);
    
    return createResponse("success", "Stored in Sheet: " + ss.getName(), { url: fileUrl });
  } catch (sheetError) {
    // If the sheet fails, we still return the file URL so the user knows it's in Drive
    return createResponse("partial_success", "File uploaded to Drive, but Sheet failed: " + sheetError.toString(), { url: fileUrl });
  }
}

function handleGetTrainingDocuments(data) {
  var ss = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
  var sheet = ss.getSheetByName("Training_Documents");
  if (!sheet) return createResponse("success", "No docs sheet found", { files: [] });
  
  var rows = sheet.getDataRange().getValues();
  var submissionId = data.submissionId;
  
  var results = rows.slice(1)
    .filter(function(row) { return row[1] === submissionId; })
    .map(function(row) { return { name: row[2], url: row[3] }; });
    
  return createResponse("success", "Fetched " + results.length + " files", { files: results });
}

function createResponse(status, message, extra) {
  var res = { status: status, message: message };
  if (extra) for (var key in extra) res[key] = extra[key];
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}
