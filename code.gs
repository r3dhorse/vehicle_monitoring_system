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
const GATES_SHEET = "Gates";

// Enhanced error handling
class VehicleMonitoringError extends Error {
  constructor(message, code = 'GENERAL_ERROR') {
    super(message);
    this.name = 'VehicleMonitoringError';
    this.code = code;
  }
}

// Cache utility functions for improved performance
function clearVehicleCache() {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove('vehicle_list_data');
    console.log('Vehicle cache cleared');
  } catch (error) {
    console.warn('Could not clear vehicle cache:', error);
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
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

// Legacy functions kept for compatibility
function loadIndex() {
  return doGet({parameter: {page: 'dashboard'}});
}

// Vehicle Management Functions - CRUD

// Get all vehicles for management (enhanced)
function getVehicleListForManagement() {
  try {
    console.log('Getting vehicle list for management...');
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
    console.log('Vehicle management data retrieved successfully:', data.length, 'rows');
    
    if (data.length <= 1) {
      console.log('No vehicle data found, creating sample data...');
      createSampleData();
      const updatedData = sheet.getDataRange().getValues();
      console.log('Vehicle data after sample creation:', updatedData.length);
      return updatedData;
    }
    
    return data;
  } catch (error) {
    console.error('Error getting vehicle list for management:', error);
    return [
      ["Plate Number", "Make/Model", "Color", "Department/Company", "Year", "Type", "Status", "Current Driver", "Assigned Drivers", "Access Status"],
      ["ABC-123", "Toyota Camry", "White", "IT Department", "2022", "Car", "OUT", "John Doe", "John Doe", "Access"]
    ];
  }
}

// Save vehicle (create or update) - for management
function saveVehicleRecord(vehicleData, userRole, editIndex = -1) {
  if (!['super-admin', 'admin'].includes(userRole)) {
    throw new Error("Unauthorized: Admin access required.");
  }

  try {
    validateRequired(vehicleData.plateNumber, 'Plate Number');
    validateRequired(vehicleData.model, 'Make/Model');

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
    const data = sheet.getDataRange().getValues();
    
    const cleanPlateNumber = sanitizeInput(vehicleData.plateNumber.trim().toUpperCase());
    
    // Check if plate number already exists (excluding current edit)
    for (let i = 1; i < data.length; i++) {
      if (i !== editIndex && data[i][0] === cleanPlateNumber) {
        throw new Error("Vehicle with this plate number already exists");
      }
    }

    const vehicleRow = [
      cleanPlateNumber,
      sanitizeInput(vehicleData.model || ''),
      sanitizeInput(vehicleData.color || ''),
      sanitizeInput(vehicleData.department || ''),
      vehicleData.year || '',
      vehicleData.type || 'Car',
      vehicleData.status || 'OUT',
      sanitizeInput(vehicleData.driver || ''),
      sanitizeInput(vehicleData.assignedDrivers || ''),
      vehicleData.accessStatus || 'Access'
    ];

    if (editIndex > 0 && editIndex < data.length) {
      // Update existing vehicle
      const range = sheet.getRange(editIndex + 1, 1, 1, vehicleRow.length);
      range.setValues([vehicleRow]);
      logUserActivity('system', 'vehicle_updated', `Vehicle ${cleanPlateNumber} updated`);
      clearVehicleCache(); // Clear cache after update
      return { success: true, action: 'updated' };
    } else {
      // Create new vehicle
      sheet.appendRow(vehicleRow);
      logUserActivity('system', 'vehicle_created', `Vehicle ${cleanPlateNumber} created`);
      clearVehicleCache(); // Clear cache after create
      return { success: true, action: 'created' };
    }
  } catch (error) {
    console.error('Error saving vehicle:', error);
    throw error;
  }
}

// Delete vehicle (management)
function deleteVehicleRecord(vehicleIndex, userRole) {
  if (!['super-admin', 'admin'].includes(userRole)) {
    throw new Error("Unauthorized: Admin access required.");
  }

  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
    const data = sheet.getDataRange().getValues();
    
    if (vehicleIndex < 1 || vehicleIndex >= data.length) {
      throw new Error("Invalid vehicle index");
    }
    
    const plateNumber = data[vehicleIndex][0];
    
    // Check if vehicle has recent activity
    const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOG_SHEET);
    if (logSheet) {
      const logData = logSheet.getDataRange().getValues();
      const recentLogs = logData.slice(-50); // Check last 50 logs
      
      const vehicleInRecentUse = recentLogs.some(row => row[1] === plateNumber);
      if (vehicleInRecentUse) {
        // Don't delete, just set access to No Access
        sheet.getRange(vehicleIndex + 1, 10).setValue('No Access');
        logUserActivity('system', 'vehicle_access_revoked', `Vehicle ${plateNumber} access revoked (recent activity)`);
        clearVehicleCache(); // Clear cache after access revoke
        return { success: true, action: 'access_revoked' };
      }
    }
    
    // Safe to delete
    sheet.deleteRow(vehicleIndex + 1);
    logUserActivity('system', 'vehicle_deleted', `Vehicle ${plateNumber} deleted`);
    clearVehicleCache(); // Clear cache after delete
    return { success: true, action: 'deleted' };
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    throw error;
  }
}

// Get all vehicle records with error handling
function getVehicleList() {
  const startTime = new Date();
  
  try {
    console.log('Getting vehicle list...');
    
    // Check cache first for better performance
    const cache = CacheService.getScriptCache();
    const cacheKey = 'vehicle_list_data';
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('Returning cached vehicle data');
      return JSON.parse(cachedData);
    }
    
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
    
    // Optimized data retrieval - use specific range instead of getDataRange()
    const lastRow = sheet.getLastRow();
    if (lastRow < 1) {
      console.log('No vehicle data found, creating sample data...');
      createSampleData();
      return getVehicleList(); // Recursive call after creating data
    }
    
    // Only read actual data range, not entire sheet
    const lastCol = 10; // We have 10 columns for vehicle data
    const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    
    console.log(`Vehicle data retrieved in ${new Date() - startTime}ms:`, data.length, 'rows');
    
    // Cache the result for 5 minutes to improve performance
    cache.put(cacheKey, JSON.stringify(data), 300);
    
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
    
    // Validate gate access and permissions
    const gateValidation = validateGateAccess(data.gate, data.action, data.plateNumber);
    if (!gateValidation.allowed) {
      throw new Error(`Gate access denied: ${gateValidation.reason}`);
    }
    
    // Log the action with username instead of email
    logSheet.appendRow([
      new Date(),
      data.plateNumber,
      data.driverId,
      data.action,
      data.gate,
      data.remarks || "",
      data.username || "System", // Use username passed from frontend
      accessStatus
    ]);
    
    // Update vehicle status
    if (vehicleRow !== -1) {
      vehicleSheet.getRange(vehicleRow + 1, 7).setValue(data.action);
      clearVehicleCache(); // Clear cache after status update
    }
    
    return { success: true, accessStatus: accessStatus };
  } catch (error) {
    console.error('Error logging vehicle action:', error);
    throw error;
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

// Admin and Security: update vehicle record
function updateVehicleRecord(rowIndex, updatedData, userRole) {
  if (userRole !== "admin" && userRole !== "security") {
    throw new Error("Unauthorized: Admin or Security access required.");
  }

  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
    
    // Security users cannot create new vehicles
    if (rowIndex === -1 && userRole === "security") {
      throw new Error("Security users cannot create new vehicles");
    }
    
    // If rowIndex is -1, it's a new vehicle (admin only)
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
      if (userRole === "security") {
        // Security users can only update the current driver field (index 7)
        const currentData = sheet.getDataRange().getValues();
        if (rowIndex >= 0 && rowIndex < currentData.length) {
          // Only update the driver field, keep everything else the same
          const currentVehicle = currentData[rowIndex];
          currentVehicle[7] = updatedData[7]; // Update only current driver field
          const range = sheet.getRange(rowIndex + 1, 1, 1, currentVehicle.length);
          range.setValues([currentVehicle]);
        } else {
          throw new Error("Invalid vehicle index");
        }
      } else {
        // Admin users can update all fields
        const range = sheet.getRange(rowIndex + 1, 1, 1, updatedData.length);
        range.setValues([updatedData]);
      }
    }
    
    // Clear cache after successful update
    clearVehicleCache();
    
    return true;
  } catch (error) {
    console.error('Error updating vehicle:', error);
    throw error;
  }
}



// Admin-only: delete vehicle record
function deleteVehicleRecord(rowIndex, userRole) {
  if (userRole !== "admin") {
    throw new Error("Unauthorized: Admin access required.");
  }

  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
    sheet.deleteRow(rowIndex + 1);
    clearVehicleCache(); // Clear cache after delete
    return true;
  } catch (error) {
    console.error('Error deleting vehicle:', error);
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
    
    // Create Driver Master sheet (enhanced)
    let driverSheet = ss.getSheetByName(DRIVER_SHEET);
    if (!driverSheet) {
      driverSheet = ss.insertSheet(DRIVER_SHEET);
      driverSheet.getRange(1, 1, 1, 10).setValues([
        ["Driver ID", "Name", "License Number", "Phone", "Email", "License Type", "Department", "License Expiry", "Notes", "Status"]
      ]);
      driverSheet.getRange(1, 1, 1, 10).setFontWeight("bold");
      driverSheet.setFrozenRows(1);
      driverSheet.autoResizeColumns(1, 10);
      
      // Add data validation for Driver Status
      const driverStatusRange = driverSheet.getRange(2, 10, 1000, 1);
      const driverStatusRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['Active', 'Inactive', 'Suspended'], true)
        .setAllowInvalid(false)
        .build();
      driverStatusRange.setDataValidation(driverStatusRule);
      
      // Add data validation for License Type
      const licenseTypeRange = driverSheet.getRange(2, 6, 1000, 1);
      const licenseTypeRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['Regular', 'Commercial', 'Motorcycle', 'Chauffeur'], true)
        .setAllowInvalid(false)
        .build();
      licenseTypeRange.setDataValidation(licenseTypeRule);
      
      // Format license expiry column
      const expiryRange = driverSheet.getRange(2, 8, 1000, 1);
      expiryRange.setNumberFormat("yyyy-mm-dd");
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
      usersSheet.getRange(1, 1, 1, 7).setValues([
        ["Username", "Password", "Role", "Full Name", "Email", "Status", "Created Date"]
      ]);
      usersSheet.getRange(1, 1, 1, 7).setFontWeight("bold");
      usersSheet.setFrozenRows(1);
      usersSheet.autoResizeColumns(1, 7);
      
      // Add data validation for Status
      const statusRange = usersSheet.getRange(2, 6, 1000, 1);
      const statusRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['active', 'inactive', 'suspended'], true)
        .setAllowInvalid(false)
        .build();
      statusRange.setDataValidation(statusRule);
      
      // Add data validation for Role
      const roleRange = usersSheet.getRange(2, 3, 1000, 1);
      const roleRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['super-admin', 'admin', 'supervisor', 'security', 'user'], true)
        .setAllowInvalid(false)
        .build();
      roleRange.setDataValidation(roleRule);
    }
    
    // Create Gates sheet (simplified)
    let gatesSheet = ss.getSheetByName(GATES_SHEET);
    if (!gatesSheet) {
      gatesSheet = ss.insertSheet(GATES_SHEET);
      gatesSheet.getRange(1, 1, 1, 1).setValues([
        ["Gate Name"]
      ]);
      gatesSheet.getRange(1, 1, 1, 1).setFontWeight("bold");
      gatesSheet.setFrozenRows(1);
      gatesSheet.autoResizeColumns(1, 1);
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
    
    // Add default admin with enhanced structure
    sheet.appendRow([
      'admin',
      'admin123',
      'super-admin',
      'System Administrator',
      'admin@vehiclemonitoring.com',
      'active',
      new Date().toISOString()
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



// Get transaction logs for a specific vehicle
function getVehicleTransactionLogs(plateNumber, limit = 20) {
  const startTime = new Date();
  
  try {
    console.log(`Getting transaction logs for vehicle: ${plateNumber}`);
    
    // Check cache first
    const cache = CacheService.getScriptCache();
    const cacheKey = `vehicle_logs_${plateNumber}_${limit}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('Returning cached vehicle transaction data');
      return JSON.parse(cachedData);
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const logSheet = ss.getSheetByName(LOG_SHEET);
    
    if (!logSheet) {
      console.log('Log sheet not found');
      return { logs: [], totalCount: 0 };
    }
    
    // Get all data
    const allData = logSheet.getDataRange().getValues();
    
    if (allData.length <= 1) {
      return { logs: [], totalCount: 0 };
    }
    
    // Filter logs for specific vehicle (skip header row)
    const vehicleLogs = [];
    for (let i = allData.length - 1; i >= 1; i--) { // Start from end for most recent
      if (allData[i][1] === plateNumber) { // Column B is plate number
        vehicleLogs.push({
          timestamp: allData[i][0],
          plateNumber: allData[i][1],
          driverId: allData[i][2] || 'Unknown',
          action: allData[i][3] || 'Unknown',
          gate: allData[i][4] || 'Unknown',
          remarks: allData[i][5] || '',
          username: allData[i][6] || 'System',
          accessStatus: allData[i][7] || 'Unknown'
        });
        
        if (vehicleLogs.length >= limit) {
          break;
        }
      }
    }
    
    const result = {
      logs: vehicleLogs,
      totalCount: vehicleLogs.length,
      loadTime: new Date() - startTime
    };
    
    // Cache for 2 minutes
    cache.put(cacheKey, JSON.stringify(result), 120);
    
    console.log(`Vehicle logs retrieved in ${result.loadTime}ms: ${vehicleLogs.length} logs`);
    return result;
  } catch (error) {
    console.error('Error getting vehicle transaction logs:', error);
    return { logs: [], totalCount: 0, error: error.toString() };
  }
}

// Get transaction logs for all vehicles (optimized for dashboard)
function getAllVehicleTransactionLogs(limit = 10) {
  const startTime = new Date();
  
  try {
    console.log('Getting transaction logs for all vehicles');
    
    // Check cache first
    const cache = CacheService.getScriptCache();
    const cacheKey = `all_vehicle_logs_${limit}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('Returning cached all vehicle transaction data');
      return JSON.parse(cachedData);
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const logSheet = ss.getSheetByName(LOG_SHEET);
    
    if (!logSheet) {
      console.log('Log sheet not found');
      return {};
    }
    
    // Get all data
    const allData = logSheet.getDataRange().getValues();
    
    if (allData.length <= 1) {
      return {};
    }
    
    // Group logs by vehicle
    const vehicleLogsMap = {};
    
    // Process from end to beginning for most recent first
    for (let i = allData.length - 1; i >= 1; i--) {
      const plateNumber = allData[i][1];
      
      if (!vehicleLogsMap[plateNumber]) {
        vehicleLogsMap[plateNumber] = [];
      }
      
      if (vehicleLogsMap[plateNumber].length < limit) {
        vehicleLogsMap[plateNumber].push({
          timestamp: allData[i][0],
          plateNumber: allData[i][1],
          driverId: allData[i][2] || 'Unknown',
          action: allData[i][3] || 'Unknown',
          gate: allData[i][4] || 'Unknown',
          remarks: allData[i][5] || ''
        });
      }
    }
    
    const result = {
      vehicleLogs: vehicleLogsMap,
      loadTime: new Date() - startTime
    };
    
    // Cache for 2 minutes
    cache.put(cacheKey, JSON.stringify(result), 120);
    
    console.log(`All vehicle logs retrieved in ${result.loadTime}ms`);
    return result;
  } catch (error) {
    console.error('Error getting all vehicle transaction logs:', error);
    return { vehicleLogs: {}, error: error.toString() };
  }
}

// Ultra minimal test - step by step
function testStepByStep() {
  // Step 1: Just return a simple object
  return { step: 1, message: "Basic object return works" };
}

function testSpreadsheetAccess() {
  // Step 2: Test spreadsheet access only
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    return { step: 2, message: "Spreadsheet access works", name: ss.getName() };
  } catch (error) {
    return { step: 2, error: error.toString() };
  }
}

function testSheetAccess() {
  // Step 3: Test sheet access
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const logSheet = ss.getSheetByName(LOG_SHEET);
    return { 
      step: 3, 
      message: "Sheet access works", 
      sheetExists: !!logSheet,
      sheetName: logSheet ? logSheet.getName() : null
    };
  } catch (error) {
    return { step: 3, error: error.toString() };
  }
}

function testDataAccess() {
  // Step 4: Test data access
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const logSheet = ss.getSheetByName(LOG_SHEET);
    if (!logSheet) {
      return { step: 4, error: "No log sheet found" };
    }
    const allData = logSheet.getDataRange().getValues();
    return { 
      step: 4, 
      message: "Data access works", 
      rowCount: allData.length,
      firstRow: allData.length > 0 ? allData[0] : null
    };
  } catch (error) {
    return { step: 4, error: error.toString() };
  }
}

// Ultra minimal diagnostic version
function getRecentTransactionsSimple() {
  return "SIMPLE_WORKS";
}

// Step by step diagnostic function
function testGetRecentTransactionsSteps() {
  return "DIAGNOSTIC_WORKS";
}

// Emergency test function
function emergencyTest() {
  return 42;
}

// Brand new function with unique name to test transaction logs
function getTransactionLogsFresh() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const logSheet = ss.getSheetByName(LOG_SHEET);
    
    if (!logSheet) {
      return { status: "NO_SHEET", message: "LOG_SHEET not found" };
    }
    
    const allData = logSheet.getDataRange().getValues();
    
    if (allData.length <= 1) {
      return { status: "NO_DATA", message: "No data in sheet", rows: allData.length };
    }
    
    // Get last 3 rows of data
    const logs = [];
    for (let i = Math.max(1, allData.length - 3); i < allData.length; i++) {
      const row = allData[i];
      logs.push({
        timestamp: row[0],
        plate: row[1],
        action: row[3]
      });
    }
    
    return {
      status: "SUCCESS",
      totalRows: allData.length,
      logs: logs,
      message: "Fresh function worked!"
    };
  } catch (error) {
    return {
      status: "ERROR",
      error: error.toString()
    };
  }
}

// Final diagnostic - minimal transaction function
function getLogsMinimal() {
  const ss = SpreadsheetApp.openById("16Ifxb9dCZGl-xYpxStwHufkmzj2TZ8oRIYC3yf1CSqs");
  const sheet = ss.getSheetByName("InOutLogs");
  const data = sheet.getDataRange().getValues();
  return { rows: data.length, first: data[0] };
}

// Working transaction function based on minimal approach
function getRecentTransactions(limit = 20) {
  const ss = SpreadsheetApp.openById("16Ifxb9dCZGl-xYpxStwHufkmzj2TZ8oRIYC3yf1CSqs");
  const sheet = ss.getSheetByName("InOutLogs");
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return { logs: [], totalCount: 0 };
  }
  
  const logs = [];
  const maxRows = Math.min(limit || 20, data.length - 1);
  
  for (let i = data.length - 1; i >= 1 && logs.length < maxRows; i--) {
    const row = data[i];
    if (row && row.length >= 4) {
      logs.push({
        timestamp: row[0],
        plateNumber: row[1] || 'Unknown',
        driverId: row[2] || 'Unknown', 
        action: row[3] || 'Unknown',
        gate: row[4] || 'Unknown',
        remarks: row[5] || '',
        username: row[6] || 'System',
        accessStatus: row[7] || 'Unknown'
      });
    }
  }
  
  return { logs: logs, totalCount: data.length - 1 };
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

// Ultra simple test - just returns a string
function ultraSimpleTest() {
  return "WORKING";
}

// Minimal test function - no try/catch, no logging
function minimalTest() {
  return 42;
}

// Test with different return types
function testString() {
  return "TEST";
}

function testNumber() {
  return 123;
}

function testBoolean() {
  return true;
}

function testObject() {
  return {status: "ok"};
}

function testArray() {
  return ["a", "b", "c"];
}

// Progressive Google Sheets API tests
function testSpreadsheetOpen() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    return "Spreadsheet opened successfully";
  } catch (error) {
    return "Error opening spreadsheet: " + error.toString();
  }
}

function testSpreadsheetName() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const name = ss.getName();
    return "Spreadsheet name: " + name;
  } catch (error) {
    return "Error getting spreadsheet name: " + error.toString();
  }
}

function testSheetAccess() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(LOG_SHEET);
    if (sheet) {
      return "Sheet access successful";
    } else {
      return "Sheet not found";
    }
  } catch (error) {
    return "Error accessing sheet: " + error.toString();
  }
}

function testDataRead() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(LOG_SHEET);
    if (!sheet) {
      return "No sheet found";
    }
    const data = sheet.getDataRange().getValues();
    return "Data read successful: " + data.length + " rows";
  } catch (error) {
    return "Error reading data: " + error.toString();
  }
}

// Simple connectivity test - returns a basic string
function simpleConnectivityTest() {
  console.log('Simple connectivity test called');
  return "Google Apps Script is working!";
}

// Test function that returns current timestamp
function getTimestamp() {
  return new Date().toISOString();
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

// Test function to debug transaction logs
function testTransactionLogs() {
  try {
    console.log('=== Testing Transaction Logs ===');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Check if LOG_SHEET exists
    const logSheet = ss.getSheetByName(LOG_SHEET);
    if (!logSheet) {
      console.log('LOG_SHEET not found, creating...');
      createInitialSheets();
      createSampleData();
      return testTransactionLogs(); // Try again after creation
    }
    
    // Get raw data
    const allData = logSheet.getDataRange().getValues();
    console.log('LOG_SHEET raw data rows:', allData.length);
    
    if (allData.length > 0) {
      console.log('First row (headers):', allData[0]);
    }
    
    if (allData.length > 1) {
      console.log('Second row (first data):', allData[1]);
      console.log('Last row (latest data):', allData[allData.length - 1]);
    }
    
    // Test getRecentTransactions function
    const result = getRecentTransactions(5);
    console.log('getRecentTransactions result:', result);
    
    return {
      success: true,
      logSheetExists: !!logSheet,
      totalRows: allData.length,
      dataRows: Math.max(0, allData.length - 1),
      headers: allData.length > 0 ? allData[0] : null,
      firstDataRow: allData.length > 1 ? allData[1] : null,
      lastDataRow: allData.length > 1 ? allData[allData.length - 1] : null,
      getRecentTransactionsResult: result
    };
  } catch (error) {
    console.error('Error testing transaction logs:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// Force create sample transaction logs (for debugging)
function forceCreateSampleLogs() {
  try {
    console.log('Force creating sample transaction logs...');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Ensure sheets exist
    createInitialSheets();
    
    const logSheet = ss.getSheetByName(LOG_SHEET);
    if (!logSheet) {
      throw new Error('Failed to create log sheet');
    }
    
    // Clear existing data (except headers)
    const data = logSheet.getDataRange().getValues();
    if (data.length > 1) {
      logSheet.getRange(2, 1, data.length - 1, data[0].length).clearContent();
    }
    
    // Add fresh sample logs with current timestamps
    const now = new Date();
    const sampleLogs = [
      [new Date(now.getTime() - 10 * 60 * 1000), 'ABC-123', 'DRV001', 'IN', 'Main Gate', 'Morning entry', 'admin', 'Access'],
      [new Date(now.getTime() - 30 * 60 * 1000), 'XYZ-456', 'DRV002', 'OUT', 'Back Gate', 'Delivery run', 'admin', 'Access'],
      [new Date(now.getTime() - 45 * 60 * 1000), 'STU-345', 'DRV005', 'IN', 'Main Gate', 'Return from meeting', 'admin', 'Access'],
      [new Date(now.getTime() - 90 * 60 * 1000), 'ABC-123', 'DRV001', 'OUT', 'Service Gate', 'Lunch break', 'security', 'Access'],
      [new Date(now.getTime() - 120 * 60 * 1000), 'MNO-789', 'DRV003', 'IN', 'Parking Gate', 'Service return', 'admin', 'No Access']
    ];
    
    // Add the sample logs
    const startRow = logSheet.getLastRow() + 1;
    const range = logSheet.getRange(startRow, 1, sampleLogs.length, sampleLogs[0].length);
    range.setValues(sampleLogs);
    
    console.log('Sample logs created successfully');
    
    return {
      success: true,
      message: 'Sample transaction logs created successfully',
      logsAdded: sampleLogs.length,
      newTotalRows: logSheet.getLastRow()
    };
  } catch (error) {
    console.error('Error force creating sample logs:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// Simple test function to check if backend is working
function testBackendConnection() {
  try {
    console.log('Testing backend connection...');
    return {
      success: true,
      message: 'Backend connection is working',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Backend connection test failed:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// User Management Functions

// Get all users (admin only)
function getUserList(userRole) {
  if (!['super-admin', 'admin'].includes(userRole)) {
    throw new Error("Unauthorized: Admin access required.");
  }

  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);
    if (!sheet) {
      createInitialSheets();
      createDefaultAdmin();
      return getUserList(userRole);
    }
    
    const data = sheet.getDataRange().getValues();
    console.log('User data retrieved successfully:', data.length, 'rows');
    return data;
  } catch (error) {
    console.error('Error getting user list:', error);
    return [["Username", "Password", "Role", "Full Name", "Email", "Status", "Created Date"]];
  }
}

// Save user (create or update)
function saveUser(userData, userRole) {
  if (!['super-admin', 'admin'].includes(userRole)) {
    throw new Error("Unauthorized: Admin access required.");
  }

  try {
    validateRequired(userData.username, 'Username');
    validateRequired(userData.password, 'Password');
    validateRequired(userData.role, 'Role');
    validateRequired(userData.fullName, 'Full Name');
    validateRequired(userData.email, 'Email');

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);
    const data = sheet.getDataRange().getValues();
    
    // Role validation based on current user's role
    const validRoles = {
      'super-admin': ['super-admin', 'admin', 'supervisor', 'security', 'user'],
      'admin': ['supervisor', 'security', 'user']
    };
    
    if (!validRoles[userRole].includes(userData.role)) {
      throw new Error(`You cannot assign the role: ${userData.role}`);
    }

    let userExists = false;
    let userRowIndex = -1;
    
    // Check if user already exists
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === userData.username) {
        userExists = true;
        userRowIndex = i;
        break;
      }
    }

    const userRow = [
      sanitizeInput(userData.username),
      sanitizeInput(userData.password),
      userData.role,
      sanitizeInput(userData.fullName),
      sanitizeInput(userData.email),
      userData.status || 'active',
      userExists ? data[userRowIndex][6] : new Date().toISOString()
    ];

    if (userExists) {
      // Update existing user
      const range = sheet.getRange(userRowIndex + 1, 1, 1, userRow.length);
      range.setValues([userRow]);
      logUserActivity(userData.username, 'user_updated', 'success');
    } else {
      // Create new user
      sheet.appendRow(userRow);
      logUserActivity(userData.username, 'user_created', 'success');
    }
    
    return { success: true, action: userExists ? 'updated' : 'created' };
  } catch (error) {
    console.error('Error saving user:', error);
    throw error;
  }
}

// Delete user (admin only)
function deleteUser(username, userRole) {
  if (!['super-admin', 'admin'].includes(userRole)) {
    throw new Error("Unauthorized: Admin access required.");
  }

  try {
    validateRequired(username, 'Username');
    
    // Prevent deletion of admin user
    if (username === 'admin') {
      throw new Error("Cannot delete the default admin user");
    }

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);
    const data = sheet.getDataRange().getValues();
    
    let userRowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === username) {
        userRowIndex = i;
        break;
      }
    }
    
    if (userRowIndex === -1) {
      throw new Error("User not found");
    }
    
    // Check role permissions for deletion
    const targetUserRole = data[userRowIndex][2];
    if (userRole === 'admin' && ['super-admin', 'admin'].includes(targetUserRole)) {
      throw new Error("You cannot delete users with admin privileges");
    }
    
    sheet.deleteRow(userRowIndex + 1);
    logUserActivity(username, 'user_deleted', 'success');
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

// Gate Management Functions - Simplified

// Get all gates (simple)
function getGateList() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(GATES_SHEET);
    
    if (!sheet) {
      createInitialSheets();
      sheet = ss.getSheetByName(GATES_SHEET);
    }
    
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      // Return default gates if no data
      return [
        ["Gate Name"],
        ["Main Gate"],
        ["Back Gate"],
        ["Service Gate"]
      ];
    }
    
    return data;
  } catch (error) {
    console.error('Error getting gate list:', error);
    return [
      ["Gate Name"],
      ["Main Gate"],
      ["Back Gate"]
    ];
  }
}

// Save gate (simple - just name)
function saveGate(gateName, userRole, editIndex = -1) {
  if (!['super-admin', 'admin', 'supervisor'].includes(userRole)) {
    throw new Error("Unauthorized: Supervisor access or higher required.");
  }

  try {
    if (!gateName || gateName.trim() === '') {
      throw new Error("Gate name is required");
    }

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(GATES_SHEET);
    const data = sheet.getDataRange().getValues();
    
    const cleanGateName = sanitizeInput(gateName.trim());
    
    // Check if gate name already exists (excluding current edit)
    for (let i = 1; i < data.length; i++) {
      if (i !== editIndex && data[i][0] === cleanGateName) {
        throw new Error("Gate name already exists");
      }
    }

    if (editIndex > 0 && editIndex < data.length) {
      // Update existing gate
      sheet.getRange(editIndex + 1, 1).setValue(cleanGateName);
      return { success: true, action: 'updated' };
    } else {
      // Create new gate
      sheet.appendRow([cleanGateName]);
      return { success: true, action: 'created' };
    }
  } catch (error) {
    console.error('Error saving gate:', error);
    throw error;
  }
}

// Delete gate (simple)
function deleteGate(gateIndex, userRole) {
  if (!['super-admin', 'admin', 'supervisor'].includes(userRole)) {
    throw new Error("Unauthorized: Supervisor access or higher required.");
  }

  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(GATES_SHEET);
    const data = sheet.getDataRange().getValues();
    
    if (gateIndex < 1 || gateIndex >= data.length) {
      throw new Error("Invalid gate index");
    }
    
    sheet.deleteRow(gateIndex + 1);
    return { success: true };
  } catch (error) {
    console.error('Error deleting gate:', error);
    throw error;
  }
}

// Get active gates for dropdown selection (simplified)
function getActiveGates() {
  try {
    const data = getGateList();
    const gates = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i] && data[i][0]) {
        gates.push({
          id: data[i][0],
          name: data[i][0]
        });
      }
    }
    
    return gates.length > 0 ? gates : [
      { id: 'Main Gate', name: 'Main Gate' },
      { id: 'Back Gate', name: 'Back Gate' }
    ];
  } catch (error) {
    console.error('Error getting active gates:', error);
    return [
      { id: 'Main Gate', name: 'Main Gate' },
      { id: 'Back Gate', name: 'Back Gate' }
    ];
  }
}

// Validate gate access for vehicles (simplified)
function validateGateAccess(gateId, action, plateNumber) {
  try {
    const gateSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(GATES_SHEET);
    
    if (!gateSheet) {
      // If no gates sheet exists, allow access (backward compatibility)
      return { allowed: true, reason: 'Gate validation bypassed - no gate configuration' };
    }
    
    // Check if gateId is provided
    if (!gateId || gateId === '') {
      return { allowed: false, reason: 'No gate selected' };
    }
    
    const gateData = gateSheet.getDataRange().getValues();
    let gateFound = false;
    
    // Find the gate (simplified structure - only gate name in column 0)
    for (let i = 1; i < gateData.length; i++) {
      if (gateData[i][0] === gateId) {
        gateFound = true;
        break;
      }
    }
    
    if (!gateFound) {
      return { allowed: false, reason: `Gate "${gateId}" not found in system` };
    }
    
    // For simplified gate system, all valid gates are considered active
    // and allow both entry and exit
    
    // Log the gate usage for tracking
    console.log(`Vehicle ${plateNumber} attempting ${action} at gate: ${gateId}`);
    
    // All validation passed
    return { allowed: true, reason: 'Access granted' };
  } catch (error) {
    console.error('Error validating gate access:', error);
    // On error, allow access but log the issue
    return { allowed: true, reason: 'Gate validation error - access granted by default' };
  }
}

// Get gate statistics
function getGateStatistics() {
  try {
    console.log('getGateStatistics called');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const gateSheet = ss.getSheetByName(GATES_SHEET);
    const logSheet = ss.getSheetByName(LOG_SHEET);
    
    if (!gateSheet) {
      console.log('No gates sheet found');
      return { totalGates: 0, activeGates: 0, usageToday: {}, busyGates: [], error: 'No gates configured' };
    }
    
    const gateData = gateSheet.getDataRange().getValues();
    console.log('Gate data length:', gateData.length);
    
    // Count gates (simplified - all gates are considered active)
    let totalGates = Math.max(0, gateData.length - 1); // Exclude header
    let activeGates = totalGates; // In simplified system, all gates are active
    
    let usageToday = {};
    let busyGates = [];
    
    if (logSheet) {
      try {
        const logData = logSheet.getDataRange().getValues();
        console.log('Log data length:', logData.length);
        
        // Calculate today's usage
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const gateActivity = {};
        
        for (let i = 1; i < logData.length; i++) {
          if (logData[i] && logData[i][0] && logData[i][4]) {
            const logDate = new Date(logData[i][0]);
            if (logDate >= today) {
              const gate = logData[i][4];
              usageToday[gate] = (usageToday[gate] || 0) + 1;
              gateActivity[gate] = (gateActivity[gate] || 0) + 1;
            }
          }
        }
        
        // Find busiest gates
        busyGates = Object.entries(gateActivity)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([gate, count]) => ({ gate, count }));
      } catch (logError) {
        console.error('Error processing log data:', logError);
      }
    }
    
    const result = {
      totalGates,
      activeGates,
      usageToday,
      busyGates
    };
    
    console.log('Gate statistics result:', result);
    return result;
    
  } catch (error) {
    console.error('Error getting gate statistics:', error);
    return { 
      totalGates: 0, 
      activeGates: 0, 
      usageToday: {}, 
      busyGates: [],
      error: error.message
    };
  }
}

// Get gate activity report
function getGateActivityReport(gateId, dateFrom, dateTo) {
  try {
    const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOG_SHEET);
    if (!logSheet) {
      return { error: 'No activity logs found' };
    }
    
    const logData = logSheet.getDataRange().getValues();
    const activities = [];
    
    // Parse date filters
    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo) : null;
    
    for (let i = 1; i < logData.length; i++) {
      const logEntry = logData[i];
      const logDate = new Date(logEntry[0]);
      const logGate = logEntry[4];
      
      // Filter by gate if specified
      if (gateId && logGate !== gateId) continue;
      
      // Filter by date range if specified
      if (fromDate && logDate < fromDate) continue;
      if (toDate && logDate > toDate) continue;
      
      activities.push({
        timestamp: logEntry[0],
        plateNumber: logEntry[1],
        driverId: logEntry[2],
        action: logEntry[3],
        gate: logEntry[4],
        remarks: logEntry[5],
        loggedBy: logEntry[6],
        accessStatus: logEntry[7]
      });
    }
    
    // Calculate summary statistics
    const summary = {
      totalActivities: activities.length,
      entriesCount: activities.filter(a => a.action === 'IN').length,
      exitsCount: activities.filter(a => a.action === 'OUT').length,
      uniqueVehicles: [...new Set(activities.map(a => a.plateNumber))].length,
      uniqueDrivers: [...new Set(activities.map(a => a.driverId))].length,
      accessDeniedCount: activities.filter(a => a.accessStatus && a.accessStatus !== 'Access').length
    };
    
    // Group by hour for activity patterns
    const hourlyActivity = {};
    activities.forEach(activity => {
      const hour = new Date(activity.timestamp).getHours();
      hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
    });
    
    return {
      success: true,
      activities: activities.slice(0, 100), // Limit to 100 most recent
      summary: summary,
      hourlyActivity: hourlyActivity,
      dateRange: {
        from: fromDate?.toISOString() || null,
        to: toDate?.toISOString() || null
      }
    };
  } catch (error) {
    console.error('Error generating gate activity report:', error);
    return { error: 'Failed to generate report: ' + error.message };
  }
}

// Get comprehensive gate usage analytics
function getGateAnalytics() {
  try {
    const gateSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(GATES_SHEET);
    const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOG_SHEET);
    
    if (!gateSheet || !logSheet) {
      return { error: 'Required sheets not found' };
    }
    
    const gateData = gateSheet.getDataRange().getValues();
    const logData = logSheet.getDataRange().getValues();
    
    // Calculate analytics for each gate
    const gateAnalytics = [];
    
    for (let i = 1; i < gateData.length; i++) {
      const gate = gateData[i];
      const gateId = gate[0];
      
      // Count activities for this gate
      const gateActivities = logData.filter(log => log[4] === gateId);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayActivities = gateActivities.filter(log => {
        const logDate = new Date(log[0]);
        return logDate >= today;
      });
      
      const thisWeek = new Date();
      thisWeek.setDate(thisWeek.getDate() - 7);
      
      const weekActivities = gateActivities.filter(log => {
        const logDate = new Date(log[0]);
        return logDate >= thisWeek;
      });
      
      gateAnalytics.push({
        gate: {
          id: gateId,
          name: gate[1],
          location: gate[2],
          type: gate[3],
          status: gate[4],
          accessLevel: gate[5]
        },
        usage: {
          totalActivities: gateActivities.length,
          todayActivities: todayActivities.length,
          weekActivities: weekActivities.length,
          entriesTotal: gateActivities.filter(log => log[3] === 'IN').length,
          exitsTotal: gateActivities.filter(log => log[3] === 'OUT').length,
          lastActivity: gateActivities.length > 0 ? gateActivities[gateActivities.length - 1][0] : null
        }
      });
    }
    
    // Sort by activity level
    gateAnalytics.sort((a, b) => b.usage.totalActivities - a.usage.totalActivities);
    
    return {
      success: true,
      analytics: gateAnalytics,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating gate analytics:', error);
    return { error: 'Failed to generate analytics: ' + error.message };
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
      
      // Optimized: Use batch setValues instead of individual appendRow operations
      const startRow = vehicleSheet.getLastRow() + 1;
      const range = vehicleSheet.getRange(startRow, 1, sampleVehicles.length, sampleVehicles[0].length);
      range.setValues(sampleVehicles);
      console.log('Sample vehicles added successfully via batch operation');
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
        ['DRV001', 'John Doe', 'LIC001', '555-0101', 'john.doe@company.com', 'Regular', 'Transportation', '2025-12-31', 'Experienced driver with 10+ years', 'Active'],
        ['DRV002', 'Jane Smith', 'LIC002', '555-0102', 'jane.smith@company.com', 'Commercial', 'Logistics', '2025-06-30', 'CDL certified', 'Active'],
        ['DRV003', 'Bob Johnson', 'LIC003', '555-0103', 'bob.johnson@company.com', 'Regular', 'IT Department', '2024-09-15', 'Part-time driver', 'Active'],
        ['DRV004', 'Alice Brown', 'LIC004', '555-0104', 'alice.brown@company.com', 'Regular', 'HR Department', '2025-03-20', 'Emergency backup driver', 'Inactive'],
        ['DRV005', 'Charlie Davis', 'LIC005', '555-0105', 'charlie.davis@company.com', 'Chauffeur', 'Executive', '2026-01-15', 'Executive driver specialist', 'Active']
      ];
      
      // Optimized: Use batch setValues instead of individual appendRow operations
      const startRow = driverSheet.getLastRow() + 1;
      const range = driverSheet.getRange(startRow, 1, sampleDrivers.length, sampleDrivers[0].length);
      range.setValues(sampleDrivers);
      console.log('Sample drivers added successfully via batch operation');
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
        
        // Optimized: Use batch setValues instead of individual appendRow operations
        const startRow = usersSheet.getLastRow() + 1;
        const range = usersSheet.getRange(startRow, 1, sampleUsers.length, sampleUsers[0].length);
        range.setValues(sampleUsers);
        console.log('Sample users added successfully via batch operation');
      }
    }
    
    // Add sample gates if needed (simplified)
    const gatesSheet = ss.getSheetByName(GATES_SHEET);
    if (gatesSheet) {
      let gateData;
      try {
        gateData = gatesSheet.getDataRange().getValues();
      } catch (e) {
        console.log('Error getting gate data range');
        gateData = [];
      }
      
      if (gateData.length <= 1) {
        console.log('Adding sample gates...');
        const sampleGates = [
          ['Main Gate'],
          ['Back Gate'],
          ['Parking Gate'],
          ['Service Gate'],
          ['Emergency Gate'],
          ['Visitor Gate'],
          ['Security Gate']
        ];
        
        // Optimized: Use batch setValues instead of individual appendRow operations
        const startRow = gatesSheet.getLastRow() + 1;
        const range = gatesSheet.getRange(startRow, 1, sampleGates.length, sampleGates[0].length);
        range.setValues(sampleGates);
        console.log('Sample gates added successfully via batch operation');
      }
    }
    
    // Add sample log entries if needed
    const logSheet = ss.getSheetByName(LOG_SHEET);
    if (logSheet) {
      let logData;
      try {
        logData = logSheet.getDataRange().getValues();
      } catch (e) {
        console.log('Error getting log data range');
        logData = [];
      }
      
      if (logData.length <= 1) {
        console.log('Adding sample log entries...');
        const now = new Date();
        const sampleLogs = [
          // Recent transactions for sample vehicles
          [new Date(now.getTime() - 2 * 60 * 60 * 1000), 'ABC-123', 'DRV001', 'IN', 'Main Gate', 'Regular entry', 'admin', 'Access'],
          [new Date(now.getTime() - 4 * 60 * 60 * 1000), 'ABC-123', 'DRV001', 'OUT', 'Main Gate', 'Lunch break', 'admin', 'Access'],
          [new Date(now.getTime() - 1 * 60 * 60 * 1000), 'XYZ-456', 'DRV002', 'OUT', 'Back Gate', 'Delivery run', 'admin', 'Access'],
          [new Date(now.getTime() - 3 * 60 * 60 * 1000), 'XYZ-456', 'DRV002', 'IN', 'Back Gate', 'Return from delivery', 'admin', 'Access'],
          [new Date(now.getTime() - 30 * 60 * 1000), 'MNO-789', 'DRV003', 'IN', 'Service Gate', 'Service check', 'security', 'No Access'],
          [new Date(now.getTime() - 90 * 60 * 1000), 'MNO-789', 'DRV003', 'OUT', 'Service Gate', 'Completed service', 'security', 'No Access'],
          [new Date(now.getTime() - 45 * 60 * 1000), 'STU-345', 'DRV005', 'OUT', 'Main Gate', 'Executive meeting', 'admin', 'Access'],
          [new Date(now.getTime() - 120 * 60 * 1000), 'STU-345', 'DRV005', 'IN', 'Main Gate', 'Morning arrival', 'admin', 'Access']
        ];
        
        // Optimized: Use batch setValues instead of individual appendRow operations
        const startRow = logSheet.getLastRow() + 1;
        const range = logSheet.getRange(startRow, 1, sampleLogs.length, sampleLogs[0].length);
        range.setValues(sampleLogs);
        console.log('Sample log entries added successfully via batch operation');
      }
    }
    
    console.log('Sample data creation completed successfully');
    return 'Sample data created successfully';
  } catch (error) {
    console.error('Error creating sample data:', error);
    return 'Failed to create sample data: ' + error.message;
  }
}
