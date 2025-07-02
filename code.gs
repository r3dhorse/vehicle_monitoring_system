
/*
  Vehicle Monitoring System Web App
  Backend: Google Apps Script
  Database: Google Sheets
*/

// Spreadsheet Setup - Consider using PropertiesService for production
const SPREADSHEET_ID = "1OMlsS2W_N566ZEC4K9bXutQdu0qCB67Q7ezZCN1w7u8";

// Function to manually clear all caches
function clearAllCaches() {
  try {
    const cache = CacheService.getScriptCache();
    cache.removeAll(["vehicle_list_data", "vehicle_search_*"]);
    return "All caches cleared successfully";
  } catch (error) {
    console.error("Error clearing caches:", error);
    return "Error clearing caches: " + error.toString();
  }
}

// Test function specifically for current issue - Active gate ID: 1, vehicle allowed gates: 1,2
function testCurrentGateIssue() {
  console.log("=== TESTING CURRENT GATE ISSUE ===");
  console.log("Expected: Active gate ID: 1, Vehicle allowed gates: 1,2");
  
  // Test with different data types to simulate what might be happening
  const testScenarios = [
    { gateId: "1", allowedGates: "1,2", description: "Both strings" },
    { gateId: 1, allowedGates: "1,2", description: "Gate ID as number, allowed as string" },
    { gateId: "1", allowedGates: "1,2", description: "Both strings with spaces" },
    { gateId: " 1 ", allowedGates: " 1 , 2 ", description: "With extra spaces" }
  ];
  
  testScenarios.forEach((scenario, index) => {
    console.log(`\n--- Test Scenario ${index + 1}: ${scenario.description} ---`);
    console.log(`Gate ID: "${scenario.gateId}" (type: ${typeof scenario.gateId})`);
    console.log(`Allowed gates: "${scenario.allowedGates}"`);
    
    // Parse allowed gate IDs (comma-separated)
    const allowedGateIds = scenario.allowedGates.split(',').map(gateId => gateId.trim());
    console.log(`Parsed allowed gate IDs:`, allowedGateIds);
    
    // Convert both to strings for reliable comparison
    const currentGateIdStr = scenario.gateId.toString().trim();
    console.log(`Current gate ID converted to string: "${currentGateIdStr}"`);
    
    // Log each comparison
    const comparisonResults = allowedGateIds.map(allowedGateId => {
      const allowedGateIdStr = allowedGateId.toString().trim();
      const exactMatch = allowedGateIdStr === currentGateIdStr;
      const caseInsensitiveMatch = allowedGateIdStr.toLowerCase() === currentGateIdStr.toLowerCase();
      console.log(`Comparing "${allowedGateIdStr}" with "${currentGateIdStr}": exact=${exactMatch}, caseInsensitive=${caseInsensitiveMatch}`);
      return exactMatch || caseInsensitiveMatch;
    });
    
    const isGateAllowed = comparisonResults.some(result => result);
    console.log(`Result for scenario ${index + 1}: ${isGateAllowed}`);
  });
  
  return "Test completed - check console logs";
}

// Simple test function for user issue - test with any vehicle that has allowed gates "1,2" and gate ID "1"
function testVehicleWithGates12() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const vehicleSheet = ss.getSheetByName(VEHICLE_SHEET);
    const vehicleData = vehicleSheet.getDataRange().getValues();
    
    // Find a vehicle with allowed gates "1,2"
    for (let i = 1; i < vehicleData.length; i++) {
      const row = vehicleData[i];
      const allowedGates = row[13]; // Column N
      if (allowedGates && allowedGates.toString().includes("1,2")) {
        console.log(`Found test vehicle: ${row[1]} (ID: ${row[0]})`);
        console.log(`Allowed gates: "${allowedGates}"`);
        
        // Test validation with gate ID "1"
        const result = validateVehicleGateAccess(row[0], row[1], "1");
        console.log("Validation result:", result);
        return result;
      }
    }
    
    console.log("No vehicle found with allowed gates containing '1,2'");
    return "No test vehicle found";
  } catch (error) {
    console.error("Test error:", error);
    return `Error: ${error.toString()}`;
  }
}

// Debug current gate system - check what gates are available and their format
function debugCurrentGateSystem() {
  try {
    console.log("=== DEBUG CURRENT GATE SYSTEM ===");
    
    // Check gate sheet data
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const gateSheet = ss.getSheetByName(GATES_SHEET);
    const gateData = gateSheet.getDataRange().getValues();
    
    console.log("Gate sheet headers:", gateData[0]);
    console.log("Gate sheet data:");
    for (let i = 1; i < gateData.length; i++) {
      const row = gateData[i];
      console.log(`Row ${i}: ID="${row[0]}" (type: ${typeof row[0]}), Name="${row[1]}" (type: ${typeof row[1]})`);
    }
    
    // Check what getActiveGates returns
    const activeGates = getActiveGates();
    console.log("getActiveGates() result:", activeGates);
    
    // Test a simple validation scenario
    console.log("\n--- Testing simple validation ---");
    const testResult = validateVehicleGateAccess("000001", "ABC123", "1");
    console.log("Test validation result:", testResult);
    
    return {
      gateSheetHeaders: gateData[0],
      gateSheetData: gateData.slice(1),
      activeGates: activeGates,
      testValidation: testResult
    };
  } catch (error) {
    console.error("Debug error:", error);
    return `Error: ${error.toString()}`;
  }
}

// Test function to debug gate access validation
function debugGateAccessValidation(vehicleId, plateNumber, gateId) {
  try {
    console.log(`=== DEBUGGING GATE ACCESS ===`);
    console.log(`Input: vehicleId=${vehicleId}, plateNumber=${plateNumber}, gateId=${gateId}`);
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const vehicleSheet = ss.getSheetByName(VEHICLE_SHEET);
    const vehicleData = vehicleSheet.getDataRange().getValues();
    
    // Find vehicle
    let vehicleRow = null;
    for (let i = 1; i < vehicleData.length; i++) {
      const row = vehicleData[i];
      if (row[0] == vehicleId || row[1] === plateNumber) {
        vehicleRow = row;
        console.log(`Found vehicle at row ${i}:`, row);
        break;
      }
    }
    
    if (!vehicleRow) {
      return "Vehicle not found";
    }
    
    const allowedGates = vehicleRow[13];
    console.log(`Raw allowed gates value: "${allowedGates}" (type: ${typeof allowedGates})`);
    
    if (!allowedGates || allowedGates.trim() === "") {
      return "No gate restrictions - should allow all gates";
    }
    
    const allowedGateIds = allowedGates.split(',').map(gateId => gateId.trim());
    console.log(`Parsed allowed gate IDs:`, allowedGateIds);
    console.log(`Current gate ID: "${gateId}" (type: ${typeof gateId})`);
    
    // Test comparison logic
    const comparisons = allowedGateIds.map(allowedId => ({
      allowedId: allowedId,
      currentGateId: gateId,
      strictEquals: allowedId === gateId.toString(),
      lowerCaseEquals: allowedId.toLowerCase() === gateId.toLowerCase(),
      typeAllowed: typeof allowedId,
      typeCurrent: typeof gateId
    }));
    
    console.log(`Comparison results:`, comparisons);
    
    // Convert both to strings for reliable comparison
    const currentGateIdStr = gateId.toString().trim();
    const isGateAllowed = allowedGateIds.some(allowedGateId => {
      const allowedGateIdStr = allowedGateId.toString().trim();
      return allowedGateIdStr === currentGateIdStr || 
             allowedGateIdStr.toLowerCase() === currentGateIdStr.toLowerCase();
    });
    
    console.log(`Final result: isGateAllowed = ${isGateAllowed}`);
    
    return {
      vehicleFound: true,
      allowedGatesRaw: allowedGates,
      allowedGateIds: allowedGateIds,
      currentGateId: gateId,
      comparisons: comparisons,
      isAllowed: isGateAllowed
    };
    
  } catch (error) {
    console.error("Debug error:", error);
    return `Error: ${error.toString()}`;
  }
}

// Test function to verify gate sheet structure and functionality
function testGateSystemStructure() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const gateSheet = ss.getSheetByName(GATES_SHEET);
    
    if (!gateSheet) {
      return "Gate sheet not found";
    }
    
    const headers = gateSheet.getRange(1, 1, 1, gateSheet.getLastColumn()).getValues()[0];
    const data = gateSheet.getDataRange().getValues();
    
    // Test gate functions
    const simpleGateList = getSimpleGateList();
    const fullGateList = getGateList();
    const activeGates = getActiveGates();
    
    const result = {
      sheetName: GATES_SHEET,
      headers: headers,
      expectedHeaders: ["Id", "GateName"],
      headersCorrect: headers[0] === "Id" && headers[1] === "GateName",
      totalGates: data.length - 1,
      sampleGateData: data.length > 1 ? {
        id: data[1][0],
        gateName: data[1][1]
      } : "No gates found",
      functionTests: {
        simpleGateList: simpleGateList.length,
        fullGateList: fullGateList.length,
        activeGates: activeGates.length
      },
      gateFunctionality: {
        simpleListValid: simpleGateList.every(gate => gate.gateId !== undefined && gate.gateName !== undefined),
        activeGatesValid: activeGates.every(gate => gate.id !== undefined && gate.name !== undefined)
      }
    };
    
    console.log("Gate System Test Result:", JSON.stringify(result, null, 2));
    return result;
    
  } catch (error) {
    console.error("Error testing gate system:", error);
    return "Error: " + error.toString();
  }
}

// Test function to verify allowed gates data structure
function testAllowedGatesData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const vehicleSheet = ss.getSheetByName(VEHICLE_SHEET);
    
    if (!vehicleSheet) {
      return "Vehicle sheet not found";
    }
    
    const headers = vehicleSheet.getRange(1, 1, 1, vehicleSheet.getLastColumn()).getValues()[0];
    const data = vehicleSheet.getDataRange().getValues();
    
    const result = {
      sheetName: VEHICLE_SHEET,
      totalColumns: headers.length,
      totalRows: data.length - 1, // Excluding header
      headers: headers,
      allowedGatesColumnIndex: headers.indexOf("Allowed Gates"),
      sampleVehicleData: data.length > 1 ? {
        vehicleId: data[1][0],
        plateNumber: data[1][1],
        allowedGates: data[1][13] || "Not set"
      } : "No vehicles found"
    };
    
    console.log("Allowed Gates Test Result:", JSON.stringify(result, null, 2));
    return result;
    
  } catch (error) {
    console.error("Error testing allowed gates data:", error);
    return "Error: " + error.toString();
  }
}

// One-time migration function to add One Time Pass column
function migrateAddOneTimePassColumn() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const vehicleSheet = ss.getSheetByName(VEHICLE_SHEET);

    if (!vehicleSheet) {
      return "Vehicle sheet not found";
    }

    // Check if column already exists
    const headers = vehicleSheet
      .getRange(1, 1, 1, vehicleSheet.getLastColumn())
      .getValues()[0];
    if (headers.includes("One Time Pass")) {
      return "One Time Pass column already exists";
    }

    // Add header in column L (12th column)
    vehicleSheet.getRange(1, 12).setValue("One Time Pass");
    vehicleSheet.getRange(1, 12).setFontWeight("bold");

    // Get number of vehicles (rows - 1 for header)
    const lastRow = vehicleSheet.getLastRow();
    if (lastRow > 1) {
      // Set default value "No" for all existing vehicles
      const defaultValues = Array(lastRow - 1).fill(["No"]);
      vehicleSheet.getRange(2, 12, lastRow - 1, 1).setValues(defaultValues);
    }

    // Auto-resize the new column
    vehicleSheet.autoResizeColumn(12);

    return `Successfully added One Time Pass column. Updated ${
      lastRow - 1
    } vehicles.`;
  } catch (error) {
    console.error("Migration error:", error);
    return "Error during migration: " + error.toString();
  }
}

// Migration function to update gate sheet headers to Id/GateName format
function migrateGateSheetHeaders() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const gateSheet = ss.getSheetByName(GATES_SHEET);

    if (!gateSheet) {
      return "Gate sheet not found";
    }

    // Get current headers
    const headers = gateSheet.getRange(1, 1, 1, gateSheet.getLastColumn()).getValues()[0];
    
    // Check if migration is needed
    if (headers[0] === "Id" && headers[1] === "GateName") {
      return "Gate sheet headers already in correct format";
    }

    // Update headers to new format
    if (headers.length >= 2) {
      gateSheet.getRange(1, 1, 1, 2).setValues([["Id", "GateName"]]);
      gateSheet.getRange(1, 1, 1, 2).setFontWeight("bold");
      return "Successfully updated gate sheet headers to Id/GateName format";
    } else {
      return "Gate sheet structure is incomplete";
    }
  } catch (error) {
    console.error("Migration error:", error);
    return "Error during migration: " + error.toString();
  }
}

// One-time migration function to convert gate names to gate IDs in vehicle allowed gates
function migrateGateNamesToIds() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const vehicleSheet = ss.getSheetByName(VEHICLE_SHEET);
    const gateSheet = ss.getSheetByName(GATES_SHEET);

    if (!vehicleSheet || !gateSheet) {
      return "Required sheets not found";
    }

    // Get gate mapping (name to ID)
    const gateData = gateSheet.getDataRange().getValues();
    const gateNameToId = {};
    
    for (let i = 1; i < gateData.length; i++) {
      const gateId = gateData[i][0];
      const gateName = gateData[i][1];
      if (gateId && gateName) {
        gateNameToId[gateName.toLowerCase()] = gateId.toString();
      }
    }

    // Get vehicle data
    const vehicleData = vehicleSheet.getDataRange().getValues();
    let updateCount = 0;

    for (let i = 1; i < vehicleData.length; i++) {
      const allowedGates = vehicleData[i][13]; // Allowed Gates column (N)
      
      if (allowedGates && typeof allowedGates === 'string' && allowedGates.trim() !== '') {
        // Split by comma and check if it contains gate names (not already IDs)
        const gateList = allowedGates.split(',').map(g => g.trim());
        const hasGateNames = gateList.some(gate => isNaN(gate) && gate.length > 1);
        
        if (hasGateNames) {
          // Convert gate names to IDs
          const convertedIds = gateList.map(gateName => {
            const lowerGateName = gateName.toLowerCase();
            if (gateNameToId[lowerGateName]) {
              return gateNameToId[lowerGateName];
            }
            // If it's already a number, keep it
            if (!isNaN(gateName)) {
              return gateName;
            }
            // Unknown gate name, keep as is but log warning
            console.warn(`Unknown gate name during migration: ${gateName}`);
            return gateName;
          });
          
          const convertedString = convertedIds.join(',');
          vehicleSheet.getRange(i + 1, 14).setValue(convertedString); // Column N is index 14 (1-based)
          updateCount++;
        }
      }
    }

    return `Successfully migrated ${updateCount} vehicles from gate names to gate IDs`;
  } catch (error) {
    console.error("Migration error:", error);
    return "Error during migration: " + error.toString();
  }
}

// One-time migration function to add Allowed Gates column for gate restrictions
function migrateAddAllowedGatesColumn() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const vehicleSheet = ss.getSheetByName(VEHICLE_SHEET);

    if (!vehicleSheet) {
      return "Vehicle sheet not found";
    }

    // Get current headers to check what columns exist
    const lastColumn = vehicleSheet.getLastColumn();
    const headers = vehicleSheet
      .getRange(1, 1, 1, lastColumn)
      .getValues()[0];
    
    console.log("Current headers:", headers);
    console.log("Current number of columns:", lastColumn);

    // Check if Allowed Gates column already exists
    if (headers.includes("Allowed Gates")) {
      return "Allowed Gates column already exists";
    }

    // Determine where to add the column
    let targetColumn;
    
    if (lastColumn === 13 && headers[12] === "MV File") {
      // Standard 13-column setup, add as 14th column
      targetColumn = 14;
    } else if (lastColumn === 12 && headers[11] === "One Time Pass") {
      // 12-column setup without MV File, add MV File first, then Allowed Gates
      vehicleSheet.getRange(1, 13).setValue("MV File");
      vehicleSheet.getRange(1, 13).setFontWeight("bold");
      targetColumn = 14;
      
      // Add empty MV File data for existing vehicles
      const lastRow = vehicleSheet.getLastRow();
      if (lastRow > 1) {
        const mvFileDefaults = Array(lastRow - 1).fill([""]);
        vehicleSheet.getRange(2, 13, lastRow - 1, 1).setValues(mvFileDefaults);
      }
    } else {
      // Custom setup, add at next available column
      targetColumn = lastColumn + 1;
    }

    // Add Allowed Gates header
    vehicleSheet.getRange(1, targetColumn).setValue("Allowed Gates");
    vehicleSheet.getRange(1, targetColumn).setFontWeight("bold");

    // Get number of vehicles (rows - 1 for header)
    const lastRow = vehicleSheet.getLastRow();
    let updatedVehicles = 0;
    
    if (lastRow > 1) {
      // Set default value "" (empty) for all existing vehicles
      // Empty means "allow access to all gates"
      const defaultValues = Array(lastRow - 1).fill([""]);
      vehicleSheet.getRange(2, targetColumn, lastRow - 1, 1).setValues(defaultValues);
      updatedVehicles = lastRow - 1;
    }

    // Auto-resize the new column
    vehicleSheet.autoResizeColumn(targetColumn);
    
    // Also resize MV File column if we added it
    if (targetColumn === 14 && lastColumn === 12) {
      vehicleSheet.autoResizeColumn(13);
    }

    // Update the sheet to ensure proper formatting
    vehicleSheet.setFrozenRows(1);
    
    const finalColumnCount = vehicleSheet.getLastColumn();
    const message = targetColumn === 14 && lastColumn === 12 
      ? `Successfully added MV File and Allowed Gates columns. Updated ${updatedVehicles} vehicles. Sheet now has ${finalColumnCount} columns.`
      : `Successfully added Allowed Gates column in position ${targetColumn}. Updated ${updatedVehicles} vehicles. Sheet now has ${finalColumnCount} columns.`;

    console.log(message);
    return message;

  } catch (error) {
    console.error("Gate restriction migration error:", error);
    return "Error during gate restriction migration: " + error.toString();
  }
}

// Comprehensive migration function to ensure both Vehicle Master and Gates have correct schema
function migrateToLatestSchema() {
  try {
    console.log("Starting comprehensive schema migration...");
    
    const results = [];
    
    // Migrate gate sheet headers
    const gateResult = migrateGateSheetHeaders();
    results.push(`Gate Headers: ${gateResult}`);
    
    // Migrate vehicle master columns
    const vehicleResult = migrateVehicleMasterToLatestSchema();
    results.push(`Vehicle Master: ${vehicleResult}`);
    
    // Migrate gate names to IDs in vehicle data
    const gateDataResult = migrateGateNamesToIds();
    results.push(`Gate Data Migration: ${gateDataResult}`);
    
    return results.join('\n');
  } catch (error) {
    console.error("Comprehensive migration error:", error);
    return "Error during comprehensive migration: " + error.toString();
  }
}

// Vehicle Master migration function to ensure all required columns
function migrateVehicleMasterToLatestSchema() {
  try {
    const results = [];
    
    // Run One Time Pass migration first
    const otpResult = migrateAddOneTimePassColumn();
    results.push("OTP Migration: " + otpResult);
    
    // Run Allowed Gates migration
    const gatesResult = migrateAddAllowedGatesColumn();
    results.push("Gates Migration: " + gatesResult);
    
    // Clear cache after migrations
    clearAllCaches();
    results.push("Cache cleared successfully");
    
    return {
      success: true,
      message: "Vehicle Master schema migration completed",
      details: results
    };
    
  } catch (error) {
    console.error("Comprehensive migration error:", error);
    return {
      success: false,
      message: "Error during comprehensive migration: " + error.toString(),
      details: []
    };
  }
}

// One-time migration function to convert driver IDs to driver names in vehicle sheet
function migrateDriverIdsToNames() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const vehicleSheet = ss.getSheetByName(VEHICLE_SHEET);
    const driverSheet = ss.getSheetByName(DRIVER_SHEET);

    if (!vehicleSheet || !driverSheet) {
      return "Vehicle or Driver sheet not found";
    }

    const vehicleData = vehicleSheet.getDataRange().getValues();
    const driverData = driverSheet.getDataRange().getValues();
    
    if (vehicleData.length <= 1 || driverData.length <= 1) {
      return "No data to migrate";
    }

    // Create driver lookup map (ID -> Name)
    const driverMap = {};
    for (let i = 1; i < driverData.length; i++) {
      const driverId = driverData[i][0]; // Column A - Driver ID
      const driverName = driverData[i][1]; // Column B - Driver Name
      if (driverId && driverName) {
        driverMap[driverId.toString()] = driverName;
      }
    }

    let updatedCount = 0;
    const updates = [];

    // Check each vehicle's current driver (Column I, index 8)
    for (let i = 1; i < vehicleData.length; i++) {
      const currentDriver = vehicleData[i][8];
      
      // If current driver looks like an ID (numeric) and exists in driver map
      if (currentDriver && /^\d+$/.test(currentDriver.toString()) && driverMap[currentDriver.toString()]) {
        const driverName = driverMap[currentDriver.toString()];
        updates.push({
          row: i + 1,
          col: 9, // Column I (1-based)
          oldValue: currentDriver,
          newValue: driverName
        });
        updatedCount++;
      }
    }

    // Apply updates if any found
    if (updates.length > 0) {
      updates.forEach(update => {
        vehicleSheet.getRange(update.row, update.col).setValue(update.newValue);
      });
      
      return `Successfully migrated ${updatedCount} vehicles from driver IDs to driver names.`;
    } else {
      return "No driver IDs found to migrate. All vehicles already have driver names.";
    }

  } catch (error) {
    console.error("Migration error:", error);
    return "Error during migration: " + error.toString();
  }
}

const VEHICLE_SHEET = "VehicleMaster";
const DRIVER_SHEET = "DriverMaster";
const LOG_SHEET = "InOutLogs";
const USERS_SHEET = "Users";
const GATES_SHEET = "Gates";

// Enhanced error handling
class VehicleMonitoringError extends Error {
  constructor(message, code = "GENERAL_ERROR") {
    super(message);
    this.name = "VehicleMonitoringError";
    this.code = code;
  }
}

// Password hashing utility functions
function hashPassword(password) {
  try {
    // Use SHA-256 for password hashing with salt
    const salt = Utilities.getUuid();
    const hashedPassword = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      password + salt,
      Utilities.Charset.UTF_8
    );

    // Convert to hex string
    const hashHex = hashedPassword
      .map((byte) =>
        (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, "0")
      )
      .join("");

    // Return salt:hash format
    return salt + ":" + hashHex;
  } catch (error) {
    console.error("Error hashing password:", error);
    throw new VehicleMonitoringError("Failed to hash password", "HASH_ERROR");
  }
}

function verifyPassword(password, hashedPassword) {
  try {
    // Security: Only accept properly hashed passwords with salt:hash format
    if (!hashedPassword || !hashedPassword.includes(":")) {
      console.warn("Rejecting login attempt with invalid password format");
      return false; // Reject any non-hashed passwords
    }

    // Extract salt and hash
    const [salt, hash] = hashedPassword.split(":");

    if (!salt || !hash) {
      console.warn("Invalid password format: missing salt or hash");
      return false;
    }

    // Hash the provided password with the stored salt
    const computedHash = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      password + salt,
      Utilities.Charset.UTF_8
    );

    // Convert to hex string
    const computedHashHex = computedHash
      .map((byte) =>
        (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, "0")
      )
      .join("");

    // Compare hashes
    return computedHashHex === hash;
  } catch (error) {
    console.error("Error verifying password:", error);
    return false;
  }
}

// Cache utility functions for improved performance
function clearVehicleCache() {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove("vehicle_list_data");
    console.log("Vehicle cache cleared");
  } catch (error) {
    console.warn("Could not clear vehicle cache:", error);
  }
}

// Utility functions for better security
function sanitizeInput(input) {
  if (typeof input !== "string") return input;
  return input
    .toString()
    .trim()
    .replace(/[<>"'&]/g, "");
}

// ===== ROLE-BASED ACCESS CONTROL SYSTEM =====

/**
 * Role-based permissions matrix
 * Defines what each role can access and modify
 */
const ROLE_PERMISSIONS = {
  "super-admin": {
    // Full access to all features
    users: {
      create: true,
      read: true,
      update: true,
      delete: true,
      manageRoles: ["super-admin", "admin", "security"], // Can create any role
    },
    vehicles: {
      create: true,
      read: true,
      update: true,
      delete: true,
      updateDriver: true,
    },
    gates: {
      create: true,
      read: true,
      update: true,
      delete: true,
      transactions: true,
    },
    system: {
      exportLogs: true,
      clearData: true,
      viewReports: true,
    },
  },
  admin: {
    // Can manage vehicles, limited user management
    users: {
      create: true,
      read: true,
      update: true,
      delete: false, // Cannot delete users
      manageRoles: ["admin", "security"], // Cannot create super-admin
    },
    vehicles: {
      create: true,
      read: true,
      update: true,
      delete: false, // Cannot delete vehicles
      updateDriver: true,
    },
    gates: {
      create: true,
      read: true,
      update: true,
      delete: false, // Cannot delete gates
      transactions: true,
    },
    system: {
      exportLogs: true,
      clearData: false,
      viewReports: true,
    },
  },
  security: {
    // Limited to driver updates and gate transactions
    users: {
      create: false,
      read: false,
      update: false,
      delete: false,
      manageRoles: [],
    },
    vehicles: {
      create: false,
      read: true,
      update: false,
      delete: false,
      updateDriver: true, // Only can update current driver field
    },
    gates: {
      create: false,
      read: true,
      update: false,
      delete: false,
      transactions: true, // Can manage IN/OUT transactions
    },
    system: {
      exportLogs: false,
      clearData: false,
      viewReports: false,
    },
  },
};

/**
 * Check if a user role has specific permission
 * @param {string} userRole - User's role
 * @param {string} resource - Resource type (users, vehicles, gates, system)
 * @param {string} action - Action type (create, read, update, delete, etc.)
 * @returns {boolean} - Whether permission is granted
 */
function hasPermission(userRole, resource, action) {
  if (!userRole || !resource || !action) {
    console.warn("hasPermission: Missing required parameters", {
      userRole,
      resource,
      action,
    });
    return false;
  }

  const rolePerms = ROLE_PERMISSIONS[userRole];
  if (!rolePerms) {
    console.warn(`hasPermission: Invalid role '${userRole}'`);
    return false;
  }

  const resourcePerms = rolePerms[resource];
  if (!resourcePerms) {
    console.warn(
      `hasPermission: Invalid resource '${resource}' for role '${userRole}'`
    );
    return false;
  }

  return resourcePerms[action] === true;
}

/**
 * Check if user can manage specific roles
 * @param {string} userRole - User's role
 * @param {string} targetRole - Role to be managed
 * @returns {boolean} - Whether user can manage the target role
 */
function canManageRole(userRole, targetRole) {
  if (!userRole || !targetRole) {
    return false;
  }

  const rolePerms = ROLE_PERMISSIONS[userRole];
  if (!rolePerms || !rolePerms.users) {
    return false;
  }

  return rolePerms.users.manageRoles.includes(targetRole);
}

/**
 * Enforce permission check with automatic error throwing
 * @param {string} userRole - User's role
 * @param {string} resource - Resource type
 * @param {string} action - Action type
 * @param {string} customMessage - Optional custom error message
 * @throws {Error} - If permission is denied
 */
function enforcePermission(userRole, resource, action, customMessage = null) {
  if (!hasPermission(userRole, resource, action)) {
    const message =
      customMessage ||
      `Access denied: ${userRole} role cannot ${action} ${resource}`;
    console.warn(
      `Permission denied: ${userRole} attempted to ${action} ${resource}`
    );
    throw new VehicleMonitoringError(message, "PERMISSION_DENIED");
  }
}

/**
 * Get user's role-specific permissions for frontend
 * @param {string} userRole - User's role
 * @returns {object} - Permission object for frontend
 */
function getUserPermissions(userRole) {
  const rolePerms = ROLE_PERMISSIONS[userRole];
  if (!rolePerms) {
    return {
      users: { create: false, read: false, update: false, delete: false },
      vehicles: {
        create: false,
        read: false,
        update: false,
        delete: false,
        updateDriver: false,
      },
      gates: {
        create: false,
        read: false,
        update: false,
        delete: false,
        transactions: false,
      },
      system: { exportLogs: false, clearData: false, viewReports: false },
    };
  }

  return JSON.parse(JSON.stringify(rolePerms)); // Deep copy to prevent modification
}

/**
 * Log user activity with role information
 * @param {string} username - Username
 * @param {string} userRole - User's role
 * @param {string} action - Action performed
 * @param {string} resource - Resource affected
 * @param {string} result - Result of action (success/failure)
 * @param {string} details - Additional details
 */
function logUserActivity(
  username,
  userRole,
  action,
  resource,
  result,
  details = ""
) {
  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("UserActivity");
    if (!sheet) {
      console.warn("UserActivity sheet not found, skipping activity log");
      return;
    }

    const timestamp = new Date();
    const logEntry = [
      timestamp,
      username || "Unknown",
      userRole || "Unknown",
      action || "Unknown",
      resource || "Unknown",
      result || "Unknown",
      details,
    ];

    sheet.appendRow(logEntry);
    console.log(
      `Activity logged: ${username} (${userRole}) ${action} ${resource} - ${result}`
    );
  } catch (error) {
    console.error("Error logging user activity:", error);
  }
}

/**
 * Log vehicle audit trail for super-admin and admin only
 * Format: Timestamp (June 23, 2025 23:30) | Username | Old Data | New Data
 * @param {string} username - Username performing the action
 * @param {string} userRole - User's role
 * @param {Array} oldData - Previous vehicle data
 * @param {Array} newData - New vehicle data
 */
function logVehicleAuditTrail(username, userRole, oldData, newData) {
  // Only super-admin and admin can use audit trail
  if (userRole !== "super-admin" && userRole !== "admin") {
    return;
  }

  try {
    let auditSheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(
        "VehicleAuditTrail"
      );

    // Create audit sheet if it doesn't exist
    if (!auditSheet) {
      const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
      auditSheet = spreadsheet.insertSheet("VehicleAuditTrail");

      // Add headers
      const headers = ["Timestamp", "Username", "Old Data", "New Data"];
      auditSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      auditSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    }

    // Try to get current user from session or use passed username
    let actualUsername = username;
    console.log(
      `Starting audit trail username resolution. Initial username: ${actualUsername}, userRole: ${userRole}`
    );

    if (!actualUsername || actualUsername === "Unknown") {
      console.log("Username is Unknown, trying to resolve...");

      // First try to get from cached session
      try {
        const currentUserSession = getCurrentUser();
        console.log("getCurrentUser() result:", currentUserSession);
        if (currentUserSession.success) {
          // Accept any cached user for now (not just matching role)
          actualUsername = currentUserSession.username;
          console.log(`Got username from session cache: ${actualUsername}`);
        }
      } catch (e) {
        console.log("Could not get user from session cache:", e);
      }

      // Try to get the current active user from Google Apps Script
      if (!actualUsername || actualUsername === "Unknown") {
        try {
          const currentUser = Session.getActiveUser().getEmail();
          console.log("Google Session user email:", currentUser);
          if (currentUser && currentUser !== "") {
            // Extract username from email (everything before @)
            const emailUsername = currentUser.split("@")[0];

            // Try to match this with a known user in the Users sheet
            try {
              const usersSheet =
                SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Users");
              if (usersSheet) {
                const userData = usersSheet.getDataRange().getValues();
                let foundMatchingUser = false;

                // Look for user with matching email or similar username
                for (let i = 1; i < userData.length; i++) {
                  const dbUsername = userData[i][1]; // Username at index 1
                  const dbEmail = userData[i][5]; // Email at index 5
                  const dbRole = userData[i][3]; // Role at index 3

                  // Check if email matches exactly or username matches
                  if (
                    dbEmail === currentUser ||
                    dbUsername === emailUsername ||
                    dbUsername.toLowerCase() === emailUsername.toLowerCase()
                  ) {
                    actualUsername = dbUsername;
                    console.log(
                      `Found matching user in database: ${actualUsername} (${dbRole})`
                    );
                    foundMatchingUser = true;
                    break;
                  }
                }

                // If no exact match found, use the email username but try to find similar
                if (!foundMatchingUser) {
                  // Look for partial matches (useful for cases like r3dhorse1985 -> admin, jun, etc.)
                  for (let i = 1; i < userData.length; i++) {
                    const dbUsername = userData[i][1];
                    const dbRole = userData[i][3];

                    // Check if this could be a known admin user based on role
                    if (
                      userRole === dbRole &&
                      (dbRole === "super-admin" || dbRole === "admin")
                    ) {
                      actualUsername = dbUsername;
                      console.log(
                        `Using role-matched user: ${actualUsername} (${dbRole}) for Google user ${emailUsername}`
                      );
                      foundMatchingUser = true;
                      break;
                    }
                  }
                }
              }
            } catch (userLookupError) {
              console.log(
                "Error looking up user in database:",
                userLookupError
              );
            }

            // Fallback to email username if no database match found
            if (!actualUsername || actualUsername === "Unknown") {
              actualUsername = emailUsername;
              console.log(
                `Using email username as fallback: ${actualUsername}`
              );
            }
          }
        } catch (e) {
          console.log("Could not get active user from session:", e);
        }
      }

      // If still unknown, try to find the most recent login from UserActivity
      if (!actualUsername || actualUsername === "Unknown") {
        try {
          const userActivitySheet =
            SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(
              "UserActivity"
            );
          if (userActivitySheet) {
            const activityData = userActivitySheet.getDataRange().getValues();
            console.log(
              `Checking ${activityData.length} activity rows for recent login`
            );

            // Look for recent successful login (within last 10 entries)
            const recentEntries = Math.min(10, activityData.length - 1);
            for (
              let i = activityData.length - 1;
              i >= Math.max(1, activityData.length - recentEntries);
              i--
            ) {
              const row = activityData[i];
              console.log(`Checking activity row ${i}:`, row);
              if (
                row[2] === userRole &&
                row[3] === "login" &&
                row[4] === "success"
              ) {
                actualUsername = row[1]; // Username is at index 1
                console.log(
                  `Found recent login for ${userRole}: ${actualUsername}`
                );
                break;
              }
            }

            // If still not found, try any recent successful login regardless of role
            if (!actualUsername || actualUsername === "Unknown") {
              for (
                let i = activityData.length - 1;
                i >= Math.max(1, activityData.length - recentEntries);
                i--
              ) {
                const row = activityData[i];
                if (row[3] === "login" && row[4] === "success") {
                  actualUsername = row[1]; // Username is at index 1
                  console.log(`Found any recent login: ${actualUsername}`);
                  break;
                }
              }
            }
          }
        } catch (e) {
          console.log("Could not find user from activity log:", e);
        }
      }
    }

    console.log(`Final resolved username: ${actualUsername}`);

    // If still unknown, use a more descriptive placeholder
    if (!actualUsername || actualUsername === "Unknown") {
      actualUsername = `${userRole}-user`;
      console.log(`Using role-based placeholder: ${actualUsername}`);
    }

    // Format timestamp as requested: June 23, 2025 23:30
    const now = new Date();
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const formattedTimestamp = `${
      monthNames[now.getMonth()]
    } ${now.getDate()}, ${now.getFullYear()} ${now
      .getHours()
      .toString()
      .padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    // Format old and new data as readable strings
    const formatVehicleData = (data) => {
      if (!data || data.length === 0) return "No data";
      return `ID: ${data[0]}, Plate: ${data[1]}, Model: ${data[2]}, Color: ${data[3]}, Dept: ${data[4]}, Year: ${data[5]}, Type: ${data[6]}, Status: ${data[7]}, Driver: ${data[8]}, Assigned: ${data[9]}, Access: ${data[10]}`;
    };

    const oldDataFormatted = formatVehicleData(oldData);
    const newDataFormatted = formatVehicleData(newData);

    const auditEntry = [
      formattedTimestamp,
      actualUsername,
      oldDataFormatted,
      newDataFormatted,
    ];

    auditSheet.appendRow(auditEntry);
    console.log(
      `Vehicle audit trail logged: ${actualUsername} updated vehicle data`
    );
  } catch (error) {
    console.error("Error logging vehicle audit trail:", error);
  }
}

/**
 * Get vehicle audit trail for super-admin and admin only
 * @param {string} userRole - User's role
 * @returns {Array} - Array of audit trail entries
 */
function getVehicleAuditTrail(userRole) {
  // Only super-admin and admin can access audit trail
  if (userRole !== "super-admin" && userRole !== "admin") {
    throw new Error(
      "Access denied: Only super-admin and admin can access audit trail"
    );
  }

  try {
    const auditSheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(
        "VehicleAuditTrail"
      );

    if (!auditSheet) {
      return []; // Return empty array if audit sheet doesn't exist yet
    }

    const data = auditSheet.getDataRange().getValues();

    // Return all data including headers
    return data;
  } catch (error) {
    console.error("Error retrieving vehicle audit trail:", error);
    throw new Error("Failed to retrieve audit trail");
  }
}

/**
 * Wrapper functions for frontend to call with username
 * These functions help ensure the current username is properly passed to audit trail
 */

/**
 * Save vehicle with current username for audit trail
 * @param {Object} vehicleData - Vehicle data
 * @param {string} userRole - User's role
 * @param {number} editIndex - Index for editing (-1 for new)
 * @param {string} currentUsername - Current logged-in username
 * @returns {Object} - Success/error result
 */
function saveVehicleRecordWithUser(
  vehicleData,
  userRole,
  editIndex = -1,
  currentUsername = "Unknown"
) {
  return saveVehicleRecord(vehicleData, userRole, editIndex, currentUsername);
}

/**
 * Update vehicle with current username for audit trail
 * @param {number} rowIndex - Row index
 * @param {Array} updatedData - Updated vehicle data
 * @param {string} userRole - User's role
 * @param {string} currentUsername - Current logged-in username
 * @returns {boolean} - Success result
 */
function updateVehicleRecordWithUser(
  rowIndex,
  updatedData,
  userRole,
  currentUsername = "Unknown"
) {
  return updateVehicleRecord(rowIndex, updatedData, userRole, currentUsername);
}

/**
 * Delete vehicle with current username for audit trail
 * @param {number} vehicleIndex - Vehicle index
 * @param {string} userRole - User's role
 * @param {string} currentUsername - Current logged-in username
 * @returns {Object} - Success/error result
 */
function deleteVehicleRecordWithUser(
  vehicleIndex,
  userRole,
  currentUsername = "Unknown"
) {
  return deleteVehicleRecord(vehicleIndex, userRole, currentUsername);
}

/**
 * Set current session username for audit trail
 * Call this function from frontend after login to set the username for audit logging
 * @param {string} username - Current logged-in username
 * @param {string} userRole - User's role
 */
function setCurrentUser(username, userRole) {
  try {
    // Store in script cache for session duration
    const cache = CacheService.getScriptCache();
    const userData = {
      username: username,
      userRole: userRole,
      loginTime: new Date().toISOString(),
    };

    // Store for 6 hours (21600 seconds)
    cache.put("current_user_session", JSON.stringify(userData), 21600);

    console.log(`Current user session set: ${username} (${userRole})`);
    return { success: true, message: "User session set successfully" };
  } catch (error) {
    console.error("Error setting current user session:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get current session username for audit trail
 * @returns {Object} - Current user info or null if not set
 */
function getCurrentUser() {
  try {
    const cache = CacheService.getScriptCache();
    const userDataStr = cache.get("current_user_session");

    if (userDataStr) {
      const userData = JSON.parse(userDataStr);
      return {
        success: true,
        username: userData.username,
        userRole: userData.userRole,
        loginTime: userData.loginTime,
      };
    }

    return { success: false, message: "No active user session found" };
  } catch (error) {
    console.error("Error getting current user session:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Test function to verify audit trail username resolution
 * @param {string} userRole - User role to test with
 * @returns {Object} - Test results
 */
function testAuditTrailUsername(userRole = "super-admin") {
  try {
    console.log("=== Testing Audit Trail Username Resolution ===");

    // Test 1: Check current session
    const sessionResult = getCurrentUser();
    console.log("Current session:", sessionResult);

    // Test 2: Check Google session
    let googleUser = null;
    try {
      googleUser = Session.getActiveUser().getEmail();
      console.log("Google active user:", googleUser);
    } catch (e) {
      console.log("Google active user error:", e);
    }

    // Test 3: Check recent activity
    const userActivitySheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("UserActivity");
    let recentLogins = [];
    if (userActivitySheet) {
      const activityData = userActivitySheet.getDataRange().getValues();
      recentLogins = activityData.slice(-5).map((row) => ({
        timestamp: row[0],
        username: row[1],
        userRole: row[2],
        action: row[3],
        result: row[4],
      }));
    }

    return {
      success: true,
      tests: {
        sessionCache: sessionResult,
        googleUser: googleUser,
        recentLogins: recentLogins,
      },
      message: "Check console logs for detailed test results",
    };
  } catch (error) {
    console.error("Error in test function:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user permissions for frontend - called by frontend to determine UI visibility
 * @param {string} userRole - User's role
 * @returns {object} - Complete permission object for frontend use
 */
function getPermissionsForFrontend(userRole) {
  try {
    console.log(`Getting permissions for role: ${userRole}`);

    if (!userRole) {
      console.warn("No user role provided, returning empty permissions");
      return {
        error: "No user role provided",
        permissions: {},
      };
    }

    const permissions = getUserPermissions(userRole);

    // Add role-specific information
    const result = {
      success: true,
      userRole: userRole,
      permissions: permissions,
      canManageRoles: ROLE_PERMISSIONS[userRole]?.users?.manageRoles || [],
      timestamp: new Date().toISOString(),
    };

    console.log(
      `Permissions retrieved for ${userRole}:`,
      JSON.stringify(result, null, 2)
    );
    return result;
  } catch (error) {
    console.error("Error getting permissions for frontend:", error);
    return {
      success: false,
      error: error.message || "Failed to retrieve permissions",
      permissions: {},
    };
  }
}

// Generate next sequential user ID
function generateNextUserId() {
  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);
    if (!sheet) {
      return 1; // First user ID
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return 1; // First user ID if only header exists
    }

    let maxId = 0;
    for (let i = 1; i < data.length; i++) {
      const id = parseInt(data[i][0]) || 0;
      if (id > maxId) {
        maxId = id;
      }
    }

    return maxId + 1;
  } catch (error) {
    console.error("Error generating user ID:", error);
    return 1;
  }
}

// Generate next sequential vehicle ID with 6-digit padding (000001, 000002, etc.)
function generateNextVehicleId() {
  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
    if (!sheet) {
      return "000001"; // First vehicle ID
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return "000001"; // First vehicle ID if only header exists
    }

    let maxId = 0;
    for (let i = 1; i < data.length; i++) {
      // Extract numeric part from ID like "000123"
      const id = parseInt(data[i][0]) || 0;
      if (id > maxId) {
        maxId = id;
      }
    }

    // Return next ID with 6-digit padding
    const nextId = maxId + 1;
    return nextId.toString().padStart(6, "0");
  } catch (error) {
    console.error("Error generating vehicle ID:", error);
    return "000001";
  }
}

// Generate next sequential driver ID
function generateNextDriverId() {
  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DRIVER_SHEET);
    if (!sheet) {
      return 1; // First driver ID
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return 1; // First driver ID if only header exists
    }

    let maxId = 0;
    for (let i = 1; i < data.length; i++) {
      const id = parseInt(data[i][0]) || 0;
      if (id > maxId) {
        maxId = id;
      }
    }

    return maxId + 1;
  } catch (error) {
    console.error("Error generating driver ID:", error);
    return 1;
  }
}

// Generate next sequential log ID
function generateNextLogId() {
  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOG_SHEET);
    if (!sheet) {
      return 1; // First log ID
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return 1; // First log ID if only header exists
    }

    let maxId = 0;
    for (let i = 1; i < data.length; i++) {
      const id = parseInt(data[i][0]) || 0;
      if (id > maxId) {
        maxId = id;
      }
    }

    return maxId + 1;
  } catch (error) {
    console.error("Error generating log ID:", error);
    return 1;
  }
}

// Generate next sequential gate ID
function generateNextGateId() {
  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(GATES_SHEET);
    if (!sheet) {
      return "1"; // First gate ID as string
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return "1"; // First gate ID if only header exists as string
    }

    let maxId = 0;
    for (let i = 1; i < data.length; i++) {
      const id = parseInt(data[i][0]) || 0;
      if (id > maxId) {
        maxId = id;
      }
    }

    return (maxId + 1).toString(); // Return as string for consistency
  } catch (error) {
    console.error("Error generating gate ID:", error);
    return "1"; // Return as string for consistency
  }
}

function validateRequired(value, fieldName) {
  if (!value || (typeof value === "string" && value.trim() === "")) {
    throw new VehicleMonitoringError(
      `${fieldName} is required`,
      "VALIDATION_ERROR"
    );
  }
}

// Serve HTML Web App
function doGet(e) {
  // Always serve the single-page application
  return HtmlService.createTemplateFromFile("app")
    .evaluate()
    .setTitle("Vehicle Monitoring System")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

// Legacy functions kept for compatibility
function loadIndex() {
  return doGet({ parameter: { page: "dashboard" } });
}

// Vehicle Management Functions - CRUD

// Get all vehicles for management (enhanced)
function getVehicleListForManagement() {
  try {
    console.log("Getting vehicle list for management...");
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(VEHICLE_SHEET);

    if (!sheet) {
      console.log("Vehicle sheet not found, creating initial setup...");
      createInitialSheets();
      createSampleData();
      sheet = ss.getSheetByName(VEHICLE_SHEET);
      if (!sheet) {
        throw new Error("Failed to create vehicle sheet");
      }
    }

    const data = sheet.getDataRange().getValues();
    console.log(
      "Vehicle management data retrieved successfully:",
      data.length,
      "rows,",
      data[0].length,
      "columns"
    );

    // Clear cache to ensure fresh data
    clearVehicleCache();

    if (data.length <= 1) {
      console.log("No vehicle data found, creating sample data...");
      createSampleData();
      const updatedData = sheet.getDataRange().getValues();
      console.log("Vehicle data after sample creation:", updatedData.length);
      return updatedData;
    }

    // Resolve driver IDs to names for better UX
    const resolvedData = data.map((row, index) => {
      if (index === 0) {
        // Keep header row as is
        return row;
      }
      
      // Clone the row to avoid modifying original data
      const resolvedRow = [...row];
      
      // Resolve current driver ID (column I, index 8) to driver name
      const currentDriverId = row[8];
      if (currentDriverId && currentDriverId !== '') {
        resolvedRow[8] = getDriverNameById(currentDriverId);
      } else {
        resolvedRow[8] = 'Unassigned';
      }
      
      return resolvedRow;
    });

    return resolvedData;
  } catch (error) {
    console.error("Error getting vehicle list for management:", error);
    return [
      [
        "ID",
        "Plate Number",
        "Make/Model",
        "Color",
        "Department/Company",
        "Year",
        "Type",
        "Status",
        "Current Driver",
        "Assigned Drivers",
        "Access Status",
        "One Time Pass",
      ],
      [
        "000001",
        "ABC-123",
        "Toyota Camry",
        "White",
        "IT Department",
        "2022",
        "Car",
        "OUT",
        "John Doe",
        "John Doe",
        "Access",
        "No",
      ],
    ];
  }
}

// Save vehicle (create or update) - for management
function saveVehicleRecord(
  vehicleData,
  userRole,
  vehicleIdOrIndex = -1,
  currentUsername = "Unknown"
) {
  // Note: When updating, vehicleIdOrIndex can be either:
  // - A vehicle ID (string) that we'll use to find the correct row
  // - -1 for new vehicles
  // Use new permission system
  enforcePermission(
    userRole,
    "vehicles",
    "create",
    "Access denied: Cannot create or update vehicles"
  );

  // Get username from parameter, vehicleData, or default to Unknown
  const username =
    currentUsername !== "Unknown"
      ? currentUsername
      : vehicleData.username || "Unknown";

  // Log the activity
  logUserActivity(
    username,
    userRole,
    vehicleIdOrIndex === -1 ? "create" : "update",
    "vehicle",
    "attempting"
  );

  try {
    validateRequired(vehicleData.plateNumber, "Plate Number");
    validateRequired(vehicleData.model, "Make/Model");
    
    // Debug: Log the incoming vehicle data to see allowed gates
    console.log("Saving vehicle with data:", JSON.stringify(vehicleData));
    console.log("Allowed gates value:", vehicleData.allowedGates);

    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
    const data = sheet.getDataRange().getValues();

    const cleanPlateNumber = sanitizeInput(
      vehicleData.plateNumber.trim().toUpperCase()
    );

    console.log(
      `SaveVehicleRecord called with vehicleIdOrIndex: ${vehicleIdOrIndex}, plateNumber: ${cleanPlateNumber}`
    );
    console.log(`Total rows in sheet: ${data.length}`);

    // Find the actual row index by vehicle ID if updating
    let actualRowIndex = -1;
    let originalPlateNumber = null;

    if (vehicleIdOrIndex !== -1) {
      // vehicleIdOrIndex contains the vehicle ID when updating
      const vehicleId = vehicleIdOrIndex.toString();
      console.log(`Looking for vehicle with ID: ${vehicleId}`);

      // Find the actual row with this ID
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] && data[i][0].toString() === vehicleId) {
          actualRowIndex = i;
          originalPlateNumber = data[i][1];
          console.log(
            `Found vehicle ID ${vehicleId} at row ${i} with plate ${originalPlateNumber}`
          );
          break;
        }
      }

      if (actualRowIndex === -1) {
        throw new Error(`Vehicle with ID ${vehicleId} not found`);
      }
    }

    // Check if plate number already exists (excluding current vehicle)
    // Only check if it's a new vehicle or if the plate number has changed
    if (
      vehicleIdOrIndex === -1 ||
      (originalPlateNumber && originalPlateNumber !== cleanPlateNumber)
    ) {
      for (let i = 1; i < data.length; i++) {
        if (data[i][1] === cleanPlateNumber && i !== actualRowIndex) {
          console.log(
            `Duplicate found: plate ${cleanPlateNumber} at row ${i}, actualRowIndex is ${actualRowIndex}`
          );
          throw new Error("Vehicle with this plate number already exists");
        }
      }
    }

    let vehicleRow;
    if (actualRowIndex > 0) {
      // Capture old data for audit trail
      const oldVehicleData = data[actualRowIndex].slice(); // Copy original data

      // Update existing vehicle - keep existing ID
      vehicleRow = [
        data[actualRowIndex][0], // Keep existing ID
        cleanPlateNumber,
        sanitizeInput(vehicleData.model || ""),
        sanitizeInput(vehicleData.color || ""),
        sanitizeInput(vehicleData.department || ""),
        vehicleData.year || "",
        vehicleData.type || "Car",
        vehicleData.status || "OUT",
        sanitizeInput(vehicleData.driver || ""),
        sanitizeInput(vehicleData.assignedDrivers || ""),
        vehicleData.accessStatus || "Access",
        vehicleData.oneTimePass ? "Yes" : "No", // One Time Pass
        sanitizeInput(vehicleData.mvFile || ""), // MV File
        sanitizeInput(vehicleData.allowedGates || ""), // Allowed Gates
      ];
      
      // Debug: Log the constructed vehicle row
      console.log("Vehicle row length:", vehicleRow.length);
      console.log("Allowed gates in row (index 13):", vehicleRow[13]);

      // Log audit trail before updating (for super-admin and admin only)
      logVehicleAuditTrail(username, userRole, oldVehicleData, vehicleRow);

      // Update existing vehicle
      const range = sheet.getRange(actualRowIndex + 1, 1, 1, vehicleRow.length);
      range.setValues([vehicleRow]);
      logUserActivity(
        "system",
        "vehicle_updated",
        `Vehicle ${cleanPlateNumber} updated`
      );
      clearVehicleCache(); // Clear cache after update
      return { success: true, action: "updated" };
    } else {
      // Create new vehicle with auto-generated ID
      const vehicleId = generateNextVehicleId();
      vehicleRow = [
        vehicleId, // Auto-generated ID
        cleanPlateNumber,
        sanitizeInput(vehicleData.model || ""),
        sanitizeInput(vehicleData.color || ""),
        sanitizeInput(vehicleData.department || ""),
        vehicleData.year || "",
        vehicleData.type || "Car",
        vehicleData.status || "OUT",
        sanitizeInput(vehicleData.driver || ""),
        sanitizeInput(vehicleData.assignedDrivers || ""),
        vehicleData.accessStatus || "Access",
        vehicleData.oneTimePass ? "Yes" : "No", // One Time Pass
        sanitizeInput(vehicleData.mvFile || ""), // MV File
        sanitizeInput(vehicleData.allowedGates || ""), // Allowed Gates
      ];
      
      // Debug: Log the constructed vehicle row for new vehicle
      console.log("New vehicle row length:", vehicleRow.length);
      console.log("Allowed gates in new row (index 13):", vehicleRow[13]);

      sheet.appendRow(vehicleRow);
      logUserActivity(
        "system",
        "vehicle_created",
        `Vehicle ${cleanPlateNumber} created with ID ${vehicleId}`
      );
      clearVehicleCache(); // Clear cache after create
      return { success: true, action: "created", vehicleId: vehicleId };
    }
  } catch (error) {
    console.error("Error saving vehicle:", error);
    throw error;
  }
}

// Delete vehicle (management)
function deleteVehicleRecord(
  vehicleIndex,
  userRole,
  currentUsername = "Unknown"
) {
  // Use new permission system - only super-admin can delete vehicles
  enforcePermission(
    userRole,
    "vehicles",
    "delete",
    "Access denied: Only Super Admin can delete vehicles"
  );

  // Log the activity
  logUserActivity(currentUsername, userRole, "delete", "vehicle", "attempting");

  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
    const data = sheet.getDataRange().getValues();

    if (vehicleIndex < 1 || vehicleIndex >= data.length) {
      throw new Error("Invalid vehicle index");
    }

    const vehicleId = data[vehicleIndex][0]; // ID is at index 0
    const plateNumber = data[vehicleIndex][1]; // Plate number is now at index 1

    // Check if vehicle has recent activity
    const logSheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOG_SHEET);
    if (logSheet) {
      const logData = logSheet.getDataRange().getValues();
      const recentLogs = logData.slice(-50); // Check last 50 logs

      const vehicleInRecentUse = recentLogs.some(
        (row) => row[2] === plateNumber // Plate number is at index 2 in logs (after ID and timestamp)
      );
      if (vehicleInRecentUse) {
        // Don't delete, just set access to No Access
        sheet.getRange(vehicleIndex + 1, 11).setValue("No Access"); // Access status is now at column 11
        logUserActivity(
          "system",
          "vehicle_access_revoked",
          `Vehicle ${plateNumber} (ID: ${vehicleId}) access revoked (recent activity)`
        );
        clearVehicleCache(); // Clear cache after access revoke
        return { success: true, action: "access_revoked" };
      }
    }

    // Safe to delete
    sheet.deleteRow(vehicleIndex + 1);
    logUserActivity(
      "system",
      "vehicle_deleted",
      `Vehicle ${plateNumber} (ID: ${vehicleId}) deleted`
    );
    clearVehicleCache(); // Clear cache after delete
    return { success: true, action: "deleted" };
  } catch (error) {
    console.error("Error deleting vehicle:", error);
    throw error;
  }
}

// Enhanced vehicle list with search-based loading for big data handling
function getVehicleList(searchCriteria = {}) {
  const startTime = new Date();

  try {
    console.log("Getting vehicle list with search criteria:", searchCriteria);

    const {
      searchTerm = "",
      statusFilter = "",
      accessStatusFilter = "",
      departmentFilter = "",
      pageSize = 50,
      pageOffset = 0,
    } = searchCriteria;

    // Smart caching with search-aware keys
    const cache = CacheService.getScriptCache();
    const cacheKey = `vehicle_search_${JSON.stringify(searchCriteria)}`;

    // Check cache for search results
    if (
      !searchTerm &&
      !statusFilter &&
      !accessStatusFilter &&
      !departmentFilter
    ) {
      const cachedData = cache.get("vehicle_list_summary");
      if (cachedData) {
        console.log("Returning cached summary data");
        return JSON.parse(cachedData);
      }
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(VEHICLE_SHEET);

    if (!sheet) {
      console.log("Vehicle sheet not found, creating initial setup...");
      createInitialSheets();
      createSampleData();
      sheet = ss.getSheetByName(VEHICLE_SHEET);
      if (!sheet) {
        throw new Error("Failed to create vehicle sheet");
      }
    }

    // Optimized data retrieval for big datasets
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return getHeaderWithSampleData();
    }

    // For large datasets, use chunked reading
    let allData = [];
    const chunkSize = 1000; // Read 1000 rows at a time
    const header = sheet.getRange(1, 1, 1, 14).getValues()[0];
    // Keep all columns including ID and Allowed Gates
    allData.push(header);

    // If no search criteria, return paginated results
    if (
      !searchTerm &&
      !statusFilter &&
      !accessStatusFilter &&
      !departmentFilter
    ) {
      console.log("No search criteria - returning paginated results");
      const startRow = Math.max(2, pageOffset + 2);
      const endRow = Math.min(lastRow, startRow + pageSize - 1);

      if (startRow <= lastRow) {
        const paginatedData = sheet
          .getRange(startRow, 1, endRow - startRow + 1, 14)
          .getValues(); // Keep all columns including ID
        allData = allData.concat(paginatedData);
      }

      console.log(
        `Paginated data: ${allData.length - 1} rows (${startRow}-${endRow})`
      );
      return allData;
    }

    // Search-based filtering for efficient data loading
    console.log("Performing search-based filtering...");
    const searchTermLower = searchTerm.toLowerCase();
    let matchingRows = [];

    // Read and filter data in chunks to avoid memory issues
    for (let chunkStart = 2; chunkStart <= lastRow; chunkStart += chunkSize) {
      const chunkEnd = Math.min(chunkStart + chunkSize - 1, lastRow);
      const chunkData = sheet
        .getRange(chunkStart, 1, chunkEnd - chunkStart + 1, 14)
        .getValues();

      // Filter chunk data based on search criteria and remove ID column
      const filteredChunk = chunkData.filter((row) => {
        if (!row || row.length < 14) return false;

        // Search term matching (plate, model, driver, department)
        if (searchTerm) {
          const searchableText = [
            row[1] || "", // Plate Number
            row[2] || "", // Make/Model
            row[4] || "", // Department
            row[8] || "", // Current Driver
            row[9] || "", // Assigned Drivers
          ]
            .join(" ")
            .toLowerCase();

          if (!searchableText.includes(searchTermLower)) {
            return false;
          }
        }

        // Status filter (IN/OUT)
        if (statusFilter && row[7] !== statusFilter) {
          return false;
        }

        // Access status filter
        if (accessStatusFilter && row[10] !== accessStatusFilter) {
          return false;
        }

        // Department filter
        if (departmentFilter && row[4] !== departmentFilter) {
          return false;
        }

        return true;
      }); // Keep all columns including ID

      matchingRows = matchingRows.concat(filteredChunk);

      // Early termination if we have enough results
      if (matchingRows.length >= pageSize + pageOffset) {
        break;
      }
    }

    // Apply pagination to filtered results
    const paginatedResults = matchingRows.slice(
      pageOffset,
      pageOffset + pageSize
    );
    allData = allData.concat(paginatedResults);

    const loadTime = new Date() - startTime;
    console.log(
      `Search completed in ${loadTime}ms: ${matchingRows.length} matches, returning ${paginatedResults.length} results`
    );

    // Cache results for performance (smaller cache for search results)
    if (matchingRows.length < 100) {
      cache.put(cacheKey, JSON.stringify(allData), 180); // 3 minutes cache for search results
    }

    // Performance optimization logging
    if (loadTime > 3000) {
      console.warn(
        `Performance warning: Search took ${loadTime}ms. Consider optimizing search criteria.`
      );
    }

    // Resolve driver IDs to names for better UX
    const resolvedData = allData.map((row, index) => {
      if (index === 0) {
        // Keep header row as is
        return row;
      }
      
      // Clone the row to avoid modifying original data
      const resolvedRow = [...row];
      
      // Resolve current driver ID (column I, index 8) to driver name
      const currentDriverId = row[8];
      if (currentDriverId && currentDriverId !== '') {
        resolvedRow[8] = getDriverNameById(currentDriverId);
      } else {
        resolvedRow[8] = 'Unassigned';
      }
      
      return resolvedRow;
    });

    return resolvedData;
  } catch (error) {
    console.error("Error getting vehicle list:", error);
    return getHeaderWithSampleData();
  }
}

// Helper function to return header with sample data
function getHeaderWithSampleData() {
  return [
    [
      "Plate Number",
      "Make/Model",
      "Color",
      "Department/Company",
      "Year",
      "Type",
      "Status",
      "Current Driver",
      "Assigned Drivers",
      "Access Status",
      "One Time Pass",
    ],
    [
      "ABC-123",
      "Toyota Camry",
      "White",
      "IT Department",
      "2022",
      "Car",
      "OUT",
      "John Doe",
      "John Doe",
      "Access",
    ],
    [
      "XYZ-456",
      "Honda Civic",
      "Blue",
      "HR Department",
      "2021",
      "Car",
      "IN",
      "Jane Smith",
      "Jane Smith",
      "Access",
    ],
  ];
}

// Get vehicle count for pagination (optimized)
function getVehicleCount(searchCriteria = {}) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(VEHICLE_SHEET);

    if (!sheet) return 0;

    const {
      searchTerm = "",
      statusFilter = "",
      accessStatusFilter = "",
      departmentFilter = "",
    } = searchCriteria;

    // If no filters, return total count minus header
    if (
      !searchTerm &&
      !statusFilter &&
      !accessStatusFilter &&
      !departmentFilter
    ) {
      return Math.max(0, sheet.getLastRow() - 1);
    }

    // For filtered searches, we need to count matches
    // This is expensive for large datasets, so we cache it
    const cache = CacheService.getScriptCache();
    const cacheKey = `vehicle_count_${JSON.stringify(searchCriteria)}`;
    const cachedCount = cache.get(cacheKey);

    if (cachedCount) {
      return parseInt(cachedCount);
    }

    // Count matching rows (simplified version)
    const data = sheet.getDataRange().getValues();
    let count = 0;
    const searchTermLower = searchTerm.toLowerCase();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 11) continue;

      // Apply same filtering logic as main function
      if (searchTerm) {
        const searchableText = [row[1], row[2], row[4], row[8], row[9]]
          .join(" ")
          .toLowerCase();
        if (!searchableText.includes(searchTermLower)) continue;
      }

      if (statusFilter && row[7] !== statusFilter) continue;
      if (accessStatusFilter && row[10] !== accessStatusFilter) continue;
      if (departmentFilter && row[4] !== departmentFilter) continue;

      count++;
    }

    // Cache count for 5 minutes
    cache.put(cacheKey, count.toString(), 300);
    return count;
  } catch (error) {
    console.error("Error getting vehicle count:", error);
    return 0;
  }
}

// Legacy function for backward compatibility
function getVehicleListLegacy() {
  return getVehicleList({});
}

// Log In or Out action with validation and status update
function logVehicleAction(data) {
  try {
    // Debug: Log the incoming data to see what's being passed
    console.log("logVehicleAction called with data:", JSON.stringify(data));
    console.log("data.plateNumber value:", data.plateNumber);

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const logSheet = ss.getSheetByName(LOG_SHEET);
    const vehicleSheet = ss.getSheetByName(VEHICLE_SHEET);

    if (!logSheet || !vehicleSheet) {
      createInitialSheets();
      return logVehicleAction(data);
    }

    // Get vehicle data for validation and lookup
    const vehicleData = vehicleSheet.getDataRange().getValues();
    let vehicleRow = -1;
    let accessStatus = "Access"; // Default if not found
    let actualPlateNumber = data.plateNumber;
    let actualDriverId = data.driverId;
    
    // Convert driver ID to name if it's still an ID (safety check)
    if (actualDriverId && /^\d+$/.test(actualDriverId.toString())) {
      actualDriverId = getDriverNameById(actualDriverId);
    }

    // Fix corrupted data: If plateNumber looks like a vehicle ID (numeric), find the actual plate number
    if (/^\d+$/.test(data.plateNumber.toString())) {
      console.log(
        "Detected corrupted plateNumber (appears to be vehicle ID):",
        data.plateNumber
      );

      // Try to find vehicle by ID in column A (index 0)
      // Handle both padded (000001) and unpadded (1) vehicle IDs
      const searchId = data.plateNumber.toString();
      const paddedSearchId = searchId.padStart(6, "0");

      for (let i = 1; i < vehicleData.length; i++) {
        if (
          vehicleData[i][0] &&
          (vehicleData[i][0].toString() === searchId ||
            vehicleData[i][0].toString() === paddedSearchId)
        ) {
          vehicleRow = i;
          actualPlateNumber = vehicleData[i][1]; // Get actual plate number from column B
          accessStatus = vehicleData[i][10] || "Access"; // Access Status is in column K (index 10)
          console.log(
            "Found vehicle by ID. Actual plate number:",
            actualPlateNumber
          );
          break;
        }
      }
    } else {
      // Normal flow: search by plate number in column B
      const searchPlate = data.plateNumber.toString().trim().toUpperCase();

      for (let i = 1; i < vehicleData.length; i++) {
        const sheetPlateNumber = vehicleData[i][1]; // Plate Number is in column B (index 1)
        if (
          sheetPlateNumber &&
          sheetPlateNumber.toString().trim().toUpperCase() === searchPlate
        ) {
          vehicleRow = i;
          accessStatus = vehicleData[i][10] || "Access"; // Access Status is in column K (index 10)
          actualPlateNumber = vehicleData[i][1]; // Use the actual plate number from column B
          break;
        }
      }
    }

    // Fix corrupted driverId: If driverId is an action (IN/OUT), try to get it from vehicle data or use username
    if (actualDriverId === "IN" || actualDriverId === "OUT") {
      console.log(
        "Detected corrupted driverId (appears to be action):",
        actualDriverId
      );

      if (vehicleRow !== -1) {
        // Get current driver from vehicle sheet
        const currentDriverId = vehicleData[vehicleRow][8] || data.username || "Unknown";
        actualDriverId = getDriverNameById(currentDriverId);
        console.log("Using current driver from vehicle sheet:", actualDriverId);
      } else {
        // Fallback to username or Unknown
        actualDriverId = data.username || "Unknown";
        console.log("Using fallback driver ID:", actualDriverId);
      }
    }

    // Check if vehicle has access
    let oneTimePass = false;
    if (vehicleRow !== -1 && vehicleData[vehicleRow][11]) {
      oneTimePass = vehicleData[vehicleRow][11] === "Yes";
    }

    if (data.action === "IN" && accessStatus !== "Access") {
      // Check if one-time pass is enabled
      if (!oneTimePass) {
        throw new Error(`Vehicle access denied. Status: ${accessStatus}`);
      }
      // One-time pass is enabled, allow entry but we'll disable it after successful log
      console.log(
        `One-time pass detected for vehicle ${actualPlateNumber}. Allowing entry.`
      );
    }

    // Validate gate access and permissions using vehicle-specific gate restrictions
    let gateValidation;
    if (vehicleRow >= 0) {
      // Use vehicle-specific gate validation if vehicle found
      const vehicleId = vehicleData[vehicleRow][0];
      console.log(`Using vehicle-specific gate validation for vehicle ID: ${vehicleId}, plate: ${actualPlateNumber}, gate: ${data.gate} (type: ${typeof data.gate})`);
      gateValidation = validateVehicleGateAccess(vehicleId, actualPlateNumber, data.gate);
    } else {
      // Fallback to basic gate validation if vehicle not found
      console.log(`Vehicle not found, using basic gate validation`);
      gateValidation = validateGateAccess(data.gate, data.action, actualPlateNumber);
    }
    if (!gateValidation.allowed) {
      throw new Error(gateValidation.reason);
    }

    console.log("Final values for logging:", {
      plateNumber: actualPlateNumber,
      driverId: actualDriverId,
      action: data.action,
    });

    // Log the action without ID column to match current header structure
    logSheet.appendRow([
      new Date(),
      actualPlateNumber, // Use corrected plate number
      actualDriverId, // Use corrected driver ID
      data.action,
      data.gate,
      data.remarks || "",
      data.username || "System", // Use username passed from frontend
      accessStatus,
    ]);

    // Update vehicle status in column H (index 7, which is column 8 in spreadsheet)
    if (vehicleRow !== -1) {
      // Column H is at index 7 (0-based), but getRange uses 1-based indexing, so column H = 8
      console.log(
        `Updating vehicle status: row ${vehicleRow + 1}, column 8 (Status) to ${
          data.action
        }`
      );
      vehicleSheet.getRange(vehicleRow + 1, 8).setValue(data.action);

      // Also update the current driver in column I (index 8, column 9 in spreadsheet)
      if (actualDriverId && actualDriverId !== "Unknown") {
        console.log(
          `Updating current driver: row ${
            vehicleRow + 1
          }, column 9 (Current Driver) to ${actualDriverId}`
        );
        vehicleSheet.getRange(vehicleRow + 1, 9).setValue(actualDriverId);
      }

      // Disable one-time pass only when vehicle checks out
      if (oneTimePass && data.action === "OUT") {
        console.log(
          `Disabling one-time pass for vehicle ${actualPlateNumber} (action: ${data.action})`
        );
        vehicleSheet.getRange(vehicleRow + 1, 12).setValue("No"); // Column L (index 11, column 12)
      }

      // Force immediate update to spreadsheet
      SpreadsheetApp.flush();

      clearVehicleCache(); // Clear cache after status update
    } else {
      console.log("Warning: Vehicle not found in sheet, status not updated");
    }

    return {
      success: true,
      accessStatus: accessStatus,
      oneTimePassUsed:
        oneTimePass && (data.action === "IN" || data.action === "OUT"),
    };
  } catch (error) {
    console.error("Error logging vehicle action:", error);
    throw error;
  }
}

// User Login with password hashing simulation
function loginUser(username, password) {
  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);
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
      // Secure password verification with hashing
      // Username is at index 1, password at index 2, role at index 3, status at index 6 (after ID field)
      if (data[i][1] === username && verifyPassword(password, data[i][2])) {
        // Check user status (column G, index 6)
        const userStatus = data[i][6] || "active";
        if (userStatus !== "active") {
          // Log failed login attempt due to inactive status
          logUserActivity(username, "login", "failed - account " + userStatus);
          return {
            success: false,
            message: `Your account is currently: ${userStatus}`,
          };
        }

        // Log successful login
        logUserActivity(username, "login", "success");

        // Automatically set current user session for audit trail
        setCurrentUser(username, data[i][3] || "security");

        return {
          success: true,
          role: data[i][3] || "security",
          username: username,
        };
      }
    }

    // Log failed login attempt
    logUserActivity(username, "login", "failed");
    return { success: false };
  } catch (error) {
    console.error("Error during login:", error);
    return { success: false };
  }
}

// Update vehicle record with proper permission checking
function updateVehicleRecord(
  rowIndex,
  updatedData,
  userRole,
  currentUsername = "Unknown"
) {
  // Use new permission system instead of hardcoded role checks
  // Security users need updateDriver permission, others need update permission
  if (userRole === "security") {
    enforcePermission(
      userRole,
      "vehicles",
      "updateDriver",
      "Access denied: Cannot update vehicle driver"
    );
  } else {
    enforcePermission(
      userRole,
      "vehicles",
      "update",
      "Access denied: Cannot update vehicles"
    );
  }

  // Log the activity
  logUserActivity(currentUsername, userRole, "update", "vehicle", "attempting");

  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);

    // Security users cannot create new vehicles
    if (rowIndex === -1 && userRole === "security") {
      throw new Error("Security users cannot create new vehicles");
    }

    // If rowIndex is -1, it's a new vehicle (admin only)
    if (rowIndex === -1) {
      // Check if plate number already exists
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][1] === updatedData[1]) {
          // Compare plate numbers (column B, index 1)
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
          // Capture old data for audit trail
          const oldVehicleData = currentData[rowIndex].slice(); // Copy original data

          // Only update the driver field, keep everything else the same
          const currentVehicle = currentData[rowIndex];
          currentVehicle[8] = updatedData[8]; // Update only current driver field (Column I)

          // Note: Security users don't have audit trail access, but we could log this differently if needed
          // For now, only admin and super-admin get audit trail logging per requirements

          const range = sheet.getRange(
            rowIndex + 1,
            1,
            1,
            currentVehicle.length
          );
          range.setValues([currentVehicle]);
        } else {
          throw new Error("Invalid vehicle index");
        }
      } else {
        // Admin users can update all fields
        // Capture old data for audit trail
        const data = sheet.getDataRange().getValues();
        const oldVehicleData = data[rowIndex].slice(); // Copy original data

        // Check if plate number already exists (excluding current vehicle)
        for (let i = 1; i < data.length; i++) {
          if (i !== rowIndex && data[i][1] === updatedData[1]) {
            // Compare plate numbers (column B, index 1)
            throw new Error("Vehicle with this plate number already exists");
          }
        }

        // Log audit trail before updating (for super-admin and admin only)
        logVehicleAuditTrail(
          currentUsername,
          userRole,
          oldVehicleData,
          updatedData
        );

        // Debug: Log the updated data for admin users
        console.log("Admin updating vehicle with data length:", updatedData.length);
        console.log("Allowed gates in updated data (index 13):", updatedData[13]);
        
        const range = sheet.getRange(rowIndex + 1, 1, 1, updatedData.length);
        range.setValues([updatedData]);
      }
    }

    // Clear cache after successful update
    clearVehicleCache();

    return true;
  } catch (error) {
    console.error("Error updating vehicle:", error);
    throw error;
  }
}

// Super-admin only: delete vehicle record (legacy function - should be consolidated)
function deleteVehicleRecordLegacy(
  rowIndex,
  userRole,
  currentUsername = "Unknown"
) {
  // Use new permission system - only super-admin can delete vehicles
  enforcePermission(
    userRole,
    "vehicles",
    "delete",
    "Access denied: Only Super Admin can delete vehicles"
  );

  // Log the activity
  logUserActivity(currentUsername, userRole, "delete", "vehicle", "attempting");

  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
    sheet.deleteRow(rowIndex + 1);
    clearVehicleCache(); // Clear cache after delete
    return true;
  } catch (error) {
    console.error("Error deleting vehicle:", error);
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
      vehicleSheet
        .getRange(1, 1, 1, 14)
        .setValues([
          [
            "ID",
            "Plate Number",
            "Make/Model",
            "Color",
            "Department/Company",
            "Year",
            "Type",
            "Status",
            "Current Driver",
            "Assigned Drivers",
            "Access Status",
            "One Time Pass",
            "MV File",
            "Allowed Gates",
          ],
        ]);
      vehicleSheet.getRange(1, 1, 1, 14).setFontWeight("bold");

      // Format the sheet
      vehicleSheet.setFrozenRows(1);
      vehicleSheet.autoResizeColumns(1, 14);

      // Add data validation for Access Status
      const accessStatusRange = vehicleSheet.getRange(2, 11, 1000, 1);
      const accessRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(["Access", "No Access", "Banned"], true)
        .setAllowInvalid(false)
        .build();
      accessStatusRange.setDataValidation(accessRule);

      // Add conditional formatting for Access Status
      try {
        const accessRules = [
          SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo("Access")
            .setBackground("#d4edda")
            .setFontColor("#155724")
            .setRanges([accessStatusRange])
            .build(),
          SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo("No Access")
            .setBackground("#fff3cd")
            .setFontColor("#856404")
            .setRanges([accessStatusRange])
            .build(),
          SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo("Banned")
            .setBackground("#f8d7da")
            .setFontColor("#721c24")
            .setRanges([accessStatusRange])
            .build(),
        ];

        accessRules.forEach((rule) =>
          vehicleSheet.addConditionalFormatRule(rule)
        );
      } catch (formatError) {
        console.log(
          "Warning: Could not add conditional formatting:",
          formatError
        );
      }
    }

    // Create Driver Master sheet (simplified)
    let driverSheet = ss.getSheetByName(DRIVER_SHEET);
    if (!driverSheet) {
      driverSheet = ss.insertSheet(DRIVER_SHEET);
      driverSheet
        .getRange(1, 1, 1, 5)
        .setValues([["ID", "Name", "License Number", "Phone", "Status"]]);
      driverSheet.getRange(1, 1, 1, 5).setFontWeight("bold");
      driverSheet.setFrozenRows(1);
      driverSheet.autoResizeColumns(1, 5);

      // Add data validation for Driver Status
      const driverStatusRange = driverSheet.getRange(2, 5, 1000, 1);
      const driverStatusRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(["Active", "Inactive"], true)
        .setAllowInvalid(false)
        .build();
      driverStatusRange.setDataValidation(driverStatusRule);
    }

    // Create Logs sheet
    let logSheet = ss.getSheetByName(LOG_SHEET);
    if (!logSheet) {
      logSheet = ss.insertSheet(LOG_SHEET);
      logSheet
        .getRange(1, 1, 1, 9)
        .setValues([
          [
            "ID",
            "Timestamp",
            "Plate Number",
            "Driver Name",
            "Action",
            "Gate",
            "Remarks",
            "Logged By",
            "Access Status at Time",
          ],
        ]);
      logSheet.getRange(1, 1, 1, 9).setFontWeight("bold");
      logSheet.setFrozenRows(1);
      logSheet.autoResizeColumns(1, 9);

      // Format timestamp column
      const timestampRange = logSheet.getRange(2, 2, 1000, 1);
      timestampRange.setNumberFormat("yyyy-mm-dd hh:mm:ss");
    }

    // Create Users sheet
    let usersSheet = ss.getSheetByName(USERS_SHEET);
    if (!usersSheet) {
      usersSheet = ss.insertSheet(USERS_SHEET);
      usersSheet
        .getRange(1, 1, 1, 8)
        .setValues([
          [
            "ID",
            "Username",
            "Password",
            "Role",
            "Full Name",
            "Email",
            "Status",
            "Created Date",
          ],
        ]);
      usersSheet.getRange(1, 1, 1, 8).setFontWeight("bold");
      usersSheet.setFrozenRows(1);
      usersSheet.autoResizeColumns(1, 8);

      // Add data validation for Status (column 7)
      const statusRange = usersSheet.getRange(2, 7, 1000, 1);
      const statusRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(["active", "inactive", "suspended"], true)
        .setAllowInvalid(false)
        .build();
      statusRange.setDataValidation(statusRule);

      // Add data validation for Role (column 4)
      const roleRange = usersSheet.getRange(2, 4, 1000, 1);
      const roleRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(["super-admin", "admin", "security"], true)
        .setAllowInvalid(false)
        .build();
      roleRange.setDataValidation(roleRule);
    }

    // Create Gates sheet with Id/GateName structure
    let gatesSheet = ss.getSheetByName(GATES_SHEET);
    if (!gatesSheet) {
      gatesSheet = ss.insertSheet(GATES_SHEET);
      gatesSheet.getRange(1, 1, 1, 2).setValues([["Id", "GateName"]]);
      gatesSheet.getRange(1, 1, 1, 2).setFontWeight("bold");
      gatesSheet.setFrozenRows(1);
      gatesSheet.autoResizeColumns(1, 2);
    }

    return true;
  } catch (error) {
    console.error("Error creating initial sheets:", error);
    throw new Error("Failed to initialize spreadsheet structure");
  }
}

// Create default admin user
function createDefaultAdmin() {
  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);
    const existingData = sheet.getDataRange().getValues();

    // Check if admin already exists (check username at index 1)
    for (let i = 1; i < existingData.length; i++) {
      if (existingData[i][1] === "admin") {
        return;
      }
    }

    // Add default admin with ID field
    const userId = generateNextUserId();
    sheet.appendRow([
      userId, // ID
      "admin", // Username
      hashPassword("admin123"), // Password (hashed)
      "super-admin", // Role
      "System Administrator", // Full Name
      "admin@vehiclemonitoring.com", // Email
      "active", // Status
      new Date().toISOString(), // Created Date
    ]);
  } catch (error) {
    console.error("Error creating default admin:", error);
  }
}

// Reset admin user (for troubleshooting)
function resetAdminUser() {
  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);
    if (!sheet) {
      createInitialSheets();
    }

    const data = sheet.getDataRange().getValues();

    // Find and update admin user (username is now at index 1)
    let adminFound = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === "admin") {
        // Update the admin user row with ID field
        sheet.getRange(i + 1, 1, 1, 8).setValues([
          [
            data[i][0] || 1, // Keep existing ID or default to 1
            "admin", // Username
            hashPassword("admin123"), // Password (hashed)
            "super-admin", // Role
            "System Administrator", // Full Name
            "admin@vehiclemonitoring.com", // Email
            "active", // Status
            data[i][7] || new Date().toISOString(), // Keep existing created date or use current
          ],
        ]);
        adminFound = true;
        break;
      }
    }

    // If admin not found, create it with ID field
    if (!adminFound) {
      const userId = generateNextUserId();
      sheet.appendRow([
        userId, // ID
        "admin", // Username
        hashPassword("admin123"), // Password
        "super-admin", // Role
        "System Administrator", // Full Name
        "admin@vehiclemonitoring.com", // Email
        "active", // Status
        new Date().toISOString(), // Created Date
      ]);
    }

    return { success: true, message: "Admin user reset successfully" };
  } catch (error) {
    console.error("Error resetting admin user:", error);
    return { success: false, error: error.toString() };
  }
}

// Clean up existing plain text passwords in database
function cleanupPlainTextPasswords() {
  try {
    console.log("Starting cleanup of plain text passwords...");
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);
    if (!sheet) {
      return { success: false, error: "Users sheet not found" };
    }

    const data = sheet.getDataRange().getValues();
    let cleanedCount = 0;
    const issues = [];

    // Check each user row for plain text passwords
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const username = row[1]; // Username at index 1
      const password = row[2]; // Password at index 2

      if (!username || !password) continue;

      // Check if password is plain text (doesn't contain salt:hash format)
      if (!password.includes(":")) {
        console.log(`Found plain text password for user: ${username}`);

        // Check if it's a known default password
        if (password === "admin123" || password === "security123") {
          // Hash the password and update the cell
          const hashedPassword = hashPassword(password);
          sheet.getRange(i + 1, 3).setValue(hashedPassword); // Column C is password
          cleanedCount++;
          console.log(`Cleaned password for user: ${username}`);
        } else {
          // Unknown plain text password - log but don't change
          issues.push(
            `User ${username} has unknown plain text password: ${password}`
          );
          console.warn(
            `Unknown plain text password for user ${username}: ${password}`
          );
        }
      }
    }

    const result = {
      success: true,
      cleanedCount: cleanedCount,
      issues: issues,
      message: `Cleaned ${cleanedCount} plain text passwords. ${issues.length} issues found.`,
    };

    console.log("Password cleanup completed:", result);
    return result;
  } catch (error) {
    console.error("Error during password cleanup:", error);
    return { success: false, error: error.toString() };
  }
}

// Log user activity
function logUserActivity(username, action, result) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let activitySheet = ss.getSheetByName("UserActivity");

    if (!activitySheet) {
      activitySheet = ss.insertSheet("UserActivity");
      activitySheet
        .getRange(1, 1, 1, 5)
        .setValues([
          ["Timestamp", "Username", "Action", "Result", "IP Address"],
        ]);
      activitySheet.getRange(1, 1, 1, 5).setFontWeight("bold");
    }

    activitySheet.appendRow([
      new Date(),
      username,
      action,
      result,
      "N/A", // GAS doesn't provide IP addresses
    ]);
  } catch (error) {
    console.error("Error logging user activity:", error);
  }
}

// Get vehicle statistics
function getVehicleStatistics() {
  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
    if (!sheet) {
      return { total: 0, in: 0, out: 0, byType: {}, byDriver: {} };
    }

    const data = sheet.getDataRange().getValues();

    let stats = {
      total: 0,
      in: 0,
      out: 0,
      byType: {},
      byDriver: {},
    };

    for (let i = 1; i < data.length; i++) {
      if (!data[i] || data[i].length < 11) continue;

      stats.total++;
      const status = data[i][7] || "OUT"; // Status is at index 7
      const type = data[i][6] || "Unknown"; // Type is at index 6
      const driver = data[i][8] || "Unassigned"; // Current driver is at index 8

      if (status === "IN") {
        stats.in++;
      } else {
        stats.out++;
      }

      stats.byType[type] = (stats.byType[type] || 0) + 1;
      stats.byDriver[driver] = (stats.byDriver[driver] || 0) + 1;
    }

    return stats;
  } catch (error) {
    console.error("Error getting statistics:", error);
    return { total: 0, in: 0, out: 0, byType: {}, byDriver: {} };
  }
}

/**
 * Get database statistics for dashboard
 * Returns total registered vehicles, IN/OUT counts, and access status counts from VEHICLE_SHEET
 * @returns {Object} Database statistics object
 */
function getDatabaseStatistics() {
  try {
    console.log("Getting comprehensive database statistics...");

    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
    if (!sheet) {
      console.log("Vehicle sheet not found");
      return {
        totalRegistered: 0,
        totalIn: 0,
        totalOut: 0,
        accessCount: 0,
        noAccessCount: 0,
        bannedCount: 0,
        error: "Vehicle sheet not found",
      };
    }

    const data = sheet.getDataRange().getValues();
    console.log("Retrieved vehicle data:", data.length, "rows");

    // Total registered vehicles (total rows minus 1 for header)
    const totalRegistered = Math.max(0, data.length - 1);

    let totalIn = 0;
    let totalOut = 0;
    let accessCount = 0;
    let noAccessCount = 0;
    let bannedCount = 0;

    // Count both status and access status from database
    for (let i = 1; i < data.length; i++) {
      if (!data[i] || data[i].length < 11) continue;

      // Count IN and OUT statuses from column H (index 7)
      const status = (data[i][7] || "OUT").toString().toUpperCase().trim();
      if (status === "IN") {
        totalIn++;
      } else if (status === "OUT") {
        totalOut++;
      }

      // Count access statuses from column K (index 10)
      const accessStatus = (data[i][10] || "Access").toString().trim();
      if (accessStatus === "Access") {
        accessCount++;
      } else if (accessStatus === "No Access") {
        noAccessCount++;
      } else if (accessStatus === "Banned") {
        bannedCount++;
      }
    }

    const result = {
      totalRegistered,
      totalIn,
      totalOut,
      accessCount,
      noAccessCount,
      bannedCount,
      timestamp: new Date().toISOString(),
    };

    console.log("Comprehensive database statistics:", result);
    return result;
  } catch (error) {
    console.error("Error getting database statistics:", error);
    return {
      totalRegistered: 0,
      totalIn: 0,
      totalOut: 0,
      accessCount: 0,
      noAccessCount: 0,
      bannedCount: 0,
      error: "Failed to fetch database statistics: " + error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Get total registered vehicles count from VEHICLE_SHEET
 * @returns {number} Total number of registered vehicles
 */
function getTotalRegisteredVehicles() {
  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
    if (!sheet) {
      return 0;
    }

    const lastRow = sheet.getLastRow();
    return Math.max(0, lastRow - 1); // Subtract 1 for header row
  } catch (error) {
    console.error("Error getting total registered vehicles:", error);
    return 0;
  }
}

/**
 * Get vehicle status counts (IN/OUT) from VEHICLE_SHEET
 * @returns {Object} Object with totalIn and totalOut counts
 */
function getVehicleStatusCounts() {
  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
    if (!sheet) {
      return { totalIn: 0, totalOut: 0 };
    }

    const data = sheet.getDataRange().getValues();
    let totalIn = 0;
    let totalOut = 0;

    // Skip header row, start from row 2 (index 1)
    for (let i = 1; i < data.length; i++) {
      if (!data[i] || data[i].length < 8) continue;

      const status = (data[i][7] || "OUT").toString().toUpperCase().trim();

      if (status === "IN") {
        totalIn++;
      } else if (status === "OUT") {
        totalOut++;
      }
    }

    return { totalIn, totalOut };
  } catch (error) {
    console.error("Error getting vehicle status counts:", error);
    return { totalIn: 0, totalOut: 0 };
  }
}

/**
 * Get vehicle access status counts from VEHICLE_SHEET
 * Returns counts for Access, No Access, and Banned vehicles from column J (index 9)
 * @returns {Object} Object with accessCount, noAccessCount, and bannedCount
 */
function getVehicleAccessStatusCounts() {
  try {
    console.log("Getting vehicle access status counts...");

    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
    if (!sheet) {
      console.log("Vehicle sheet not found");
      return { accessCount: 0, noAccessCount: 0, bannedCount: 0 };
    }

    const data = sheet.getDataRange().getValues();
    console.log(
      "Retrieved vehicle data for access status:",
      data.length,
      "rows"
    );

    let accessCount = 0;
    let noAccessCount = 0;
    let bannedCount = 0;

    // Skip header row, start from row 2 (index 1)
    // Access status is in column J (index 9)
    for (let i = 1; i < data.length; i++) {
      if (!data[i] || data[i].length < 11) continue;

      const accessStatus = (data[i][9] || "Access").toString().trim();

      if (accessStatus === "Access") {
        accessCount++;
      } else if (accessStatus === "No Access") {
        noAccessCount++;
      } else if (accessStatus === "Banned") {
        bannedCount++;
      }
    }

    const result = { accessCount, noAccessCount, bannedCount };
    console.log("Access status counts:", result);
    return result;
  } catch (error) {
    console.error("Error getting vehicle access status counts:", error);
    return { accessCount: 0, noAccessCount: 0, bannedCount: 0 };
  }
}

/**
 * Get recent transactions from the LOG_SHEET
 * @param {number} limit - Number of records to fetch (default 50)
 * @returns {Array} Array of recent transaction objects
 */
// Helper function to convert gate ID to gate name
function getGateNameById(gateId) {
  try {
    if (!gateId) return gateId;
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const gateSheet = ss.getSheetByName(GATES_SHEET);
    
    if (!gateSheet) {
      return gateId; // Return ID if gate sheet not found
    }
    
    const gateData = gateSheet.getDataRange().getValues();
    
    // Find gate by ID
    for (let i = 1; i < gateData.length; i++) {
      const row = gateData[i];
      if (row[0] && row[0].toString() === gateId.toString()) {
        return row[1] || gateId; // Return gate name or fallback to ID
      }
    }
    
    return gateId; // Return ID if not found
  } catch (error) {
    console.error("Error getting gate name:", error);
    return gateId; // Return ID on error
  }
}

function getRecentTransactions(limit = 50) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(LOG_SHEET);

    if (!sheet) {
      console.log("Log sheet not found");
      return [];
    }

    const lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      return [];
    }

    // Calculate the starting row (we want the most recent records)
    const startRow = Math.max(2, lastRow - limit + 1);
    const numRows = lastRow - startRow + 1;

    // Get the data
    const range = sheet.getRange(startRow, 1, numRows, 8);
    const values = range.getValues();

    // Convert to array of objects and reverse to get most recent first
    const transactions = values
      .map((row, index) => ({
        timestamp: row[0]
          ? Utilities.formatDate(
              row[0],
              Session.getScriptTimeZone(),
              "yyyy-MM-dd HH:mm:ss"
            )
          : "",
        plate: row[1] || "",
        driver: row[2] || "",
        action: row[3] || "",
        gate: getGateNameById(row[4]) || "", // Convert gate ID to gate name
        remarks: row[5] || "",
        loggedBy: row[6] || "",
        accessStatus: row[7] || "Access", // Default to 'Access' if not specified
      }))
      .reverse();

    return transactions;
  } catch (error) {
    console.error("Error in getRecentTransactions:", error);
    return [];
  }
}

// Export logs to PDF (admin and super-admin)
function exportLogsToPDF(userRole, dateFrom, dateTo) {
  // Use new permission system
  enforcePermission(
    userRole,
    "system",
    "exportLogs",
    "Access denied: Cannot export logs"
  );

  // Log the activity
  logUserActivity("Unknown", userRole, "export", "logs", "attempting");

  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOG_SHEET);
    const data = sheet.getDataRange().getValues();

    // Filter by date range if provided
    const filteredData = data.filter((row, index) => {
      if (index === 0) return true; // Keep header
      const logDate = new Date(row[0]);
      return (
        (!dateFrom || logDate >= new Date(dateFrom)) &&
        (!dateTo || logDate <= new Date(dateTo))
      );
    });

    // Create a temporary sheet for export
    const tempSheet = SpreadsheetApp.create(
      "Vehicle Logs Export " + new Date().toISOString()
    );
    tempSheet
      .getActiveSheet()
      .getRange(1, 1, filteredData.length, filteredData[0].length)
      .setValues(filteredData);

    // Convert to PDF
    const pdf = tempSheet.getAs("application/pdf");

    // Clean up
    DriveApp.getFileById(tempSheet.getId()).setTrashed(true);

    return pdf.getBytes();
  } catch (error) {
    console.error("Error exporting logs:", error);
    throw new Error("Failed to export logs");
  }
}

/**
 * Get vehicle information by plate number for QR scanner
 * @param {string} plateNumber - Vehicle plate number to lookup
 * @returns {Object} Vehicle information object
 */
function getVehicleByPlate(plateNumber) {
  try {
    console.log("Looking up vehicle by plate:", plateNumber);

    // Sanitize input
    const cleanPlateNumber = sanitizeInput(plateNumber.trim().toUpperCase());

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const vehicleSheet = ss.getSheetByName(VEHICLE_SHEET);

    if (!vehicleSheet) {
      console.log("Vehicle sheet not found");
      return { found: false, message: "Vehicle database not available" };
    }

    const vehicleData = vehicleSheet.getDataRange().getValues();

    // Search for vehicle (skip header row)
    for (let i = 1; i < vehicleData.length; i++) {
      const row = vehicleData[i];
      const vehiclePlate = (row[1] || "").toString().trim().toUpperCase();

      if (vehiclePlate === cleanPlateNumber) {
        // Vehicle found - return details
        const vehicleInfo = {
          found: true,
          plateNumber: row[1] || "",
          makeModel: row[2] || "",
          color: row[3] || "",
          department: row[4] || "",
          year: row[5] || "",
          type: row[6] || "",
          currentStatus: row[7] || "OUT", // Column H - Current IN/OUT status
          currentDriver: row[8] || "",
          assignedDrivers: row[9] || "",
          accessStatus: row[10] || "Access", // Column K - Access Status
        };

        console.log("Vehicle found:", vehicleInfo);
        return vehicleInfo;
      }
    }

    // Vehicle not found
    console.log("Vehicle not found with plate:", cleanPlateNumber);
    return {
      found: false,
      message: `Vehicle with plate number "${cleanPlateNumber}" not found in database`,
    };
  } catch (error) {
    console.error("Error in getVehicleByPlate:", error);
    return {
      found: false,
      message: "Error looking up vehicle: " + error.toString(),
    };
  }
}

/**
 * Get vehicle information by vehicle ID for QR scanner
 * @param {string} vehicleId - Vehicle ID to lookup (handles both padded and unpadded)
 * @returns {Object} Vehicle information object
 */
function getVehicleById(vehicleId) {
  try {
    console.log("Looking up vehicle by ID:", vehicleId);

    // Sanitize input
    const cleanVehicleId = sanitizeInput(vehicleId.toString().trim());
    const paddedVehicleId = cleanVehicleId.padStart(6, "0");

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const vehicleSheet = ss.getSheetByName(VEHICLE_SHEET);

    if (!vehicleSheet) {
      console.log("Vehicle sheet not found");
      return { found: false, message: "Vehicle database not available" };
    }

    const vehicleData = vehicleSheet.getDataRange().getValues();

    // Search for vehicle (skip header row)
    for (let i = 1; i < vehicleData.length; i++) {
      const row = vehicleData[i];
      const vehicleIdInSheet = (row[0] || "").toString().trim();

      // Match both padded and unpadded IDs
      if (
        vehicleIdInSheet === cleanVehicleId ||
        vehicleIdInSheet === paddedVehicleId
      ) {
        // Vehicle found - return details
        const vehicleInfo = {
          found: true,
          vehicleId: row[0] || "",
          plateNumber: row[1] || "",
          makeModel: row[2] || "",
          color: row[3] || "",
          department: row[4] || "",
          year: row[5] || "",
          type: row[6] || "",
          currentStatus: row[7] || "OUT", // Column H - Current IN/OUT status
          currentDriver: row[8] || "",
          assignedDrivers: row[9] || "",
          accessStatus: row[10] || "Access", // Column K - Access Status
        };

        console.log("Vehicle found by ID:", vehicleInfo);
        return vehicleInfo;
      }
    }

    // Vehicle not found
    console.log("Vehicle not found with ID:", cleanVehicleId);
    return {
      found: false,
      message: `Vehicle with ID "${cleanVehicleId}" not found in database`,
    };
  } catch (error) {
    console.error("Error in getVehicleById:", error);
    return {
      found: false,
      message: "Error looking up vehicle: " + error.toString(),
    };
  }
}

// Debug function to check spreadsheet status
function debugSpreadsheetStatus() {
  try {
    console.log("=== Spreadsheet Debug Info ===");
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log("Spreadsheet name:", ss.getName());
    console.log("Spreadsheet ID:", ss.getId());

    const sheets = ss.getSheets();
    console.log(
      "Available sheets:",
      sheets.map((s) => s.getName())
    );

    // Check each required sheet
    const requiredSheets = [
      VEHICLE_SHEET,
      DRIVER_SHEET,
      LOG_SHEET,
      USERS_SHEET,
    ];
    requiredSheets.forEach((sheetName) => {
      const sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        const dataRange = sheet.getDataRange();
        console.log(
          `${sheetName}: ${dataRange.getNumRows()} rows, ${dataRange.getNumColumns()} columns`
        );
        if (dataRange.getNumRows() > 0) {
          console.log(`${sheetName} first row:`, dataRange.getValues()[0]);
        }
      } else {
        console.log(`${sheetName}: NOT FOUND`);
      }
    });

    return "Debug info logged to console";
  } catch (error) {
    console.error("Debug error:", error);
    return "Debug failed: " + error.message;
  }
}

/**
 * Clear all sample/mock data from the system (Super Admin only)
 * Keeps the headers and essential system data
 */
function clearSampleData(userRole) {
  // Use new permission system - only super-admin can clear data
  enforcePermission(
    userRole,
    "system",
    "clearData",
    "Access denied: Only Super Admin can clear system data"
  );

  // Log the activity
  logUserActivity("Unknown", userRole, "clear", "system_data", "attempting");

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // Clear vehicle sample data
    const vehicleSheet = ss.getSheetByName(VEHICLE_SHEET);
    if (vehicleSheet && vehicleSheet.getLastRow() > 1) {
      const numRows = vehicleSheet.getLastRow() - 1;
      vehicleSheet.deleteRows(2, numRows);
      console.log("Cleared vehicle sample data");
    }

    // Clear driver sample data
    const driverSheet = ss.getSheetByName(DRIVER_SHEET);
    if (driverSheet && driverSheet.getLastRow() > 1) {
      const numRows = driverSheet.getLastRow() - 1;
      driverSheet.deleteRows(2, numRows);
      console.log("Cleared driver sample data");
    }

    // Clear log data (all logs)
    const logSheet = ss.getSheetByName(LOG_SHEET);
    if (logSheet && logSheet.getLastRow() > 1) {
      const numRows = logSheet.getLastRow() - 1;
      logSheet.deleteRows(2, numRows);
      console.log("Cleared all log data");
    }

    // Keep default admin user but clear other sample users
    const usersSheet = ss.getSheetByName(USERS_SHEET);
    if (usersSheet && usersSheet.getLastRow() > 1) {
      const userData = usersSheet.getDataRange().getValues();
      const rowsToDelete = [];

      for (let i = userData.length - 1; i >= 1; i--) {
        // Keep admin user, delete sample users
        if (
          userData[i][0] !== "admin" &&
          (userData[i][0] === "user1" || userData[i][0] === "user2")
        ) {
          rowsToDelete.push(i + 1);
        }
      }

      // Delete rows from bottom to top to avoid index issues
      rowsToDelete.forEach((row) => {
        usersSheet.deleteRow(row);
      });
      console.log("Cleared sample users");
    }

    // Keep gates as they are usually configuration data

    // Clear cache
    clearVehicleCache();

    return {
      success: true,
      message:
        "Sample data cleared successfully. System is now ready for real data.",
    };
  } catch (error) {
    console.error("Error clearing sample data:", error);
    throw new Error("Failed to clear sample data: " + error.message);
  }
}

// Test function to verify spreadsheet access
function testSpreadsheetAccess() {
  try {
    console.log("Testing spreadsheet access...");
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log("Spreadsheet opened successfully:", ss.getName());

    const sheets = ss.getSheets();
    console.log(
      "Found sheets:",
      sheets.map((s) => s.getName())
    );

    return {
      success: true,
      spreadsheetName: ss.getName(),
      sheets: sheets.map((s) => s.getName()),
    };
  } catch (error) {
    console.error("Failed to access spreadsheet:", error);
    return {
      success: false,
      error: error.toString(),
    };
  }
}

// User Management Functions

// Migrate users with old roles to valid roles
function migrateUserRoles() {
  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);
    const data = sheet.getDataRange().getValues();
    const validRoles = ["super-admin", "admin", "security"];
    let migratedCount = 0;

    for (let i = 1; i < data.length; i++) {
      const currentRole = data[i][3]; // Role is at index 3

      // If role is not in valid roles, migrate it
      if (!validRoles.includes(currentRole)) {
        let newRole = "security"; // Default migration to security

        // Smart migration based on old role
        if (currentRole === "supervisor") {
          newRole = "admin"; // Supervisors become admins
        } else if (currentRole === "user") {
          newRole = "security"; // Users become security
        }

        // Update the role in the sheet
        sheet.getRange(i + 1, 4).setValue(newRole);
        migratedCount++;

        console.log(
          `Migrated user ${data[i][1]} from '${currentRole}' to '${newRole}'`
        );
      }
    }

    if (migratedCount > 0) {
      console.log(
        `Successfully migrated ${migratedCount} users to valid roles`
      );
    } else {
      console.log("No users needed role migration");
    }

    return { success: true, migratedCount: migratedCount };
  } catch (error) {
    console.error("Error migrating user roles:", error);
    throw error;
  }
}

// Get all users (super-admin and admin only)
function getUserList(userRole) {
  console.log("getUserList called with role:", userRole);

  // Use new permission system
  enforcePermission(
    userRole,
    "users",
    "read",
    "Access denied: Cannot view user list"
  );

  // Log the activity
  logUserActivity("Unknown", userRole, "read", "users", "attempting");

  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);

    if (!sheet) {
      console.log(
        "Users sheet not found, creating sheets and default admin..."
      );
      createInitialSheets();
      createDefaultAdmin();
      return getUserList(userRole);
    }

    const data = sheet.getDataRange().getValues();
    console.log("User data retrieved successfully:", data.length, "rows");

    // Auto-migrate users with invalid roles
    migrateUserRoles();

    // If only header row exists, create default admin
    if (data.length <= 1) {
      console.log("No users found, creating default admin...");
      createDefaultAdmin();
      // Re-fetch data after creating admin
      const updatedData = sheet.getDataRange().getValues();
      return updatedData;
    }

    return data;
  } catch (error) {
    console.error("Error getting user list:", error);
    return [
      [
        "ID",
        "Username",
        "Password",
        "Role",
        "Full Name",
        "Email",
        "Status",
        "Created Date",
      ],
    ];
  }
}

// Enhanced save user function (create or update)
function saveUser(userData, userRole, editIndex = -1) {
  console.log("saveUser called with:", {
    userData: userData.username,
    userRole,
    editIndex,
  });

  // Use new permission system
  const action = editIndex === -1 ? "create" : "update";
  enforcePermission(
    userRole,
    "users",
    action,
    `Access denied: Cannot ${action} users`
  );

  // Check if user can manage the target role
  if (!canManageRole(userRole, userData.role)) {
    throw new VehicleMonitoringError(
      `Access denied: Cannot assign role '${userData.role}'`,
      "ROLE_ASSIGNMENT_DENIED"
    );
  }

  // Log the activity
  logUserActivity(userData.username, userRole, action, "user", "attempting");

  try {
    // Enhanced validation
    validateRequired(userData.username, "Username");
    validateRequired(userData.role, "Role");
    validateRequired(userData.fullName, "Full Name");
    validateRequired(userData.email, "Email");

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      throw new Error("Invalid email format");
    }

    // Username validation (alphanumeric and underscore only)
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(userData.username)) {
      throw new Error(
        "Username can only contain letters, numbers, and underscores"
      );
    }

    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);
    const data = sheet.getDataRange().getValues();

    let isEditing = false;
    let targetRowIndex = -1;

    // For editing mode, use the provided index
    if (editIndex !== -1 && editIndex >= 1 && editIndex < data.length) {
      isEditing = true;
      targetRowIndex = editIndex;
      console.log("Edit mode detected for user at index:", editIndex);

      // For edits, check if username conflicts with OTHER users (exclude current user) - username is at index 1
      for (let i = 1; i < data.length; i++) {
        if (i !== editIndex && data[i][1] === userData.username) {
          throw new Error(
            "Username already exists. Please choose a different username."
          );
        }
      }
    } else {
      // For new users, check if username already exists - username is at index 1
      for (let i = 1; i < data.length; i++) {
        if (data[i][1] === userData.username) {
          throw new Error(
            "Username already exists. Please choose a different username."
          );
        }
      }
      console.log("New user mode - no conflicts found");
    }

    // Password validation
    if (!isEditing && !userData.password) {
      throw new Error("Password is required for new users");
    }

    if (userData.password && userData.password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    // Prepare user data with ID field
    const existingData = isEditing ? data[targetRowIndex] : [];
    let userRow;

    if (isEditing) {
      // Keep existing ID for updates
      userRow = [
        existingData[0], // ID (keep existing)
        sanitizeInput(userData.username), // Username
        userData.password
          ? hashPassword(userData.password)
          : existingData[2] || "", // Hash new password or keep existing
        userData.role, // Role
        sanitizeInput(userData.fullName), // Full Name
        sanitizeInput(userData.email), // Email
        userData.status || "active", // Status
        existingData[7] || new Date().toISOString(), // Keep original creation date for edits
      ];
    } else {
      // Generate new ID for new users
      const userId = generateNextUserId();
      userRow = [
        userId, // ID (auto-generated)
        sanitizeInput(userData.username), // Username
        hashPassword(userData.password), // Password (hashed)
        userData.role, // Role
        sanitizeInput(userData.fullName), // Full Name
        sanitizeInput(userData.email), // Email
        userData.status || "active", // Status
        new Date().toISOString(), // Created Date
      ];
    }

    if (isEditing) {
      // Update existing user
      const range = sheet.getRange(targetRowIndex + 1, 1, 1, userRow.length);
      range.setValues([userRow]);
      logUserActivity(userData.username, "user_updated", "success");
      console.log("User updated successfully:", userData.username);
    } else {
      // Create new user
      sheet.appendRow(userRow);
      logUserActivity(userData.username, "user_created", "success");
      console.log("User created successfully:", userData.username);
    }

    return {
      success: true,
      action: isEditing ? "updated" : "created",
      message: `User ${isEditing ? "updated" : "created"} successfully`,
    };
  } catch (error) {
    console.error("Error saving user:", error);
    logUserActivity(
      userData.username || "unknown",
      "user_save_failed",
      "error",
      error.message
    );
    return { success: false, error: error.message };
  }
}

// Enhanced delete user function (super-admin only)
function deleteUser(userIndex, userRole) {
  console.log("deleteUser called with index:", userIndex, "role:", userRole);

  // Use new permission system
  enforcePermission(
    userRole,
    "users",
    "delete",
    "Access denied: Only Super Admin can delete users"
  );

  // Log the activity
  logUserActivity("Unknown", userRole, "delete", "user", "attempting");

  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);
    const data = sheet.getDataRange().getValues();

    // Validate user index
    if (userIndex < 1 || userIndex >= data.length) {
      throw new Error("Invalid user index");
    }

    const user = data[userIndex];
    const username = user[1]; // Username is now at index 1 (after ID field)

    validateRequired(username, "Username");

    // Prevent deletion of default admin users
    if (username === "admin" || username === "jun") {
      throw new Error("Cannot delete system administrator accounts");
    }

    // Delete the user row
    sheet.deleteRow(userIndex + 1); // +1 because sheet rows are 1-indexed

    logUserActivity(username, "user_deleted", "success");
    console.log("User deleted successfully:", username);

    return { success: true, message: "User deleted successfully" };
  } catch (error) {
    console.error("Error deleting user:", error);
    logUserActivity("unknown", "user_delete_failed", "error", error.message);
    return { success: false, error: error.message };
  }
}

// Enhanced user activity logging
function logUserActivity(username, action, status, details = "") {
  try {
    // This could be expanded to log to a separate audit sheet
    console.log(
      `User Activity - Username: ${username}, Action: ${action}, Status: ${status}, Details: ${details}`
    );

    // Optional: Create audit log in a separate sheet
    // const auditSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("UserAuditLog");
    // if (auditSheet) {
    //   auditSheet.appendRow([new Date(), username, action, status, details]);
    // }
  } catch (error) {
    console.warn("Could not log user activity:", error);
  }
}

/**
 * Change user password with validation
 * @param {string} username - Username of the user changing password
 * @param {string} currentPassword - Current password for verification
 * @param {string} newPassword - New password to set
 * @param {string} confirmPassword - Confirmation of new password
 * @returns {Object} - Success/error result
 */
function changeUserPassword(
  username,
  currentPassword,
  newPassword,
  confirmPassword
) {
  console.log("changeUserPassword called for user:", username);

  try {
    // Input validation
    validateRequired(username, "Username");
    validateRequired(currentPassword, "Current password");
    validateRequired(newPassword, "New password");
    validateRequired(confirmPassword, "Confirm password");

    // Password strength validation
    if (newPassword.length < 6) {
      throw new VehicleMonitoringError(
        "New password must be at least 6 characters long",
        "PASSWORD_TOO_SHORT"
      );
    }

    // Check if new password and confirmation match
    if (newPassword !== confirmPassword) {
      throw new VehicleMonitoringError(
        "New password and confirmation do not match",
        "PASSWORD_MISMATCH"
      );
    }

    // Check if new password is different from current password
    if (newPassword === currentPassword) {
      throw new VehicleMonitoringError(
        "New password must be different from current password",
        "PASSWORD_SAME"
      );
    }

    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);
    if (!sheet) {
      throw new VehicleMonitoringError(
        "Users database not available",
        "DATABASE_ERROR"
      );
    }

    const data = sheet.getDataRange().getValues();
    let userFound = false;
    let userRowIndex = -1;

    // Find user and verify current password
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const dbUsername = row[1]; // Username is at index 1
      const dbPassword = row[2]; // Password is at index 2

      if (dbUsername === username) {
        userFound = true;
        userRowIndex = i;

        // Verify current password
        if (!verifyPassword(currentPassword, dbPassword)) {
          logUserActivity(
            username,
            "change_password",
            "failed",
            "incorrect_current_password"
          );
          throw new VehicleMonitoringError(
            "Current password is incorrect",
            "INVALID_CURRENT_PASSWORD"
          );
        }
        break;
      }
    }

    if (!userFound) {
      logUserActivity(username, "change_password", "failed", "user_not_found");
      throw new VehicleMonitoringError("User not found", "USER_NOT_FOUND");
    }

    // Hash the new password
    const hashedNewPassword = hashPassword(newPassword);

    // Update the password in the sheet
    sheet.getRange(userRowIndex + 1, 3).setValue(hashedNewPassword); // Column C (index 3) is password

    // Log successful password change
    logUserActivity(username, "change_password", "success", "password_updated");
    console.log("Password changed successfully for user:", username);

    return {
      success: true,
      message: "Password changed successfully",
    };
  } catch (error) {
    console.error("Error changing password:", error);

    // Log the failure with appropriate username
    const logUsername = username || "unknown";
    logUserActivity(
      logUsername,
      "change_password",
      "failed",
      error.message || error.toString()
    );

    return {
      success: false,
      error: error.message || "Failed to change password",
    };
  }
}

// Gate Management Functions - Simplified

// Get simple gate list compatible with existing structure
function getSimpleGateList() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(GATES_SHEET);

    if (!sheet) {
      createInitialSheets();
      sheet = ss.getSheetByName(GATES_SHEET);
    }

    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      // Return empty array if no gates
      return [];
    }

    // Convert raw data to simple objects
    const gates = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      gates.push({
        gateId: row[0],
        gateName: row[1]
      });
    }

    return gates;
  } catch (error) {
    console.error("Error getting simple gate list:", error);
    return [];
  }
}

// Get all gates (simple) - for backward compatibility
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
      // Return default gates if no data with Id/GateName structure
      return [["Id", "GateName"], [1, "Main Gate"], [2, "Service Gate"], [3, "Parking Gate"]];
    }

    return data;
  } catch (error) {
    console.error("Error getting gate list:", error);
    return [["Id", "GateName"], [1, "Main Gate"], [2, "Service Gate"]];
  }
}

// Simple gate creation function compatible with existing structure
function saveGateSimple(gateName, userRole, editIndex = -1) {
  // Validate user permissions
  const action = editIndex === -1 ? "create" : "update";
  enforcePermission(
    userRole,
    "gates",
    action,
    `Access denied: Cannot ${action} gates`
  );

  try {
    // Validate required fields
    if (!gateName || gateName.trim() === "") {
      throw new Error("Gate name is required");
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let gatesSheet = ss.getSheetByName(GATES_SHEET);
    
    // Ensure sheet exists with proper structure
    if (!gatesSheet) {
      createInitialSheets();
      gatesSheet = ss.getSheetByName(GATES_SHEET);
    }

    const data = gatesSheet.getDataRange().getValues();
    const cleanGateName = sanitizeInput(gateName.trim());
    
    // Check for duplicate gate names (excluding current edit)
    for (let i = 1; i < data.length; i++) {
      if (i !== editIndex && data[i][1] === cleanGateName) {
        throw new Error("Gate name already exists");
      }
    }

    if (editIndex > 0 && editIndex < data.length) {
      // Update existing gate - keep existing ID
      const gateId = data[editIndex][0];
      gatesSheet.getRange(editIndex + 1, 1, 1, 2).setValues([[gateId, cleanGateName]]);
      return { success: true, action: "updated", gateId: gateId };
    } else {
      // Create new gate with auto-generated ID
      const gateId = generateNextGateId();
      gatesSheet.appendRow([gateId, cleanGateName]);
      return { success: true, action: "created", gateId: gateId };
    }
  } catch (error) {
    console.error("Error saving gate:", error);
    throw error;
  }
}

// Legacy function for backward compatibility (simple - just name)
function saveGate(gateName, userRole, editIndex = -1) {
  // Use new permission system
  const action = editIndex === -1 ? "create" : "update";
  enforcePermission(
    userRole,
    "gates",
    action,
    `Access denied: Cannot ${action} gates`
  );

  // Log the activity
  logUserActivity("Unknown", userRole, action, "gate", "attempting");

  try {
    if (!gateName || gateName.trim() === "") {
      throw new Error("Gate name is required");
    }

    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(GATES_SHEET);
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
      return { success: true, action: "updated" };
    } else {
      // Create new gate
      sheet.appendRow([cleanGateName]);
      return { success: true, action: "created" };
    }
  } catch (error) {
    console.error("Error saving gate:", error);
    throw error;
  }
}

// Delete gate (simple)
function deleteGate(gateIndex, userRole) {
  // Use new permission system - only super-admin can delete gates
  enforcePermission(
    userRole,
    "gates",
    "delete",
    "Access denied: Only Super Admin can delete gates"
  );

  // Log the activity
  logUserActivity("Unknown", userRole, "delete", "gate", "attempting");

  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(GATES_SHEET);
    const data = sheet.getDataRange().getValues();

    if (gateIndex < 1 || gateIndex >= data.length) {
      throw new Error("Invalid gate index");
    }

    sheet.deleteRow(gateIndex + 1);
    return { success: true };
  } catch (error) {
    console.error("Error deleting gate:", error);
    throw error;
  }
}

// Driver Management Functions

/**
 * Get list of all active drivers for assignment dropdowns
 * @returns {Array} Array of driver objects with id, name, licenseNumber, and phone
 */
function getDriverList() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(DRIVER_SHEET);

    if (!sheet) {
      createInitialSheets();
      sheet = ss.getSheetByName(DRIVER_SHEET);
    }

    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      // No drivers found, return empty array
      return [];
    }

    const drivers = [];

    // Skip header row (index 0)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Only include active drivers
      const status = row[4] || "Active"; // Status is in column E (index 4)
      if (status === "Active") {
        drivers.push({
          id: String(row[0] || ""), // ID (column A) - Convert to string
          name: String(row[1] || ""), // Driver name (column B)
          licenseNumber: String(row[2] || ""), // License Number (column C)
          phone: String(row[3] || ""), // Phone (column D) - Convert to string
        });
      }
    }

    console.log(`Retrieved ${drivers.length} active drivers`);
    return drivers;
  } catch (error) {
    console.error("Error getting driver list:", error);
    return [];
  }
}

/**
 * Get list of all drivers including inactive ones (for vehicle edit dropdown)
 * @returns {Array} Array of all driver objects with status
 */
function getAllDriversIncludingInactive() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(DRIVER_SHEET);

    if (!sheet) {
      createInitialSheets();
      sheet = ss.getSheetByName(DRIVER_SHEET);
    }

    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      // No drivers found, return empty array
      return [];
    }

    const drivers = [];

    // Skip header row (index 0)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = row[4] || "Active"; // Status is in column E (index 4)
      
      drivers.push({
        id: String(row[0] || ""), // ID (column A) - Convert to string
        name: String(row[1] || ""), // Driver name (column B)
        licenseNumber: String(row[2] || ""), // License Number (column C)
        phone: String(row[3] || ""), // Phone (column D) - Convert to string
        status: status // Include status so frontend knows if inactive
      });
    }

    console.log(`Retrieved ${drivers.length} total drivers (including inactive)`);
    return drivers;
  } catch (error) {
    console.error("Error getting all drivers list:", error);
    return [];
  }
}

/**
 * Get driver name by driver ID
 * @param {string} driverId - The driver ID to lookup
 * @returns {string} Driver name or 'Unassigned' if not found
 */
function getDriverNameById(driverId) {
  if (!driverId || driverId === '') {
    return 'Unassigned';
  }
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(DRIVER_SHEET);

    if (!sheet) {
      return 'Unassigned';
    }

    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return 'Unassigned';
    }

    // Skip header row (index 0)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const currentDriverId = String(row[0] || ""); // ID (column A)
      
      if (currentDriverId === String(driverId)) {
        return String(row[1] || "Unassigned"); // Driver name (column B)
      }
    }

    return 'Unassigned';
  } catch (error) {
    console.error("Error getting driver name by ID:", error);
    return 'Unassigned';
  }
}

/**
 * Get list of all drivers for management (including inactive)
 * @returns {Array} Array of all driver objects
 */
function getDriverListForManagement() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(DRIVER_SHEET);

    if (!sheet) {
      createInitialSheets();
      sheet = ss.getSheetByName(DRIVER_SHEET);
    }

    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return [];
    }

    const drivers = [];

    // Skip header row (index 0)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue; // Skip empty rows

      drivers.push({
        id: row[0] || "", // ID (column A)
        name: String(row[1] || ""), // Driver name (column B)
        licenseNumber: String(row[2] || ""), // License Number (column C)
        phone: String(row[3] || ""), // Phone (column D) - Convert to string
        status: String(row[4] || "Active"), // Status (column E)
      });
    }

    console.log(`Retrieved ${drivers.length} total drivers`);
    return drivers;
  } catch (error) {
    console.error("Error getting driver list for management:", error);
    return [];
  }
}

/**
 * Generate next driver ID
 * @returns {number} Next sequential driver ID
 */
function generateNextDriverId() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DRIVER_SHEET);

    if (!sheet) {
      return 1;
    }

    const data = sheet.getDataRange().getValues();
    let maxId = 0;

    // Find the highest ID
    for (let i = 1; i < data.length; i++) {
      const id = parseInt(data[i][0]) || 0;
      if (id > maxId) {
        maxId = id;
      }
    }

    return maxId + 1;
  } catch (error) {
    console.error("Error generating driver ID:", error);
    return 1;
  }
}

/**
 * Save new driver record
 * @param {Object} driverData - Driver data object
 * @returns {Object} Success status and message
 */
function saveDriverRecord(driverData) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(DRIVER_SHEET);

    if (!sheet) {
      createInitialSheets();
      sheet = ss.getSheetByName(DRIVER_SHEET);
    }

    // Check if driver with same license number already exists
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === driverData.licenseNumber) {
        return {
          success: false,
          error: "Driver with this license number already exists",
        };
      }
    }

    // Generate new ID
    const newId = generateNextDriverId();

    // Add new driver
    sheet.appendRow([
      newId,
      driverData.name || "",
      driverData.licenseNumber || "",
      driverData.phone || "",
      driverData.status || "Active",
    ]);

    console.log(`Added new driver: ${driverData.name} (ID: ${newId})`);
    return {
      success: true,
      message: "Driver added successfully",
      id: newId,
    };
  } catch (error) {
    console.error("Error saving driver:", error);
    return {
      success: false,
      error: error.toString(),
    };
  }
}

/**
 * Update existing driver record
 * @param {number} driverId - Driver ID to update
 * @param {Object} driverData - Updated driver data
 * @returns {Object} Success status and message
 */
function updateDriverRecord(driverId, driverData) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DRIVER_SHEET);

    if (!sheet) {
      return {
        success: false,
        error: "Driver sheet not found",
      };
    }

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;

    // Find the driver row
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == driverId) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      return {
        success: false,
        error: "Driver not found",
      };
    }

    // Check if new license number conflicts with another driver
    for (let i = 1; i < data.length; i++) {
      if (i !== rowIndex && data[i][2] === driverData.licenseNumber) {
        return {
          success: false,
          error: "Another driver with this license number already exists",
        };
      }
    }

    // Update the driver data
    sheet
      .getRange(rowIndex + 1, 1, 1, 5)
      .setValues([
        [
          driverId,
          driverData.name || "",
          driverData.licenseNumber || "",
          driverData.phone || "",
          driverData.status || "Active",
        ],
      ]);

    console.log(`Updated driver: ${driverData.name} (ID: ${driverId})`);
    return {
      success: true,
      message: "Driver updated successfully",
    };
  } catch (error) {
    console.error("Error updating driver:", error);
    return {
      success: false,
      error: error.toString(),
    };
  }
}

/**
 * Delete driver record
 * @param {number} driverId - Driver ID to delete
 * @returns {Object} Success status and message
 */
function deleteDriverRecord(driverId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DRIVER_SHEET);

    if (!sheet) {
      return {
        success: false,
        error: "Driver sheet not found",
      };
    }

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;

    // Find the driver row
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == driverId) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      return {
        success: false,
        error: "Driver not found",
      };
    }

    // Delete the row
    sheet.deleteRow(rowIndex + 1);

    console.log(`Deleted driver with ID: ${driverId}`);
    return {
      success: true,
      message: "Driver deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting driver:", error);
    return {
      success: false,
      error: error.toString(),
    };
  }
}

// Diagnostic function to check user data
function checkUserData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(USERS_SHEET);

    if (!sheet) {
      return {
        error: "Users sheet not found",
        action: "Creating sheets and default admin...",
      };
    }

    const data = sheet.getDataRange().getValues();
    const users = [];

    for (let i = 0; i < data.length; i++) {
      users.push({
        row: i + 1,
        username: data[i][0] || "empty",
        role: data[i][2] || "empty",
        status: data[i][5] || "empty",
      });
    }

    return {
      totalRows: data.length,
      users: users,
      hasAdmin: users.some(
        (u) => u.username === "admin" && u.role === "super-admin"
      ),
    };
  } catch (error) {
    return {
      error: error.toString(),
    };
  }
}

// Force refresh users and ensure default admin exists
function forceRefreshUsers() {
  try {
    console.log("Force refreshing users...");
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(USERS_SHEET);

    if (!sheet) {
      console.log("Users sheet not found, creating...");
      createInitialSheets();
      sheet = ss.getSheetByName(USERS_SHEET);
    }

    const data = sheet.getDataRange().getValues();
    console.log("Current user data rows:", data.length);

    // Check if we have header row
    if (data.length === 0) {
      console.log("No data at all, adding header...");
      sheet
        .getRange(1, 1, 1, 7)
        .setValues([
          [
            "Username",
            "Password",
            "Role",
            "Full Name",
            "Email",
            "Status",
            "Created Date",
          ],
        ]);
    }

    // Ensure default admin exists
    let adminFound = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === "admin") {
        adminFound = true;
        console.log("Admin found at row:", i + 1);
        break;
      }
    }

    if (!adminFound) {
      console.log("Admin not found, creating default admin...");
      createDefaultAdmin();
    }

    // Return the current data
    const finalData = sheet.getDataRange().getValues();
    console.log("Final user data rows:", finalData.length);

    return {
      success: true,
      message: `Users refreshed. Total rows: ${finalData.length}`,
      data: finalData,
    };
  } catch (error) {
    console.error("Error in forceRefreshUsers:", error);
    return {
      success: false,
      error: error.toString(),
    };
  }
}

// Normalize and clean up user data
function normalizeUserData() {
  try {
    console.log("Normalizing user data...");
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(USERS_SHEET);

    if (!sheet) {
      return { error: "Users sheet not found" };
    }

    const data = sheet.getDataRange().getValues();
    const normalizedData = [];
    const issues = [];

    // Keep header
    normalizedData.push(data[0]);

    // Process each user row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue; // Skip empty rows

      // Normalize each field
      const normalizedRow = [
        row[0] || "", // Username
        row[1] || "", // Password
        row[2] || "security", // Role (default to security)
        row[3] || row[0], // Full Name (default to username)
        row[4] || `${row[0]}@vehiclemonitoring.com`, // Email (generate if missing)
        row[5] || "active", // Status (default to active)
        row[6] || new Date().toISOString(), // Created Date
      ];

      // Check for issues
      if (!row[3])
        issues.push(`Row ${i + 1}: Missing Full Name for user ${row[0]}`);
      if (!row[4])
        issues.push(`Row ${i + 1}: Missing Email for user ${row[0]}`);

      normalizedData.push(normalizedRow);
    }

    // Update the sheet with normalized data
    if (normalizedData.length > 1) {
      sheet.clear();
      sheet
        .getRange(1, 1, normalizedData.length, normalizedData[0].length)
        .setValues(normalizedData);
    }

    return {
      success: true,
      rowsProcessed: normalizedData.length - 1,
      issues: issues,
      message: `Normalized ${normalizedData.length - 1} users`,
    };
  } catch (error) {
    console.error("Error normalizing user data:", error);
    return {
      success: false,
      error: error.toString(),
    };
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
          id: data[i][0].toString(),  // Gate ID (column A) - ensure string
          name: data[i][1] || data[i][0],  // Gate Name (column B) with fallback to ID
        });
      }
    }

    return gates.length > 0
      ? gates
      : [
          { id: "1", name: "Main Gate" },
          { id: "2", name: "Back Gate" },
        ];
  } catch (error) {
    console.error("Error getting active gates:", error);
    return [
      { id: "1", name: "Main Gate" },
      { id: "2", name: "Back Gate" },
    ];
  }
}

// Enhanced gate access validation with restrictions
function validateGateAccessWithRestrictions(gateId, vehicleId, plateNumber, action = "ENTRY") {
  try {
    const gates = getEnhancedGateList();
    
    if (gates.length === 0) {
      // No gates configured - allow access for backward compatibility
      return {
        allowed: true,
        reason: "No gate restrictions configured",
        requiresOverride: false
      };
    }

    // Find the specific gate
    const gate = gates.find(g => g.gateId == gateId || g.gateName === gateId);
    
    if (!gate) {
      return {
        allowed: false,
        reason: "Gate not found",
        requiresOverride: true
      };
    }

    // Check if gate is active
    if (gate.status !== "Active") {
      return {
        allowed: false,
        reason: `Gate is ${gate.status}`,
        requiresOverride: true
      };
    }

    // Check restriction type
    switch (gate.restrictionType) {
      case "Open Access":
        // Check time restrictions if any
        if (Object.keys(gate.timeRestrictions).length > 0) {
          const timeCheck = validateTimeRestrictions(gate.timeRestrictions);
          if (!timeCheck.allowed) {
            return {
              allowed: false,
              reason: timeCheck.reason,
              requiresOverride: true
            };
          }
        }
        return {
          allowed: true,
          reason: "Open access gate",
          requiresOverride: false
        };

      case "Restricted Access":
        // Check if vehicle is in allowed list
        const isVehicleAllowed = gate.allowedVehicles.includes(vehicleId) || 
                                gate.allowedVehicles.includes(plateNumber);
        
        if (!isVehicleAllowed) {
          return {
            allowed: false,
            reason: "Vehicle not authorized for this gate",
            requiresOverride: true
          };
        }

        // Check time restrictions
        if (Object.keys(gate.timeRestrictions).length > 0) {
          const timeCheck = validateTimeRestrictions(gate.timeRestrictions);
          if (!timeCheck.allowed) {
            return {
              allowed: false,
              reason: timeCheck.reason,
              requiresOverride: true
            };
          }
        }

        return {
          allowed: true,
          reason: "Vehicle authorized for restricted gate",
          requiresOverride: false
        };

      case "Invitation Only":
        // Always requires manual approval
        return {
          allowed: false,
          reason: "Invitation-only gate requires manual approval",
          requiresOverride: true
        };

      default:
        return {
          allowed: false,
          reason: "Unknown restriction type",
          requiresOverride: true
        };
    }
  } catch (error) {
    console.error("Error validating gate access:", error);
    return {
      allowed: false,
      reason: "Error during validation: " + error.message,
      requiresOverride: true
    };
  }
}

// Helper function to validate time restrictions
function validateTimeRestrictions(timeRestrictions) {
  try {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes since midnight

    // Check daily restrictions
    if (timeRestrictions.dailyHours) {
      const { startTime, endTime } = timeRestrictions.dailyHours;
      const startMinutes = convertTimeToMinutes(startTime);
      const endMinutes = convertTimeToMinutes(endTime);

      if (currentTime < startMinutes || currentTime > endMinutes) {
        return {
          allowed: false,
          reason: `Gate access restricted outside hours: ${startTime} - ${endTime}`
        };
      }
    }

    // Check day-specific restrictions
    if (timeRestrictions.weeklySchedule && timeRestrictions.weeklySchedule[currentDay]) {
      const daySchedule = timeRestrictions.weeklySchedule[currentDay];
      if (!daySchedule.enabled) {
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        return {
          allowed: false,
          reason: `Gate access not allowed on ${dayNames[currentDay]}`
        };
      }

      if (daySchedule.startTime && daySchedule.endTime) {
        const startMinutes = convertTimeToMinutes(daySchedule.startTime);
        const endMinutes = convertTimeToMinutes(daySchedule.endTime);

        if (currentTime < startMinutes || currentTime > endMinutes) {
          return {
            allowed: false,
            reason: `Gate access restricted on this day. Allowed: ${daySchedule.startTime} - ${daySchedule.endTime}`
          };
        }
      }
    }

    return { allowed: true, reason: "Within allowed time restrictions" };
  } catch (error) {
    console.error("Error validating time restrictions:", error);
    return { allowed: true, reason: "Time validation bypassed due to error" };
  }
}

// Helper function to convert time string to minutes
function convertTimeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

// Validate if vehicle is allowed at specific gate
function validateVehicleGateAccess(vehicleId, plateNumber, gateId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const vehicleSheet = ss.getSheetByName(VEHICLE_SHEET);
    
    if (!vehicleSheet) {
      return {
        allowed: false,
        reason: "Vehicle database not found",
        requiresOverride: true
      };
    }

    const vehicleData = vehicleSheet.getDataRange().getValues();
    let vehicleRow = null;

    // Find vehicle by ID or plate number
    for (let i = 1; i < vehicleData.length; i++) {
      const row = vehicleData[i];
      if (row[0] == vehicleId || row[1] === plateNumber) {
        vehicleRow = row;
        break;
      }
    }

    if (!vehicleRow) {
      return {
        allowed: false,
        reason: "Vehicle not found in database",
        requiresOverride: true
      };
    }

    // Check vehicle access status first
    const accessStatus = vehicleRow[10]; // Access Status column (K)
    if (accessStatus === "Banned") {
      return {
        allowed: false,
        reason: "Vehicle is banned from all gates",
        requiresOverride: false // Cannot be overridden
      };
    }

    if (accessStatus === "No Access") {
      // Check for one-time pass
      const oneTimePass = vehicleRow[11]; // One Time Pass column (L)
      if (oneTimePass !== "Yes") {
        return {
          allowed: false,
          reason: "Vehicle has no access. One-time pass required",
          requiresOverride: true
        };
      }
    }

    // Check gate restrictions (column N, index 13) - now stores gate IDs
    const allowedGates = vehicleRow[13]; // Allowed Gates column (N)
    
    if (!allowedGates || allowedGates.trim() === "") {
      // No gate restrictions - allow access to all gates
      return {
        allowed: true,
        reason: "No gate restrictions configured for this vehicle",
        requiresOverride: false
      };
    }

    // Parse allowed gate IDs (comma-separated)
    const allowedGateIds = allowedGates.split(',').map(gateId => gateId.trim());
    
    // Debug logging for gate validation
    console.log(`=== GATE VALIDATION DEBUG ===`);
    console.log(`Vehicle: ${plateNumber} (ID: ${vehicleId})`);
    console.log(`Raw allowed gates: "${allowedGates}" (type: ${typeof allowedGates})`);
    console.log(`Parsed allowed gate IDs:`, allowedGateIds);
    console.log(`Current gate ID: "${gateId}" (type: ${typeof gateId})`);
    
    // Check if current gate ID is in allowed list
    // Convert both to strings for reliable comparison
    const currentGateIdStr = gateId.toString().trim();
    console.log(`Current gate ID converted to string: "${currentGateIdStr}"`);
    
    // Log each comparison
    const comparisonResults = allowedGateIds.map(allowedGateId => {
      const allowedGateIdStr = allowedGateId.toString().trim();
      const exactMatch = allowedGateIdStr === currentGateIdStr;
      const caseInsensitiveMatch = allowedGateIdStr.toLowerCase() === currentGateIdStr.toLowerCase();
      console.log(`Comparing "${allowedGateIdStr}" with "${currentGateIdStr}": exact=${exactMatch}, caseInsensitive=${caseInsensitiveMatch}`);
      return exactMatch || caseInsensitiveMatch;
    });
    
    const isGateAllowed = comparisonResults.some(result => result);
    
    console.log(`Individual comparison results:`, comparisonResults);
    console.log(`Final gate validation result: ${isGateAllowed}`);

    if (!isGateAllowed) {
      // Get gate names for user-friendly error message
      const gateSheet = ss.getSheetByName(GATES_SHEET);
      let allowedGateNames = allowedGateIds;
      
      if (gateSheet) {
        try {
          const gateData = gateSheet.getDataRange().getValues();
          allowedGateNames = allowedGateIds.map(allowedId => {
            for (let i = 1; i < gateData.length; i++) {
              if (gateData[i][0].toString() === allowedId) {
                return `${allowedId}: ${gateData[i][1]}`;
              }
            }
            return allowedId; // Fallback to ID if name not found
          });
        } catch (error) {
          console.error("Error getting gate names for error message:", error);
        }
      }
      
      return {
        allowed: false,
        reason: `Vehicle not authorized for gate ID "${gateId}". Allowed gates: ${allowedGateNames.join(', ')}`,
        requiresOverride: true,
        allowedGates: allowedGateIds
      };
    }

    return {
      allowed: true,
      reason: `Vehicle authorized for gate: ${gateId}`,
      requiresOverride: false
    };

  } catch (error) {
    console.error("Error validating vehicle gate access:", error);
    return {
      allowed: false,
      reason: "Error during gate validation: " + error.message,
      requiresOverride: true
    };
  }
}

// Legacy function for backward compatibility (simplified)
function validateGateAccess(gateId, action, plateNumber) {
  try {
    const gateSheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(GATES_SHEET);

    if (!gateSheet) {
      // If no gates sheet exists, allow access (backward compatibility)
      return {
        allowed: true,
        reason: "Gate validation bypassed - no gate configuration",
      };
    }

    // Check if gateId is provided
    if (!gateId || gateId === "") {
      return { allowed: false, reason: "No gate selected" };
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
      return { allowed: false, reason: "Vehicle not authorized for this gate." };
    }

    // For simplified gate system, all valid gates are considered active
    // and allow both entry and exit

    // Log the gate usage for tracking
    console.log(
      `Vehicle ${plateNumber} attempting ${action} at gate: ${gateId}`
    );

    // All validation passed
    return { allowed: true, reason: "Access granted" };
  } catch (error) {
    console.error("Error validating gate access:", error);
    // On error, allow access but log the issue
    return {
      allowed: true,
      reason: "Gate validation error - access granted by default",
    };
  }
}

// Get gate statistics
function getGateStatistics() {
  try {
    console.log("getGateStatistics called");
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const gateSheet = ss.getSheetByName(GATES_SHEET);
    const logSheet = ss.getSheetByName(LOG_SHEET);

    if (!gateSheet) {
      console.log("No gates sheet found");
      return {
        totalGates: 0,
        activeGates: 0,
        usageToday: {},
        busyGates: [],
        error: "No gates configured",
      };
    }

    const gateData = gateSheet.getDataRange().getValues();
    console.log("Gate data length:", gateData.length);

    // Count gates (simplified - all gates are considered active)
    let totalGates = Math.max(0, gateData.length - 1); // Exclude header
    let activeGates = totalGates; // In simplified system, all gates are active

    let usageToday = {};
    let busyGates = [];

    if (logSheet) {
      try {
        const logData = logSheet.getDataRange().getValues();
        console.log("Log data length:", logData.length);

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
        console.error("Error processing log data:", logError);
      }
    }

    const result = {
      totalGates,
      activeGates,
      usageToday,
      busyGates,
    };

    console.log("Gate statistics result:", result);
    return result;
  } catch (error) {
    console.error("Error getting gate statistics:", error);
    return {
      totalGates: 0,
      activeGates: 0,
      usageToday: {},
      busyGates: [],
      error: error.message,
    };
  }
}

// Get gate activity report
function getGateActivityReport(gateId, dateFrom, dateTo) {
  try {
    const logSheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOG_SHEET);
    if (!logSheet) {
      return { error: "No activity logs found" };
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
        accessStatus: logEntry[7],
      });
    }

    // Calculate summary statistics
    const summary = {
      totalActivities: activities.length,
      entriesCount: activities.filter((a) => a.action === "IN").length,
      exitsCount: activities.filter((a) => a.action === "OUT").length,
      uniqueVehicles: [...new Set(activities.map((a) => a.plateNumber))].length,
      uniqueDrivers: [...new Set(activities.map((a) => a.driverId))].length,
      accessDeniedCount: activities.filter(
        (a) => a.accessStatus && a.accessStatus !== "Access"
      ).length,
    };

    // Group by hour for activity patterns
    const hourlyActivity = {};
    activities.forEach((activity) => {
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
        to: toDate?.toISOString() || null,
      },
    };
  } catch (error) {
    console.error("Error generating gate activity report:", error);
    return { error: "Failed to generate report: " + error.message };
  }
}

// Get today's activity count from InOutLogs
function getTodayActivityCount() {
  try {
    const logSheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOG_SHEET);

    if (!logSheet) {
      console.log("Log sheet not found");
      return { count: 0, error: "Log sheet not found" };
    }

    const logData = logSheet.getDataRange().getValues();

    // Set today's date boundary (start of today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let todayCount = 0;

    // Loop through log data starting from row 1 (skip header)
    for (let i = 1; i < logData.length; i++) {
      if (logData[i] && logData[i][0]) {
        // Check if row exists and has timestamp
        const logDate = new Date(logData[i][0]); // Column A (index 0) is timestamp

        // Check if log entry is from today
        if (logDate >= today) {
          todayCount++;
        }
      }
    }

    console.log(`Today's activity count: ${todayCount}`);
    return { count: todayCount, success: true };
  } catch (error) {
    console.error("Error getting today's activity count:", error);
    return { count: 0, error: error.message };
  }
}

// Get comprehensive gate usage analytics
function getGateAnalytics() {
  try {
    const gateSheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(GATES_SHEET);
    const logSheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOG_SHEET);

    if (!gateSheet || !logSheet) {
      return { error: "Required sheets not found" };
    }

    const gateData = gateSheet.getDataRange().getValues();
    const logData = logSheet.getDataRange().getValues();

    // Calculate analytics for each gate
    const gateAnalytics = [];

    for (let i = 1; i < gateData.length; i++) {
      const gate = gateData[i];
      const gateId = gate[0];

      // Count activities for this gate
      const gateActivities = logData.filter((log) => log[4] === gateId);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayActivities = gateActivities.filter((log) => {
        const logDate = new Date(log[0]);
        return logDate >= today;
      });

      const thisWeek = new Date();
      thisWeek.setDate(thisWeek.getDate() - 7);

      const weekActivities = gateActivities.filter((log) => {
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
          accessLevel: gate[5],
        },
        usage: {
          totalActivities: gateActivities.length,
          todayActivities: todayActivities.length,
          weekActivities: weekActivities.length,
          entriesTotal: gateActivities.filter((log) => log[3] === "IN").length,
          exitsTotal: gateActivities.filter((log) => log[3] === "OUT").length,
          lastActivity:
            gateActivities.length > 0
              ? gateActivities[gateActivities.length - 1][0]
              : null,
        },
      });
    }

    // Sort by activity level
    gateAnalytics.sort(
      (a, b) => b.usage.totalActivities - a.usage.totalActivities
    );

    return {
      success: true,
      analytics: gateAnalytics,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error generating gate analytics:", error);
    return { error: "Failed to generate analytics: " + error.message };
  }
}

// Create sample data for initial setup
function createSampleData() {
  try {
    console.log("Creating sample data...");

    // Ensure sheets exist first
    createInitialSheets();

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // Add sample vehicles
    const vehicleSheet = ss.getSheetByName(VEHICLE_SHEET);
    if (!vehicleSheet) {
      throw new Error("Vehicle sheet not found after creation");
    }

    let vehicleData;
    try {
      vehicleData = vehicleSheet.getDataRange().getValues();
    } catch (e) {
      console.log("Error getting vehicle data range, sheet may be empty");
      vehicleData = [];
    }

    console.log("Current vehicle data length:", vehicleData.length);

    if (vehicleData.length <= 1) {
      console.log("Adding sample vehicles...");
      const sampleVehicles = [
        [
          "000001",
          "ABC-123",
          "Toyota Camry",
          "White",
          "IT Department",
          "2022",
          "Car",
          "OUT",
          "DRV001",
          "DRV001,DRV002",
          "Access",
          "No",
          "MV-2022-001",
          "1,2", // Allowed Gates: Main Gate and Service Gate
        ],
        [
          "000002",
          "XYZ-456",
          "Honda Civic",
          "Blue",
          "HR Department",
          "2021",
          "Car",
          "IN",
          "DRV002",
          "DRV002,DRV003",
          "Access",
          "No",
          "MV-2021-456",
          "", // No gate restrictions - can access all gates
        ],
        [
          "000003",
          "MNO-789",
          "Ford F-150",
          "Red",
          "Operations",
          "2020",
          "Truck",
          "OUT",
          "DRV003",
          "DRV003,DRV004",
          "No Access",
          "Yes",
          "MV-2020-789",
          "2", // Restricted to Service Gate only
        ],
        [
          "000004",
          "PQR-012",
          "Chevrolet Express",
          "Silver",
          "Logistics",
          "2019",
          "Van",
          "OUT",
          "DRV004",
          "DRV004,DRV005",
          "Banned",
          "No",
          "MV-2019-012",
          "", // Banned vehicles have no gate access regardless
        ],
        [
          "000005",
          "STU-345",
          "Tesla Model 3",
          "Black",
          "Executive",
          "2023",
          "Car",
          "IN",
          "DRV005",
          "DRV005,DRV001",
          "Access",
          "No",
          "MV-2023-345",
          "1", // Executive vehicle restricted to Main Gate only
        ],
      ];

      // Optimized: Use batch setValues instead of individual appendRow operations
      const startRow = vehicleSheet.getLastRow() + 1;
      const range = vehicleSheet.getRange(
        startRow,
        1,
        sampleVehicles.length,
        sampleVehicles[0].length
      );
      range.setValues(sampleVehicles);
      console.log("Sample vehicles added successfully via batch operation");
    }

    // Add sample drivers
    const driverSheet = ss.getSheetByName(DRIVER_SHEET);
    if (!driverSheet) {
      throw new Error("Driver sheet not found after creation");
    }

    let driverData;
    try {
      driverData = driverSheet.getDataRange().getValues();
    } catch (e) {
      console.log("Error getting driver data range, sheet may be empty");
      driverData = [];
    }

    console.log("Current driver data length:", driverData.length);

    if (driverData.length <= 1) {
      console.log("Adding sample drivers...");
      const sampleDrivers = [
        [
          "000001",
          "DRV001",
          "John Doe",
          "LIC001",
          "555-0101",
          "john.doe@company.com",
          "Regular",
          "Transportation",
          "2025-12-31",
          "Experienced driver with 10+ years",
          "Active",
        ],
      ];

      // Optimized: Use batch setValues instead of individual appendRow operations
      const startRow = driverSheet.getLastRow() + 1;
      const range = driverSheet.getRange(
        startRow,
        1,
        sampleDrivers.length,
        sampleDrivers[0].length
      );
      range.setValues(sampleDrivers);
      console.log("Sample drivers added successfully via batch operation");
    }

    // Add sample users if needed
    const usersSheet = ss.getSheetByName(USERS_SHEET);
    if (usersSheet) {
      let userData;
      try {
        userData = usersSheet.getDataRange().getValues();
      } catch (e) {
        console.log("Error getting user data range");
        userData = [];
      }

      if (userData.length <= 2) {
        console.log("Adding sample users...");
        const sampleUsers = [
          [
            generateNextUserId(), // ID
            "security1", // Username
            hashPassword("security123"), // Password
            "security", // Role
            "Security User 1", // Full Name
            "security1@example.com", // Email
            "active", // Status
            new Date().toISOString(), // Created Date
          ],
          [
            generateNextUserId(), // ID
            "admin1", // Username
            hashPassword("admin123"), // Password
            "admin", // Role
            "Admin User 1", // Full Name
            "admin1@example.com", // Email
            "active", // Status
            new Date().toISOString(), // Created Date
          ],
        ];

        // Optimized: Use batch setValues instead of individual appendRow operations
        const startRow = usersSheet.getLastRow() + 1;
        const range = usersSheet.getRange(
          startRow,
          1,
          sampleUsers.length,
          sampleUsers[0].length
        );
        range.setValues(sampleUsers);
        console.log("Sample users added successfully via batch operation");
      }
    }

    // Add sample gates if needed (simplified)
    const gatesSheet = ss.getSheetByName(GATES_SHEET);
    if (gatesSheet) {
      let gateData;
      try {
        gateData = gatesSheet.getDataRange().getValues();
      } catch (e) {
        console.log("Error getting gate data range");
        gateData = [];
      }

      if (gateData.length <= 1) {
        console.log("Adding sample gates...");
        const sampleGates = [
          [1, "Main Gate"],
          [2, "Service Gate"],
          [3, "Parking Gate"],
          [4, "Emergency Gate"],
          [5, "Visitor Gate"],
        ];

        // Optimized: Use batch setValues instead of individual appendRow operations
        const startRow = gatesSheet.getLastRow() + 1;
        const range = gatesSheet.getRange(
          startRow,
          1,
          sampleGates.length,
          sampleGates[0].length
        );
        range.setValues(sampleGates);
        console.log("Sample gates added successfully via batch operation");
      }
    }

    // Skip adding sample log entries - let the system start with real data only

    console.log("Sample data creation completed successfully");
    return "Sample data created successfully";
  } catch (error) {
    console.error("Error creating sample data:", error);
    return "Failed to create sample data: " + error.message;
  }
}
