
/**
 * STAFF ATTENDANCE BACKEND SCRIPT
 * 1. Create a new Google Sheet.
 * 2. Rename the tab to 'StaffAttendance'.
 * 3. Add headers in Row 1: Timestamp, Username, Staff Name, Time Slot, Photo Drive Link, Latitude, Longitude, Location Accuracy, Device Info
 * 4. Create a folder in Google Drive to store photos.
 * 5. Update the FOLDER_ID in this script.
 * 6. Deploy as Web App (Anyone can access).
 */

const FOLDER_ID = 'YOUR_GOOGLE_DRIVE_FOLDER_ID'; // Replace with your folder ID

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('StaffAttendance') || ss.insertSheet('StaffAttendance');
    
    // Set headers if new sheet
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Username', 'Staff Name', 'Time Slot', 'Description', 'Photo Drive Link', 'Latitude', 'Longitude', 'Location Accuracy', 'Device Info']);
    }

    // Save Image to Drive
    let fileUrl = '';
    if (data.image) {
      const folder = DriveApp.getFolderById(FOLDER_ID);
      const fileName = `Attendance_${data.username}_${data.slot}_${new Date().getTime()}.jpg`;
      const blob = Utilities.newBlob(Utilities.base64Decode(data.image), 'image/jpeg', fileName);
      const file = folder.createFile(blob);
      fileUrl = file.getUrl();
    }

    // Log to Sheet
    sheet.appendRow([
      new Date(),
      data.username,
      data.staffName,
      data.slot,
      data.description || '',
      fileUrl,
      data.lat,
      data.lng,
      data.accuracy,
      data.device
    ]);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', url: fileUrl }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
