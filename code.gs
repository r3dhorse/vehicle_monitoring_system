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
  constructor(message, code = "GENERAL_ERROR") {
    super(message);
    this.name = "VehicleMonitoringError";
    this.code = code;
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

// Generate next sequential user ID
function generateNextUserId() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);
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
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
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
    return nextId.toString().padStart(6, '0');
  } catch (error) {
    console.error("Error generating vehicle ID:", error);
    return "000001";
  }
}

// Generate next sequential driver ID
function generateNextDriverId() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DRIVER_SHEET);
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
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOG_SHEET);
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
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(GATES_SHEET);
    if (!sheet) {
      return 1; // First gate ID
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return 1; // First gate ID if only header exists
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
    console.error("Error generating gate ID:", error);
    return 1;
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
      "rows"
    );

    if (data.length <= 1) {
      console.log("No vehicle data found, creating sample data...");
      createSampleData();
      const updatedData = sheet.getDataRange().getValues();
      console.log("Vehicle data after sample creation:", updatedData.length);
      return updatedData;
    }

    return data;
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
      ],
    ];
  }
}

// Save vehicle (create or update) - for management
function saveVehicleRecord(vehicleData, userRole, editIndex = -1) {
  if (!["super-admin", "admin"].includes(userRole)) {
    throw new Error("Unauthorized: Admin access required.");
  }

  try {
    validateRequired(vehicleData.plateNumber, "Plate Number");
    validateRequired(vehicleData.model, "Make/Model");

    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(VEHICLE_SHEET);
    const data = sheet.getDataRange().getValues();

    const cleanPlateNumber = sanitizeInput(
      vehicleData.plateNumber.trim().toUpperCase()
    );

    // Check if plate number already exists (excluding current edit) - plate number is now at index 1
    for (let i = 1; i < data.length; i++) {
      if (i !== editIndex && data[i][1] === cleanPlateNumber) {
        throw new Error("Vehicle with this plate number already exists");
      }
    }

    let vehicleRow;
    if (editIndex > 0 && editIndex < data.length) {
      // Update existing vehicle - keep existing ID
      vehicleRow = [
        data[editIndex][0], // Keep existing ID
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
      ];
      
      // Update existing vehicle
      const range = sheet.getRange(editIndex + 1, 1, 1, vehicleRow.length);
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
      ];
      
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
function deleteVehicleRecord(vehicleIndex, userRole) {
  if (!["super-admin", "admin"].includes(userRole)) {
    throw new Error("Unauthorized: Admin access required.");
  }

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
    const header = sheet.getRange(1, 1, 1, 11).getValues()[0];
    // Keep all columns including ID
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
          .getRange(startRow, 1, endRow - startRow + 1, 11)
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
        .getRange(chunkStart, 1, chunkEnd - chunkStart + 1, 11)
        .getValues();

      // Filter chunk data based on search criteria and remove ID column
      const filteredChunk = chunkData.filter((row) => {
        if (!row || row.length < 11) return false;

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

    return allData;
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

    // Fix corrupted data: If plateNumber looks like a vehicle ID (numeric), find the actual plate number
    if (/^\d+$/.test(data.plateNumber.toString())) {
      console.log("Detected corrupted plateNumber (appears to be vehicle ID):", data.plateNumber);
      
      // Try to find vehicle by ID in column A (index 0)
      for (let i = 1; i < vehicleData.length; i++) {
        if (vehicleData[i][0] && vehicleData[i][0].toString() === data.plateNumber.toString()) {
          vehicleRow = i;
          actualPlateNumber = vehicleData[i][1]; // Get actual plate number from column B
          accessStatus = vehicleData[i][10] || "Access"; // Access Status is in column K (index 10)
          console.log("Found vehicle by ID. Actual plate number:", actualPlateNumber);
          break;
        }
      }
    } else {
      // Normal flow: search by plate number
      for (let i = 1; i < vehicleData.length; i++) {
        const sheetPlateNumber = vehicleData[i][1]; // Plate Number is in column B (index 1)
        if (sheetPlateNumber && sheetPlateNumber.toString().trim().toUpperCase() === data.plateNumber.toString().trim().toUpperCase()) {
          vehicleRow = i;
          accessStatus = vehicleData[i][10] || "Access"; // Access Status is in column K (index 10)
          actualPlateNumber = vehicleData[i][1]; // Ensure we use the exact plate number from the sheet
          break;
        }
      }
    }

    // Fix corrupted driverId: If driverId is an action (IN/OUT), try to get it from vehicle data or use username
    if (actualDriverId === "IN" || actualDriverId === "OUT") {
      console.log("Detected corrupted driverId (appears to be action):", actualDriverId);
      
      if (vehicleRow !== -1) {
        // Get current driver from vehicle sheet
        actualDriverId = vehicleData[vehicleRow][8] || data.username || "Unknown";
        console.log("Using current driver from vehicle sheet:", actualDriverId);
      } else {
        // Fallback to username or Unknown
        actualDriverId = data.username || "Unknown";
        console.log("Using fallback driver ID:", actualDriverId);
      }
    }

    // Check if vehicle has access
    if (data.action === "IN" && accessStatus !== "Access") {
      throw new Error(`Vehicle access denied. Status: ${accessStatus}`);
    }

    // Validate gate access and permissions
    const gateValidation = validateGateAccess(
      data.gate,
      data.action,
      actualPlateNumber
    );
    if (!gateValidation.allowed) {
      throw new Error(`Gate access denied: ${gateValidation.reason}`);
    }

    console.log("Final values for logging:", {
      plateNumber: actualPlateNumber,
      driverId: actualDriverId,
      action: data.action
    });

    // Log the action without ID column to match current header structure
    logSheet.appendRow([
      new Date(),
      actualPlateNumber, // Use corrected plate number
      actualDriverId,    // Use corrected driver ID
      data.action,
      data.gate,
      data.remarks || "",
      data.username || "System", // Use username passed from frontend
      accessStatus,
    ]);

    // Update vehicle status in column H (index 7, which is column 8 in spreadsheet)
    if (vehicleRow !== -1) {
      // Column H is at index 7 (0-based), but getRange uses 1-based indexing, so column H = 8
      console.log(`Updating vehicle status: row ${vehicleRow + 1}, column 8 (Status) to ${data.action}`);
      vehicleSheet.getRange(vehicleRow + 1, 8).setValue(data.action);
      
      // Also update the current driver in column I (index 8, column 9 in spreadsheet)
      if (actualDriverId && actualDriverId !== "Unknown") {
        console.log(`Updating current driver: row ${vehicleRow + 1}, column 9 (Current Driver) to ${actualDriverId}`);
        vehicleSheet.getRange(vehicleRow + 1, 9).setValue(actualDriverId);
      }
      
      // Force immediate update to spreadsheet
      SpreadsheetApp.flush();
      
      clearVehicleCache(); // Clear cache after status update
    } else {
      console.log("Warning: Vehicle not found in sheet, status not updated");
    }

    return { success: true, accessStatus: accessStatus };
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
      // Simple comparison - in production, use proper password hashing
      // Username is at index 1, password at index 2, role at index 3, status at index 6 (after ID field)
      if (data[i][1] === username && data[i][2] === password) {
        // Check user status (column G, index 6)
        const userStatus = data[i][6] || "active";
        if (userStatus !== "active") {
          // Log failed login attempt due to inactive status
          logUserActivity(username, "login", "failed - account " + userStatus);
          return { 
            success: false, 
            message: `Your account is currently: ${userStatus}` 
          };
        }
        
        // Log successful login
        logUserActivity(username, "login", "success");
        return { success: true, role: data[i][3] || "security" };
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

// Admin and Security: update vehicle record
function updateVehicleRecord(rowIndex, updatedData, userRole) {
  if (userRole !== "admin" && userRole !== "security") {
    throw new Error("Unauthorized: Admin or Security access required.");
  }

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
        if (data[i][1] === updatedData[1]) { // Compare plate numbers (column B, index 1)
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
        // Check if plate number already exists (excluding current vehicle)
        const data = sheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (i !== rowIndex && data[i][1] === updatedData[1]) { // Compare plate numbers (column B, index 1)
            throw new Error("Vehicle with this plate number already exists");
          }
        }

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

// Admin-only: delete vehicle record
function deleteVehicleRecord(rowIndex, userRole) {
  if (userRole !== "admin") {
    throw new Error("Unauthorized: Admin access required.");
  }

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
        .getRange(1, 1, 1, 11)
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
          ],
        ]);
      vehicleSheet.getRange(1, 1, 1, 11).setFontWeight("bold");

      // Format the sheet
      vehicleSheet.setFrozenRows(1);
      vehicleSheet.autoResizeColumns(1, 11);

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

    // Create Driver Master sheet (enhanced)
    let driverSheet = ss.getSheetByName(DRIVER_SHEET);
    if (!driverSheet) {
      driverSheet = ss.insertSheet(DRIVER_SHEET);
      driverSheet
        .getRange(1, 1, 1, 11)
        .setValues([
          [
            "ID",
            "Driver ID",
            "Name",
            "License Number",
            "Phone",
            "Email",
            "License Type",
            "Department",
            "License Expiry",
            "Notes",
            "Status",
          ],
        ]);
      driverSheet.getRange(1, 1, 1, 11).setFontWeight("bold");
      driverSheet.setFrozenRows(1);
      driverSheet.autoResizeColumns(1, 11);

      // Add data validation for Driver Status
      const driverStatusRange = driverSheet.getRange(2, 11, 1000, 1);
      const driverStatusRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(["Active", "Inactive", "Suspended"], true)
        .setAllowInvalid(false)
        .build();
      driverStatusRange.setDataValidation(driverStatusRule);

      // Add data validation for License Type
      const licenseTypeRange = driverSheet.getRange(2, 7, 1000, 1);
      const licenseTypeRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(
          ["Regular", "Commercial", "Motorcycle", "Chauffeur"],
          true
        )
        .setAllowInvalid(false)
        .build();
      licenseTypeRange.setDataValidation(licenseTypeRule);

      // Format license expiry column
      const expiryRange = driverSheet.getRange(2, 9, 1000, 1);
      expiryRange.setNumberFormat("yyyy-mm-dd");
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
            "Driver ID",
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
        .requireValueInList(
          ["super-admin", "admin", "security"],
          true
        )
        .setAllowInvalid(false)
        .build();
      roleRange.setDataValidation(roleRule);
    }

    // Create Gates sheet (simplified)
    let gatesSheet = ss.getSheetByName(GATES_SHEET);
    if (!gatesSheet) {
      gatesSheet = ss.insertSheet(GATES_SHEET);
      gatesSheet.getRange(1, 1, 1, 2).setValues([["ID", "Gate Name"]]);
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
      userId,                                    // ID
      "admin",                                  // Username
      "admin123",                               // Password
      "super-admin",                            // Role
      "System Administrator",                   // Full Name
      "admin@vehiclemonitoring.com",            // Email
      "active",                                 // Status
      new Date().toISOString(),                 // Created Date
    ]);
  } catch (error) {
    console.error("Error creating default admin:", error);
  }
}

// Reset admin user (for troubleshooting)
function resetAdminUser() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);
    if (!sheet) {
      createInitialSheets();
    }
    
    const data = sheet.getDataRange().getValues();
    
    // Find and update admin user (username is now at index 1)
    let adminFound = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === "admin") {
        // Update the admin user row with ID field
        sheet.getRange(i + 1, 1, 1, 8).setValues([[
          data[i][0] || 1,                                // Keep existing ID or default to 1
          "admin",                                        // Username
          "admin123",                                     // Password
          "super-admin",                                  // Role
          "System Administrator",                         // Full Name
          "admin@vehiclemonitoring.com",                  // Email
          "active",                                       // Status
          data[i][7] || new Date().toISOString()          // Keep existing created date or use current
        ]]);
        adminFound = true;
        break;
      }
    }
    
    // If admin not found, create it with ID field
    if (!adminFound) {
      const userId = generateNextUserId();
      sheet.appendRow([
        userId,                                           // ID
        "admin",                                        // Username
        "admin123",                                     // Password
        "super-admin",                                  // Role
        "System Administrator",                         // Full Name
        "admin@vehiclemonitoring.com",                  // Email
        "active",                                       // Status
        new Date().toISOString()                        // Created Date
      ]);
    }
    
    return { success: true, message: "Admin user reset successfully" };
  } catch (error) {
    console.error("Error resetting admin user:", error);
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

      // Count access statuses from column J (index 9)
      const accessStatus = (data[i][9] || "Access").toString().trim();
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
        gate: row[4] || "",
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

// Export logs to PDF (admin only)
function exportLogsToPDF(userRole, dateFrom, dateTo) {
  if (userRole !== "admin") {
    throw new Error("Unauthorized: Admin access required.");
  }

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
 * Clear all sample/mock data from the system (Admin only)
 * Keeps the headers and essential system data
 */
function clearSampleData(userRole) {
  if (!["super-admin", "admin"].includes(userRole)) {
    throw new Error("Unauthorized: Admin access required.");
  }

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
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);
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
        
        console.log(`Migrated user ${data[i][1]} from '${currentRole}' to '${newRole}'`);
      }
    }
    
    if (migratedCount > 0) {
      console.log(`Successfully migrated ${migratedCount} users to valid roles`);
    } else {
      console.log("No users needed role migration");
    }
    
    return { success: true, migratedCount: migratedCount };
    
  } catch (error) {
    console.error("Error migrating user roles:", error);
    throw error;
  }
}

// Get all users (super-admin only)
function getUserList(userRole) {
  console.log("getUserList called with role:", userRole);
  
  if (userRole !== "super-admin" && userRole !== "admin") {
    throw new Error("Unauthorized: Admin or Super admin access required.");
  }

  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);
    
    if (!sheet) {
      console.log("Users sheet not found, creating sheets and default admin...");
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
  console.log("saveUser called with:", { userData: userData.username, userRole, editIndex });
  
  if (userRole !== "super-admin" && userRole !== "admin") {
    return { success: false, error: "Unauthorized: Admin or Super admin access required." };
  }

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
      throw new Error("Username can only contain letters, numbers, and underscores");
    }

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);
    const data = sheet.getDataRange().getValues();

    // Role validation based on current user's role
    const validRoles = {
      "super-admin": ["super-admin", "admin", "security"],
      "admin": ["admin", "security"], // Admin can manage admin role (but not super-admin)
    };

    if (!validRoles[userRole].includes(userData.role)) {
      throw new Error(`You cannot assign the role: ${userData.role}`);
    }

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
          throw new Error("Username already exists. Please choose a different username.");
        }
      }
    } else {
      // For new users, check if username already exists - username is at index 1
      for (let i = 1; i < data.length; i++) {
        if (data[i][1] === userData.username) {
          throw new Error("Username already exists. Please choose a different username.");
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
        existingData[0],                                           // ID (keep existing)
        sanitizeInput(userData.username),                          // Username
        userData.password ? sanitizeInput(userData.password) : (existingData[2] || ""), // Keep existing password if not provided
        userData.role,                                             // Role
        sanitizeInput(userData.fullName),                          // Full Name
        sanitizeInput(userData.email),                             // Email
        userData.status || "active",                               // Status
        existingData[7] || new Date().toISOString(),               // Keep original creation date for edits
      ];
    } else {
      // Generate new ID for new users
      const userId = generateNextUserId();
      userRow = [
        userId,                                                    // ID (auto-generated)
        sanitizeInput(userData.username),                          // Username
        sanitizeInput(userData.password),                          // Password
        userData.role,                                             // Role
        sanitizeInput(userData.fullName),                          // Full Name
        sanitizeInput(userData.email),                             // Email
        userData.status || "active",                               // Status
        new Date().toISOString(),                                  // Created Date
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
      message: `User ${isEditing ? 'updated' : 'created'} successfully`
    };
  } catch (error) {
    console.error("Error saving user:", error);
    logUserActivity(userData.username || "unknown", "user_save_failed", "error", error.message);
    return { success: false, error: error.message };
  }
}

// Enhanced delete user function (super-admin only)
function deleteUser(userIndex, userRole) {
  console.log("deleteUser called with index:", userIndex, "role:", userRole);
  
  if (userRole !== "super-admin") {
    throw new Error("Unauthorized: Super admin access required.");
  }

  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);
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
    console.log(`User Activity - Username: ${username}, Action: ${action}, Status: ${status}, Details: ${details}`);
    
    // Optional: Create audit log in a separate sheet
    // const auditSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("UserAuditLog");
    // if (auditSheet) {
    //   auditSheet.appendRow([new Date(), username, action, status, details]);
    // }
  } catch (error) {
    console.warn("Could not log user activity:", error);
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
      return [["Gate Name"], ["Main Gate"], ["Back Gate"], ["Service Gate"]];
    }

    return data;
  } catch (error) {
    console.error("Error getting gate list:", error);
    return [["Gate Name"], ["Main Gate"], ["Back Gate"]];
  }
}

// Save gate (simple - just name)
function saveGate(gateName, userRole, editIndex = -1) {
  if (!["super-admin", "admin"].includes(userRole)) {
    throw new Error("Unauthorized: Admin access or higher required.");
  }

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
  if (!["super-admin", "admin"].includes(userRole)) {
    throw new Error("Unauthorized: Admin access or higher required.");
  }

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

// Diagnostic function to check user data
function checkUserData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(USERS_SHEET);
    
    if (!sheet) {
      return {
        error: "Users sheet not found",
        action: "Creating sheets and default admin..."
      };
    }
    
    const data = sheet.getDataRange().getValues();
    const users = [];
    
    for (let i = 0; i < data.length; i++) {
      users.push({
        row: i + 1,
        username: data[i][0] || "empty",
        role: data[i][2] || "empty",
        status: data[i][5] || "empty"
      });
    }
    
    return {
      totalRows: data.length,
      users: users,
      hasAdmin: users.some(u => u.username === "admin" && u.role === "super-admin")
    };
  } catch (error) {
    return {
      error: error.toString()
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
      sheet.getRange(1, 1, 1, 7).setValues([[
        "Username",
        "Password", 
        "Role",
        "Full Name",
        "Email",
        "Status",
        "Created Date"
      ]]);
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
      data: finalData
    };
  } catch (error) {
    console.error("Error in forceRefreshUsers:", error);
    return {
      success: false,
      error: error.toString()
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
        row[0] || "",                                    // Username
        row[1] || "",                                    // Password
        row[2] || "security",                           // Role (default to security)
        row[3] || row[0],                               // Full Name (default to username)
        row[4] || `${row[0]}@vehiclemonitoring.com`,   // Email (generate if missing)
        row[5] || "active",                             // Status (default to active)
        row[6] || new Date().toISOString()             // Created Date
      ];
      
      // Check for issues
      if (!row[3]) issues.push(`Row ${i+1}: Missing Full Name for user ${row[0]}`);
      if (!row[4]) issues.push(`Row ${i+1}: Missing Email for user ${row[0]}`);
      
      normalizedData.push(normalizedRow);
    }
    
    // Update the sheet with normalized data
    if (normalizedData.length > 1) {
      sheet.clear();
      sheet.getRange(1, 1, normalizedData.length, normalizedData[0].length).setValues(normalizedData);
    }
    
    return {
      success: true,
      rowsProcessed: normalizedData.length - 1,
      issues: issues,
      message: `Normalized ${normalizedData.length - 1} users`
    };
    
  } catch (error) {
    console.error("Error normalizing user data:", error);
    return {
      success: false,
      error: error.toString()
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
          id: data[i][0],
          name: data[i][0],
        });
      }
    }

    return gates.length > 0
      ? gates
      : [
          { id: "Main Gate", name: "Main Gate" },
          { id: "Back Gate", name: "Back Gate" },
        ];
  } catch (error) {
    console.error("Error getting active gates:", error);
    return [
      { id: "Main Gate", name: "Main Gate" },
      { id: "Back Gate", name: "Back Gate" },
    ];
  }
}

// Validate gate access for vehicles (simplified)
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
      return { allowed: false, reason: `Gate "${gateId}" not found in system` };
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
        [
          "000002",
          "DRV002",
          "Jane Smith",
          "LIC002",
          "555-0102",
          "jane.smith@company.com",
          "Commercial",
          "Logistics",
          "2025-06-30",
          "CDL certified",
          "Active",
        ],
        [
          "000003",
          "DRV003",
          "Bob Johnson",
          "LIC003",
          "555-0103",
          "bob.johnson@company.com",
          "Regular",
          "IT Department",
          "2024-09-15",
          "Part-time driver",
          "Active",
        ],
        [
          "000004",
          "DRV004",
          "Alice Brown",
          "LIC004",
          "555-0104",
          "alice.brown@company.com",
          "Regular",
          "HR Department",
          "2025-03-20",
          "Emergency backup driver",
          "Inactive",
        ],
        [
          "000005",
          "DRV005",
          "Charlie Davis",
          "LIC005",
          "555-0105",
          "charlie.davis@company.com",
          "Chauffeur",
          "Executive",
          "2026-01-15",
          "Executive driver specialist",
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
          ["security1", "security123", "security", "security1@example.com", new Date()],
          ["admin1", "admin123", "admin", "admin1@example.com", new Date()],
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
          ["Main Gate"],
          ["Back Gate"],
          ["Parking Gate"],
          ["Service Gate"],
          ["Emergency Gate"],
          ["Visitor Gate"],
          ["Security Gate"],
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
