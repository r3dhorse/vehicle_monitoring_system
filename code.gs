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
      return { success: true, action: 'updated' };
    } else {
      // Create new vehicle
      sheet.appendRow(vehicleRow);
      logUserActivity('system', 'vehicle_created', `Vehicle ${cleanPlateNumber} created`);
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
        return { success: true, action: 'access_revoked' };
      }
    }
    
    // Safe to delete
    sheet.deleteRow(vehicleIndex + 1);
    logUserActivity('system', 'vehicle_deleted', `Vehicle ${plateNumber} deleted`);
    return { success: true, action: 'deleted' };
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    throw error;
  }
}

// Driver Management Functions - CRUD

// Get all drivers for management (enhanced)
function getDriverListForManagement() {
  try {
    console.log('Getting driver list for management...');
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
    console.log('Driver management data retrieved successfully:', data.length, 'rows');
    
    if (data.length <= 1) {
      console.log('No driver data found, creating sample data...');
      createSampleData();
      const updatedData = sheet.getDataRange().getValues();
      console.log('Driver data after sample creation:', updatedData.length);
      return updatedData;
    }
    
    return data;
  } catch (error) {
    console.error('Error getting driver list for management:', error);
    return [
      ["Driver ID", "Name", "License Number", "Phone", "Email", "License Type", "Department", "License Expiry", "Notes", "Status"],
      ["D001", "John Smith", "DL123456789", "555-0123", "john.smith@company.com", "Regular", "Transportation", "2025-12-31", "Experienced driver", "Active"]
    ];
  }
}

// Save driver (create or update) - for management
function saveDriverRecord(driverData, userRole, editIndex = -1) {
  if (!['super-admin', 'admin'].includes(userRole)) {
    throw new Error("Unauthorized: Admin access required.");
  }

  try {
    validateRequired(driverData.driverId, 'Driver ID');
    validateRequired(driverData.name, 'Name');
    validateRequired(driverData.licenseNumber, 'License Number');

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DRIVER_SHEET);
    const data = sheet.getDataRange().getValues();

    // Sanitize inputs
    const sanitizedData = {
      driverId: sanitizeInput(driverData.driverId),
      name: sanitizeInput(driverData.name),
      licenseNumber: sanitizeInput(driverData.licenseNumber),
      phone: sanitizeInput(driverData.phone),
      email: sanitizeInput(driverData.email),
      licenseType: sanitizeInput(driverData.licenseType) || 'Regular',
      department: sanitizeInput(driverData.department),
      licenseExpiry: driverData.licenseExpiry || '',
      notes: sanitizeInput(driverData.notes),
      status: sanitizeInput(driverData.status) || 'Active'
    };

    // Check for duplicate Driver ID (excluding current record in edit mode)
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === sanitizedData.driverId && i !== editIndex) {
        throw new Error(`Driver ID "${sanitizedData.driverId}" already exists`);
      }
    }

    // Check for duplicate License Number (excluding current record in edit mode)
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === sanitizedData.licenseNumber && i !== editIndex) {
        throw new Error(`License number "${sanitizedData.licenseNumber}" already exists`);
      }
    }

    const rowData = [
      sanitizedData.driverId,
      sanitizedData.name,
      sanitizedData.licenseNumber,
      sanitizedData.phone,
      sanitizedData.email,
      sanitizedData.licenseType,
      sanitizedData.department,
      sanitizedData.licenseExpiry,
      sanitizedData.notes,
      sanitizedData.status
    ];

    if (editIndex >= 1) {
      // Update existing driver
      sheet.getRange(editIndex + 1, 1, 1, rowData.length).setValues([rowData]);
      console.log('Driver updated successfully:', sanitizedData.driverId);
      logUserActivity(userRole, 'driver_updated', `Driver ${sanitizedData.driverId} updated`);
    } else {
      // Add new driver
      sheet.appendRow(rowData);
      console.log('Driver added successfully:', sanitizedData.driverId);
      logUserActivity(userRole, 'driver_created', `Driver ${sanitizedData.driverId} created`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving driver:', error);
    throw error;
  }
}

// Delete driver (management)
function deleteDriverRecord(driverIndex, userRole) {
  if (!['super-admin', 'admin'].includes(userRole)) {
    throw new Error("Unauthorized: Admin access required.");
  }

  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DRIVER_SHEET);
    const data = sheet.getDataRange().getValues();
    
    if (driverIndex < 1 || driverIndex >= data.length) {
      throw new Error("Invalid driver index");
    }
    
    const driverId = data[driverIndex][0];
    
    // Check if driver is assigned to any vehicles
    const vehicleSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
    if (vehicleSheet) {
      const vehicleData = vehicleSheet.getDataRange().getValues();
      
      for (let i = 1; i < vehicleData.length; i++) {
        const currentDriver = vehicleData[i][7]; // Current Driver column
        const assignedDrivers = vehicleData[i][8]; // Assigned Drivers column
        
        if (currentDriver === driverId || (assignedDrivers && assignedDrivers.includes(driverId))) {
          throw new Error(`Cannot delete driver: ${driverId} is currently assigned to vehicle ${vehicleData[i][0]}`);
        }
      }
    }
    
    // Safe to delete
    sheet.deleteRow(driverIndex + 1);
    logUserActivity(userRole, 'driver_deleted', `Driver ${driverId} deleted`);
    return { success: true };
  } catch (error) {
    console.error('Error deleting driver:', error);
    throw error;
  }
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

// Admin-only: delete vehicle record
function deleteVehicleRecord(rowIndex, userRole) {
  if (userRole !== "admin") {
    throw new Error("Unauthorized: Admin access required.");
  }

  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
    sheet.deleteRow(rowIndex + 1);
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
        ['DRV001', 'John Doe', 'LIC001', '555-0101', 'john.doe@company.com', 'Regular', 'Transportation', '2025-12-31', 'Experienced driver with 10+ years', 'Active'],
        ['DRV002', 'Jane Smith', 'LIC002', '555-0102', 'jane.smith@company.com', 'Commercial', 'Logistics', '2025-06-30', 'CDL certified', 'Active'],
        ['DRV003', 'Bob Johnson', 'LIC003', '555-0103', 'bob.johnson@company.com', 'Regular', 'IT Department', '2024-09-15', 'Part-time driver', 'Active'],
        ['DRV004', 'Alice Brown', 'LIC004', '555-0104', 'alice.brown@company.com', 'Regular', 'HR Department', '2025-03-20', 'Emergency backup driver', 'Inactive'],
        ['DRV005', 'Charlie Davis', 'LIC005', '555-0105', 'charlie.davis@company.com', 'Chauffeur', 'Executive', '2026-01-15', 'Executive driver specialist', 'Active']
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
        
        sampleGates.forEach(gate => {
          gatesSheet.appendRow(gate);
        });
        console.log('Sample gates added successfully');
      }
    }
    
    console.log('Sample data creation completed successfully');
    return 'Sample data created successfully';
  } catch (error) {
    console.error('Error creating sample data:', error);
    return 'Failed to create sample data: ' + error.message;
  }
}
