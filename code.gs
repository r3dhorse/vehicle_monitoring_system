/*
  Vehicle Monitoring System Web App
  Backend: Google Apps Script
  Database: Google Sheets
*/

// Spreadsheet Setup
const SPREADSHEET_ID = "16Ifxb9dCZGl-xYpxStwHufkmzj2TZ8oRIYC3yf1CSqs";
const VEHICLE_SHEET = "VehicleMaster";
const DRIVER_SHEET = "DriverMaster";
const LOG_SHEET = "InOutLogs";
const USERS_SHEET = "Users";

// Serve HTML Web App
function doGet() {
  return HtmlService.createTemplateFromFile("login")
    .evaluate()
    .setTitle("Vehicle Monitoring Login")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Serve main page after login
function loadIndex() {
  return HtmlService.createTemplateFromFile("index")
    .evaluate()
    .getContent();
}

// Serve vehicle list page
function loadVehicleList() {
  return HtmlService.createTemplateFromFile("vehicle-list")
    .evaluate()
    .getContent();
}

// Get all vehicle records with error handling
function getVehicleList() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
    if (!sheet) {
      createInitialSheets();
      return [["Plate Number", "Model", "Year", "Type", "Status", "Current Driver", "Assigned Drivers"]];
    }
    const data = sheet.getDataRange().getValues();
    return data.length > 0 ? data : [["Plate Number", "Model", "Year", "Type", "Status", "Current Driver", "Assigned Drivers"]];
  } catch (error) {
    console.error('Error getting vehicle list:', error);
    throw new Error('Failed to retrieve vehicle data');
  }
}

// Get all driver records with error handling
function getDriverList() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DRIVER_SHEET);
    if (!sheet) {
      createInitialSheets();
      return [["Driver ID", "Name", "License Number", "Phone", "Email", "Status"]];
    }
    const data = sheet.getDataRange().getValues();
    return data.length > 0 ? data : [["Driver ID", "Name", "License Number", "Phone", "Email", "Status"]];
  } catch (error) {
    console.error('Error getting driver list:', error);
    throw new Error('Failed to retrieve driver data');
  }
}

// Log In or Out action with validation and status update
function logVehicleAction(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const logSheet = ss.getSheetByName(LOG_SHEET);
    const vehicleSheet = ss.getSheetByName(VEHICLE_SHEET);
    
    if (!logSheet || !vehicleSheet) {
      createInitialSheets();
      return logVehicleAction(data);
    }
    
    // Log the action
    logSheet.appendRow([
      new Date(),
      data.plateNumber,
      data.driverId,
      data.action,
      data.gate,
      data.remarks || "",
      Session.getActiveUser().getEmail() || "Unknown"
    ]);
    
    // Update vehicle status
    const vehicleData = vehicleSheet.getDataRange().getValues();
    for (let i = 1; i < vehicleData.length; i++) {
      if (vehicleData[i][0] === data.plateNumber) {
        vehicleSheet.getRange(i + 1, 5).setValue(data.action);
        break;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error logging vehicle action:', error);
    throw new Error('Failed to log vehicle action');
  }
}

// Validate vehicle and driver assignment
function validateVehicleDriver(plateNumber, driverId) {
  const vehicleSheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
  const driverSheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DRIVER_SHEET);

  const vehicles = vehicleSheet.getDataRange().getValues();
  const drivers = driverSheet.getDataRange().getValues();

  const vehicle = vehicles.find((row) => row[0] === plateNumber);
  const driver = drivers.find((row) => row[0] === driverId);

  if (!vehicle || !driver) return false;

  const assignedDrivers = vehicle[6]
    .toString()
    .split(",")
    .map((x) => x.trim());
  return assignedDrivers.includes(driverId);
}

// User Login with password hashing simulation
function loginUser(username, password) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);
    if (!sheet) {
      createInitialSheets();
      createDefaultAdmin();
      return loginUser(username, password);
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      createDefaultAdmin();
      return loginUser(username, password);
    }
    
    for (let i = 1; i < data.length; i++) {
      // Simple comparison - in production, use proper password hashing
      if (data[i][0] === username && data[i][1] === password) {
        // Log successful login
        logUserActivity(username, 'login', 'success');
        return { success: true, role: data[i][2] || "user" };
      }
    }
    
    // Log failed login attempt
    logUserActivity(username, 'login', 'failed');
    return { success: false };
  } catch (error) {
    console.error('Error during login:', error);
    return { success: false };
  }
}

// Admin-only: update vehicle record
function updateVehicleRecord(rowIndex, updatedData, userRole) {
  if (userRole !== "admin") {
    throw new Error("Unauthorized: Admin access required.");
  }

  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
    
    // If rowIndex is -1, it's a new vehicle
    if (rowIndex === -1) {
      // Check if plate number already exists
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === updatedData[0]) {
          throw new Error("Vehicle with this plate number already exists");
        }
      }
      
      // Add new vehicle
      sheet.appendRow(updatedData);
    } else {
      // Update existing vehicle
      const range = sheet.getRange(rowIndex + 1, 1, 1, updatedData.length);
      range.setValues([updatedData]);
    }
    
    return true;
  } catch (error) {
    console.error('Error updating vehicle:', error);
    throw error;
  }
}

// Include HTML pages
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Create initial sheets if they don't exist
function createInitialSheets() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Create Vehicle Master sheet
    let vehicleSheet = ss.getSheetByName(VEHICLE_SHEET);
    if (!vehicleSheet) {
      vehicleSheet = ss.insertSheet(VEHICLE_SHEET);
      vehicleSheet.getRange(1, 1, 1, 7).setValues([
        ["Plate Number", "Model", "Year", "Type", "Status", "Current Driver", "Assigned Drivers"]
      ]);
      vehicleSheet.getRange(1, 1, 1, 7).setFontWeight("bold");
    }
    
    // Create Driver Master sheet
    let driverSheet = ss.getSheetByName(DRIVER_SHEET);
    if (!driverSheet) {
      driverSheet = ss.insertSheet(DRIVER_SHEET);
      driverSheet.getRange(1, 1, 1, 6).setValues([
        ["Driver ID", "Name", "License Number", "Phone", "Email", "Status"]
      ]);
      driverSheet.getRange(1, 1, 1, 6).setFontWeight("bold");
    }
    
    // Create Logs sheet
    let logSheet = ss.getSheetByName(LOG_SHEET);
    if (!logSheet) {
      logSheet = ss.insertSheet(LOG_SHEET);
      logSheet.getRange(1, 1, 1, 7).setValues([
        ["Timestamp", "Plate Number", "Driver ID", "Action", "Gate", "Remarks", "Logged By"]
      ]);
      logSheet.getRange(1, 1, 1, 7).setFontWeight("bold");
    }
    
    // Create Users sheet
    let usersSheet = ss.getSheetByName(USERS_SHEET);
    if (!usersSheet) {
      usersSheet = ss.insertSheet(USERS_SHEET);
      usersSheet.getRange(1, 1, 1, 5).setValues([
        ["Username", "Password", "Role", "Email", "Created Date"]
      ]);
      usersSheet.getRange(1, 1, 1, 5).setFontWeight("bold");
    }
    
    return true;
  } catch (error) {
    console.error('Error creating initial sheets:', error);
    throw new Error('Failed to initialize spreadsheet structure');
  }
}

// Create default admin user
function createDefaultAdmin() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);
    const existingData = sheet.getDataRange().getValues();
    
    // Check if admin already exists
    for (let i = 1; i < existingData.length; i++) {
      if (existingData[i][0] === 'admin') {
        return;
      }
    }
    
    // Add default admin
    sheet.appendRow([
      'admin',
      'admin123',
      'admin',
      'admin@vehiclemonitoring.com',
      new Date()
    ]);
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
}

// Log user activity
function logUserActivity(username, action, result) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let activitySheet = ss.getSheetByName('UserActivity');
    
    if (!activitySheet) {
      activitySheet = ss.insertSheet('UserActivity');
      activitySheet.getRange(1, 1, 1, 5).setValues([
        ["Timestamp", "Username", "Action", "Result", "IP Address"]
      ]);
      activitySheet.getRange(1, 1, 1, 5).setFontWeight("bold");
    }
    
    activitySheet.appendRow([
      new Date(),
      username,
      action,
      result,
      'N/A' // GAS doesn't provide IP addresses
    ]);
  } catch (error) {
    console.error('Error logging user activity:', error);
  }
}

// Get vehicle statistics
function getVehicleStatistics() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
    const data = sheet.getDataRange().getValues();
    
    let stats = {
      total: 0,
      in: 0,
      out: 0,
      byType: {},
      byDriver: {}
    };
    
    for (let i = 1; i < data.length; i++) {
      stats.total++;
      const status = data[i][4] || 'OUT';
      const type = data[i][3] || 'Unknown';
      const driver = data[i][5] || 'Unassigned';
      
      if (status === 'IN') {
        stats.in++;
      } else {
        stats.out++;
      }
      
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      stats.byDriver[driver] = (stats.byDriver[driver] || 0) + 1;
    }
    
    return stats;
  } catch (error) {
    console.error('Error getting statistics:', error);
    return null;
  }
}

// Get recent activity logs
function getRecentLogs(limit = 50) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOG_SHEET);
    const data = sheet.getDataRange().getValues();
    
    // Get the most recent logs
    const logs = [];
    const startRow = Math.max(1, data.length - limit);
    
    for (let i = startRow; i < data.length; i++) {
      logs.push(data[i]);
    }
    
    return logs.reverse(); // Most recent first
  } catch (error) {
    console.error('Error getting recent logs:', error);
    return [];
  }
}

// Export logs to PDF (admin only)
function exportLogsToPDF(userRole, dateFrom, dateTo) {
  if (userRole !== 'admin') {
    throw new Error('Unauthorized: Admin access required.');
  }
  
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOG_SHEET);
    const data = sheet.getDataRange().getValues();
    
    // Filter by date range if provided
    const filteredData = data.filter((row, index) => {
      if (index === 0) return true; // Keep header
      const logDate = new Date(row[0]);
      return (!dateFrom || logDate >= new Date(dateFrom)) && 
             (!dateTo || logDate <= new Date(dateTo));
    });
    
    // Create a temporary sheet for export
    const tempSheet = SpreadsheetApp.create('Vehicle Logs Export ' + new Date().toISOString());
    tempSheet.getActiveSheet().getRange(1, 1, filteredData.length, filteredData[0].length)
      .setValues(filteredData);
    
    // Convert to PDF
    const pdf = tempSheet.getAs('application/pdf');
    
    // Clean up
    DriveApp.getFileById(tempSheet.getId()).setTrashed(true);
    
    return pdf.getBytes();
  } catch (error) {
    console.error('Error exporting logs:', error);
    throw new Error('Failed to export logs');
  }
}
