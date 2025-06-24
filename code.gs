/*
  Vehicle Monitoring System Web App
  Backend: Google Apps Script
  Database: Google Sheets
*/

// Spreadsheet Setup - Consider using PropertiesService for production
const SPREADSHEET_ID = "16Ifxb9dCZGl-xYpxStwHufkmzj2TZ8oRIYC3yf1CSqs";
const VEHICLE_SHEET = "VehicleMaster";
const DRIVER_SHEET = "DriverMaster";
const LOG_SHEET = "InOutLogs";
const USERS_SHEET = "Users";

// Enhanced error handling
class VehicleMonitoringError extends Error {
  constructor(message, code = 'GENERAL_ERROR') {
    super(message);
    this.name = 'VehicleMonitoringError';
    this.code = code;
  }
}

// Utility functions for better security
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input.toString().trim().replace(/[<>"'&]/g, '');
}

function validateRequired(value, fieldName) {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    throw new VehicleMonitoringError(`${fieldName} is required`, 'VALIDATION_ERROR');
  }
}

// Serve HTML Web App
function doGet(e) {
  // Always serve the single-page application
  return HtmlService.createTemplateFromFile("app")
    .evaluate()
    .setTitle("Vehicle Monitoring System")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Legacy functions kept for compatibility
function loadIndex() {
  return doGet({parameter: {page: 'dashboard'}});
}

// Get all vehicle records with error handling
function getVehicleList() {
  try {
    console.log('Getting vehicle list...');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(VEHICLE_SHEET);
    
    if (!sheet) {
      console.log('Vehicle sheet not found, creating initial setup...');
      createInitialSheets();
      createSampleData();
      sheet = ss.getSheetByName(VEHICLE_SHEET);
      if (!sheet) {
        throw new Error('Failed to create vehicle sheet');
      }
    }
    
    const data = sheet.getDataRange().getValues();
    console.log('Raw vehicle data length:', data.length);
    
    if (data.length <= 1) {
      console.log('No vehicle data found, creating sample data...');
      createSampleData();
      const updatedData = sheet.getDataRange().getValues();
      console.log('Vehicle data after sample creation:', updatedData.length);
      return updatedData;
    }
    
    console.log('Vehicle data retrieved successfully:', data.length, 'rows');
    return data;
  } catch (error) {
    console.error('Error getting vehicle list:', error);
    // Return sample data structure to prevent frontend crashes
    return [
      ["Plate Number", "Make/Model", "Color", "Department/Company", "Year", "Type", "Status", "Current Driver", "Assigned Drivers", "Access Status"],
      ["ABC-123", "Toyota Camry", "White", "IT Department", "2022", "Car", "OUT", "John Doe", "John Doe", "Access"],
      ["XYZ-456", "Honda Civic", "Blue", "HR Department", "2021", "Car", "IN", "Jane Smith", "Jane Smith", "Access"]
    ];
  }
}

// Get all driver records with error handling
function getDriverList() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(DRIVER_SHEET);
    
    if (!sheet) {
      console.log('Driver sheet not found, creating initial setup...');
      createInitialSheets();
      createSampleData();
      sheet = ss.getSheetByName(DRIVER_SHEET);
      if (!sheet) {
        throw new Error('Failed to create driver sheet');
      }
    }
    
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      console.log('No driver data found, creating sample data...');
      createSampleData();
      const updatedData = sheet.getDataRange().getValues();
      console.log('Driver data after sample creation:', updatedData.length);
      return updatedData;
    }
    
    console.log('Driver data retrieved successfully:', data.length, 'rows');
    return data;
  } catch (error) {
    console.error('Error getting driver list:', error);
    // Return minimal structure to prevent frontend crashes
    return [["Driver ID", "Name", "License Number", "Phone", "Email", "Status"]];
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
    
    // Get vehicle data and check access status
    const vehicleData = vehicleSheet.getDataRange().getValues();
    let vehicleRow = -1;
    let accessStatus = 'Access'; // Default if not found
    
    for (let i = 1; i < vehicleData.length; i++) {
      if (vehicleData[i][0] === data.plateNumber) {
        vehicleRow = i;
        accessStatus = vehicleData[i][9] || 'Access'; // Access Status column
        break;
      }
    }
    
    // Check if vehicle has access
    if (data.action === 'IN' && accessStatus !== 'Access') {
      throw new Error(`Vehicle access denied. Status: ${accessStatus}`);
    }
    
    // Log the action
    logSheet.appendRow([
      new Date(),
      data.plateNumber,
      data.driverId,
      data.action,
      data.gate,
      data.remarks || "",
      Session.getActiveUser().getEmail() || "Unknown",
      accessStatus
    ]);
    
    // Update vehicle status
    if (vehicleRow !== -1) {
      vehicleSheet.getRange(vehicleRow + 1, 7).setValue(data.action);
    }
    
    return { success: true, accessStatus: accessStatus };
  } catch (error) {
    console.error('Error logging vehicle action:', error);
    throw error;
  }
}

// Validate vehicle and driver assignment
function validateVehicleDriver(plateNumber, driverId) {
  try {
    const vehicleSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
    const driverSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DRIVER_SHEET);

    const vehicles = vehicleSheet.getDataRange().getValues();
    const drivers = driverSheet.getDataRange().getValues();

    const vehicle = vehicles.find((row) => row[0] === plateNumber);
    const driver = drivers.find((row) => row[0] === driverId);

    if (!vehicle || !driver) {
      return { valid: false, message: 'Vehicle or driver not found' };
    }

    // Check if driver is active
    const driverStatus = driver[5] || 'Active';
    if (driverStatus !== 'Active') {
      return { valid: false, message: `Driver status: ${driverStatus}` };
    }

    // Check if vehicle has access
    const vehicleAccess = vehicle[9] || 'Access';
    if (vehicleAccess !== 'Access') {
      return { valid: false, message: `Vehicle access: ${vehicleAccess}` };
    }

    // Check if driver is assigned to vehicle
    const assignedDrivers = (vehicle[8] || '')
      .toString()
      .split(",")
      .map((x) => x.trim());
    
    if (!assignedDrivers.includes(driverId)) {
      return { valid: false, message: 'Driver not assigned to this vehicle' };
    }

    return { valid: true, message: 'Validation successful' };
  } catch (error) {
    console.error('Error validating vehicle-driver:', error);
    return { valid: false, message: 'Validation error occurred' };
  }
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

// Admin-only: update driver record
function updateDriverRecord(rowIndex, updatedData, userRole) {
  if (userRole !== "admin") {
    throw new Error("Unauthorized: Admin access required.");
  }

  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DRIVER_SHEET);
    
    // If rowIndex is -1, it's a new driver
    if (rowIndex === -1) {
      // Check if driver ID already exists
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === updatedData[0]) {
          throw new Error("Driver with this ID already exists");
        }
      }
      
      // Add new driver
      sheet.appendRow(updatedData);
    } else {
      // Update existing driver
      const range = sheet.getRange(rowIndex + 1, 1, 1, updatedData.length);
      range.setValues([updatedData]);
    }
    
    return true;
  } catch (error) {
    console.error('Error updating driver:', error);
    throw error;
  }
}

// Admin-only: delete driver record
function deleteDriverRecord(rowIndex, userRole) {
  if (userRole !== "admin") {
    throw new Error("Unauthorized: Admin access required.");
  }

  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DRIVER_SHEET);
    sheet.deleteRow(rowIndex + 1);
    return true;
  } catch (error) {
    console.error('Error deleting driver:', error);
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
      vehicleSheet.getRange(1, 1, 1, 10).setValues([
        ["Plate Number", "Make/Model", "Color", "Department/Company", "Year", "Type", "Status", "Current Driver", "Assigned Drivers", "Access Status"]
      ]);
      vehicleSheet.getRange(1, 1, 1, 10).setFontWeight("bold");
      
      // Format the sheet
      vehicleSheet.setFrozenRows(1);
      vehicleSheet.autoResizeColumns(1, 10);
      
      // Add data validation for Access Status
      const accessStatusRange = vehicleSheet.getRange(2, 10, 1000, 1);
      const accessRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['Access', 'No Access', 'Banned'], true)
        .setAllowInvalid(false)
        .build();
      accessStatusRange.setDataValidation(accessRule);
      
      // Add conditional formatting for Access Status
      try {
        const accessRules = [
          SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo('Access')
            .setBackground('#d4edda')
            .setFontColor('#155724')
            .setRanges([accessStatusRange])
            .build(),
          SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo('No Access')
            .setBackground('#fff3cd')
            .setFontColor('#856404')
            .setRanges([accessStatusRange])
            .build(),
          SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo('Banned')
            .setBackground('#f8d7da')
            .setFontColor('#721c24')
            .setRanges([accessStatusRange])
            .build()
        ];
        
        accessRules.forEach(rule => vehicleSheet.addConditionalFormatRule(rule));
      } catch (formatError) {
        console.log('Warning: Could not add conditional formatting:', formatError);
      }
    }
    
    // Create Driver Master sheet
    let driverSheet = ss.getSheetByName(DRIVER_SHEET);
    if (!driverSheet) {
      driverSheet = ss.insertSheet(DRIVER_SHEET);
      driverSheet.getRange(1, 1, 1, 6).setValues([
        ["Driver ID", "Name", "License Number", "Phone", "Email", "Status"]
      ]);
      driverSheet.getRange(1, 1, 1, 6).setFontWeight("bold");
      driverSheet.setFrozenRows(1);
      driverSheet.autoResizeColumns(1, 6);
      
      // Add data validation for Driver Status
      const driverStatusRange = driverSheet.getRange(2, 6, 1000, 1);
      const driverStatusRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['Active', 'Inactive', 'Suspended'], true)
        .setAllowInvalid(false)
        .build();
      driverStatusRange.setDataValidation(driverStatusRule);
    }
    
    // Create Logs sheet
    let logSheet = ss.getSheetByName(LOG_SHEET);
    if (!logSheet) {
      logSheet = ss.insertSheet(LOG_SHEET);
      logSheet.getRange(1, 1, 1, 8).setValues([
        ["Timestamp", "Plate Number", "Driver ID", "Action", "Gate", "Remarks", "Logged By", "Access Status at Time"]
      ]);
      logSheet.getRange(1, 1, 1, 8).setFontWeight("bold");
      logSheet.setFrozenRows(1);
      logSheet.autoResizeColumns(1, 8);
      
      // Format timestamp column
      const timestampRange = logSheet.getRange(2, 1, 1000, 1);
      timestampRange.setNumberFormat("yyyy-mm-dd hh:mm:ss");
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
    if (!sheet) {
      return { total: 0, in: 0, out: 0, byType: {}, byDriver: {} };
    }
    
    const data = sheet.getDataRange().getValues();
    
    let stats = {
      total: 0,
      in: 0,
      out: 0,
      byType: {},
      byDriver: {}
    };
    
    for (let i = 1; i < data.length; i++) {
      if (!data[i] || data[i].length < 10) continue;
      
      stats.total++;
      const status = data[i][6] || 'OUT'; // Status is at index 6
      const type = data[i][5] || 'Unknown'; // Type is at index 5
      const driver = data[i][7] || 'Unassigned'; // Current driver is at index 7
      
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
    return { total: 0, in: 0, out: 0, byType: {}, byDriver: {} };
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

// Debug function to check spreadsheet status
function debugSpreadsheetStatus() {
  try {
    console.log('=== Spreadsheet Debug Info ===');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('Spreadsheet name:', ss.getName());
    console.log('Spreadsheet ID:', ss.getId());
    
    const sheets = ss.getSheets();
    console.log('Available sheets:', sheets.map(s => s.getName()));
    
    // Check each required sheet
    const requiredSheets = [VEHICLE_SHEET, DRIVER_SHEET, LOG_SHEET, USERS_SHEET];
    requiredSheets.forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        const dataRange = sheet.getDataRange();
        console.log(`${sheetName}: ${dataRange.getNumRows()} rows, ${dataRange.getNumColumns()} columns`);
        if (dataRange.getNumRows() > 0) {
          console.log(`${sheetName} first row:`, dataRange.getValues()[0]);
        }
      } else {
        console.log(`${sheetName}: NOT FOUND`);
      }
    });
    
    return 'Debug info logged to console';
  } catch (error) {
    console.error('Debug error:', error);
    return 'Debug failed: ' + error.message;
  }
}

// Test function to verify spreadsheet access
function testSpreadsheetAccess() {
  try {
    console.log('Testing spreadsheet access...');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('Spreadsheet opened successfully:', ss.getName());
    
    const sheets = ss.getSheets();
    console.log('Found sheets:', sheets.map(s => s.getName()));
    
    return {
      success: true,
      spreadsheetName: ss.getName(),
      sheets: sheets.map(s => s.getName())
    };
  } catch (error) {
    console.error('Failed to access spreadsheet:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// Create sample data for initial setup
function createSampleData() {
  try {
    console.log('Creating sample data...');
    
    // Ensure sheets exist first
    createInitialSheets();
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Add sample vehicles
    const vehicleSheet = ss.getSheetByName(VEHICLE_SHEET);
    if (!vehicleSheet) {
      throw new Error('Vehicle sheet not found after creation');
    }
    
    let vehicleData;
    try {
      vehicleData = vehicleSheet.getDataRange().getValues();
    } catch (e) {
      console.log('Error getting vehicle data range, sheet may be empty');
      vehicleData = [];
    }
    
    console.log('Current vehicle data length:', vehicleData.length);
    
    if (vehicleData.length <= 1) {
      console.log('Adding sample vehicles...');
      const sampleVehicles = [
        ['ABC-123', 'Toyota Camry', 'White', 'IT Department', '2022', 'Car', 'OUT', 'DRV001', 'DRV001,DRV002', 'Access'],
        ['XYZ-456', 'Honda Civic', 'Blue', 'HR Department', '2021', 'Car', 'IN', 'DRV002', 'DRV002,DRV003', 'Access'],
        ['MNO-789', 'Ford F-150', 'Red', 'Operations', '2020', 'Truck', 'OUT', 'DRV003', 'DRV003,DRV004', 'No Access'],
        ['PQR-012', 'Chevrolet Express', 'Silver', 'Logistics', '2019', 'Van', 'OUT', 'DRV004', 'DRV004,DRV005', 'Banned'],
        ['STU-345', 'Tesla Model 3', 'Black', 'Executive', '2023', 'Car', 'IN', 'DRV005', 'DRV005,DRV001', 'Access']
      ];
      
      sampleVehicles.forEach(vehicle => {
        vehicleSheet.appendRow(vehicle);
      });
      console.log('Sample vehicles added successfully');
    }
    
    // Add sample drivers
    const driverSheet = ss.getSheetByName(DRIVER_SHEET);
    if (!driverSheet) {
      throw new Error('Driver sheet not found after creation');
    }
    
    let driverData;
    try {
      driverData = driverSheet.getDataRange().getValues();
    } catch (e) {
      console.log('Error getting driver data range, sheet may be empty');
      driverData = [];
    }
    
    console.log('Current driver data length:', driverData.length);
    
    if (driverData.length <= 1) {
      console.log('Adding sample drivers...');
      const sampleDrivers = [
        ['DRV001', 'John Doe', 'LIC001', '555-0101', 'john.doe@example.com', 'Active'],
        ['DRV002', 'Jane Smith', 'LIC002', '555-0102', 'jane.smith@example.com', 'Active'],
        ['DRV003', 'Bob Johnson', 'LIC003', '555-0103', 'bob.johnson@example.com', 'Active'],
        ['DRV004', 'Alice Brown', 'LIC004', '555-0104', 'alice.brown@example.com', 'Inactive'],
        ['DRV005', 'Charlie Davis', 'LIC005', '555-0105', 'charlie.davis@example.com', 'Active']
      ];
      
      sampleDrivers.forEach(driver => {
        driverSheet.appendRow(driver);
      });
      console.log('Sample drivers added successfully');
    }
    
    // Add sample users if needed
    const usersSheet = ss.getSheetByName(USERS_SHEET);
    if (usersSheet) {
      let userData;
      try {
        userData = usersSheet.getDataRange().getValues();
      } catch (e) {
        console.log('Error getting user data range');
        userData = [];
      }
      
      if (userData.length <= 2) {
        console.log('Adding sample users...');
        const sampleUsers = [
          ['user1', 'user123', 'user', 'user1@example.com', new Date()],
          ['user2', 'user456', 'user', 'user2@example.com', new Date()]
        ];
        
        sampleUsers.forEach(user => {
          usersSheet.appendRow(user);
        });
        console.log('Sample users added successfully');
      }
    }
    
    console.log('Sample data creation completed successfully');
    return 'Sample data created successfully';
  } catch (error) {
    console.error('Error creating sample data:', error);
    return 'Failed to create sample data: ' + error.message;
  }
}
