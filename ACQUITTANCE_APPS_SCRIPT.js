function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.action === 'updateAcquittance') {
      var rowKey = data.rowKey;
      var acquittanceReceived = data.acquittanceReceived;
      var updatedBy = data.updatedBy; // Capture the updatedBy value from payload
      
      // We explicitly open the Asset Distribution Sheet by its ID so it never gets lost
      var ss = SpreadsheetApp.openById('1hxAEQyjRBICVkA3UAxluT8Mue6B8_FMApt6ZgUZov9U');
      var sheets = ss.getSheets();
      
      var updated = false;
      var errorMsg = "Could not find 'KEY' or 'acquittance_received' columns in any sheet.";
      
      for (var s = 0; s < sheets.length; s++) {
        var sheet = sheets[s];
        var lastRow = sheet.getLastRow();
        var lastCol = sheet.getLastColumn();
        
        if (lastRow < 1 || lastCol < 1) continue;
        
        var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
        
        var keyIdx = -1;
        var aqtIdx = -1;
        var updatedByIdx = -1; // Track the 'updated_by' column
        
        for (var i = 0; i < headers.length; i++) {
          var h = String(headers[i]).trim();
          if (h === 'KEY') keyIdx = i;
          if (h === 'acquittance_received' || h.toLowerCase() === 'acquittance received' || h.toLowerCase() === 'acquittance') aqtIdx = i;
          if (h === 'updated_by' || h.toLowerCase() === 'updated by' || h.toLowerCase() === 'updatedby') updatedByIdx = i;
        }
        
        if (keyIdx !== -1 && aqtIdx !== -1) {
          errorMsg = "Row with KEY " + rowKey + " not found in sheet: " + sheet.getName();
          
          var keys = sheet.getRange(1, keyIdx + 1, lastRow, 1).getValues();
          
          for (var r = 1; r < keys.length; r++) { 
            if (String(keys[r][0]).trim() === String(rowKey).trim()) {
              // 1. Update the acquittance column
              sheet.getRange(r + 1, aqtIdx + 1).setValue(acquittanceReceived);
              
              // 2. Update the 'updated_by' column if it exists in the sheet and the payload has a value
              if (updatedByIdx !== -1 && updatedBy) {
                sheet.getRange(r + 1, updatedByIdx + 1).setValue(updatedBy);
              }
              
              updated = true;
              break;
            }
          }
          if (updated) break;
        }
      }
      
      if (updated) {
        return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Updated successfully" })).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({ error: errorMsg })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ error: "Invalid action" })).setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
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
