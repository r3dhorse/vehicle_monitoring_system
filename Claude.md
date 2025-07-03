# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Vehicle Monitoring System built as a Google Apps Script Web Application that tracks vehicle movements through organizational gates/checkpoints.

## Technology Stack

- **Backend**: Google Apps Script (server-side JavaScript)
- **Database**: Google Sheets (Spreadsheet ID: `1OMlsS2W_N566ZEC4K9bXutQdu0qCB67Q7ezZCN1w7u8`)
- **Frontend**: Single-page application in `app.html` using Bootstrap 5.3.0
- **Authentication**: Custom implementation with SHA-256 password hashing and salt
- **QR Code Support**: jsQR 1.4.0 for vehicle identification
- **UI Framework**: Bootstrap 5.3.0 with Bootstrap Icons 1.11.3

## Architecture

The system follows a Google Apps Script Web App architecture:

1. **Code.gs** (4,715 lines): Server-side logic with 94 functions handling:

   - Authentication and authorization (RBAC with roles: super-admin, admin, security)
   - CRUD operations for vehicles, drivers, and gates
   - In/Out logging with audit trails
   - Caching system for performance optimization
   - All database operations through Google Sheets API

2. **app.html** (8,567 lines): Complete frontend as a single file containing:
   - HTML structure
   - Embedded CSS with mobile-responsive design
   - Client-side JavaScript for UI interactions
   - Communication with backend via `google.script.run` API

## Key Data Structures

Google Sheets used as database tables:

- **VehicleMaster**: Vehicle registration details (Column A = Vehicle ID, Column B = Plate Number)
- **DriverMaster**: Driver information
- **InOutLogs**: Movement tracking records
- **Users**: System users with roles and permissions
- **Gates**: Gate/checkpoint definitions

### VehicleMaster Sheet Structure

| Column | Field              | Description                              |
| ------ | ------------------ | ---------------------------------------- |
| A      | Vehicle ID         | 6-digit padded ID (000001, 000002, etc.) |
| B      | Plate Number       | Vehicle license plate                    |
| C      | Make/Model         | Vehicle description                      |
| D      | Color              | Vehicle color                            |
| E      | Department/Company | Owner department                         |
| F      | Year               | Manufacturing year                       |
| G      | Type               | Vehicle type (Car, Truck, Van, etc.)     |
| H      | Status             | Current status (IN/OUT)                  |
| I      | Current Driver     | Currently assigned driver                |
| J      | Assigned Drivers   | List of authorized drivers               |
| K      | Access Status      | Access level (Access/No Access/Banned)   |
| L      | One Time Pass      | Temporary access flag (Yes/No)           |
| M      | MV File            | Motor Vehicle file number or reference   |

## Development Commands

This is a Google Apps Script project - no build tools, npm commands, or testing framework. Development workflow:

1. Edit files in Google Apps Script Editor or push via clasp
2. Deploy as Web App through Google Apps Script  
3. The `doGet()` function serves the application
4. Use `clearAllCaches()` function for manual cache management during development

## Important Implementation Notes

- Password hashing uses SHA-256 with UUID salt in format: `salt:hash`
- Caching implemented via `CacheService.getScriptCache()` for performance
- All client-server communication uses Google's `google.script.run` async API
- Input sanitization implemented in `sanitizeInput()` function
- Session management through custom token system
- Role-based permissions enforced at function level

### QR Code System

- **Vehicle Identification**: System uses Vehicle IDs (column A) for QR code lookups
- **ID Format**: Vehicle IDs are 6-digit padded (e.g., "000001", "000002")
- **QR Processing**: Automatically detects numeric QR codes as Vehicle IDs vs plate numbers
- **Lookup Functions**:
  - `getVehicleById()` - handles padded/unpadded vehicle ID lookups
  - `getVehicleByPlate()` - traditional plate number lookups
- **Frontend Integration**: Smart detection in `processQRCodeData()` determines lookup method
- **Compatibility**: Supports both "1" and "000001" formats for same vehicle

### Vehicle Management

- **Modal Forms**: Responsive Bootstrap modals for add/edit vehicle operations
- **Form Fields**: All 13 vehicle fields including new MV File column
- **Data Validation**: Required field validation and duplicate plate number checks
- **Real-time Updates**: Live data synchronization between frontend and Google Sheets
- **Column Updates**: System automatically handles 13-column data structure
- **Sample Data**: Includes realistic MV File examples (e.g., "MV-2022-001")
- **Driver Assignment**:
  - Multi-select dropdown for assigning multiple drivers to vehicles
  - Dynamic loading of active drivers from DriverMaster sheet
  - Current driver dropdown populated from assigned drivers
  - Maintains many-to-many relationship between vehicles and drivers

## Security Considerations

- Never expose the Google Sheets ID in client-side code
- All sensitive operations require authentication tokens
- Input validation required for all user inputs
- Audit logging for all data modifications
- Permission checks before any CRUD operations

## Recent Updates

### Database Schema Changes

- **Added MV File Column**: New column M in VehicleMaster sheet for Motor Vehicle file references
- **Updated Data Structure**: System now handles 13 columns instead of 12
- **Enhanced Sample Data**: Includes realistic MV File examples (MV-YYYY-XXX format)

### QR Code System Enhancements

- **Vehicle ID Lookup**: Changed from plate number (column B) to vehicle ID (column A) lookup
- **Smart Detection**: Automatically detects numeric QR codes as vehicle IDs vs plate numbers
- **Dual Compatibility**: Supports both padded (000001) and unpadded (1) ID formats
- **New Functions**: Added `getVehicleById()` for dedicated vehicle ID lookups

### Frontend Improvements

- **Enhanced Modals**: Updated add/edit vehicle modals with MV File field
- **Better Layout**: Reorganized form fields for improved user experience
- **Data Validation**: Enhanced validation for all 13 vehicle fields
- **Real-time Sync**: Improved data synchronization between frontend and backend
- **Multi-Select Drivers**: Implemented many-to-many relationship for assigned drivers with dropdown selection
- **Direct Edit Access**: Changed Details button to Edit button (app.html:3779) - opens Edit Vehicle modal directly
- **Removed Vehicle Details Modal**: Eliminated intermediate modal to save clicks (removed lines 2018-2033)
- **Search UI Improvements**: Fixed z-index layering issue where search suggestions dropdown was being blocked by sticky table headers
  - Updated `.search-suggestions` z-index from 1000 to 1050 (app.html:125)
  - Ensures proper display hierarchy for enhanced search functionality

### Access Control Bug Fixes

- **No Access Validation**: Fixed bug where vehicles with "No Access" could check in without one-time pass
  - Frontend validation added in button rendering (app.html:3792, 3811)
  - Additional validation in `toggleVehicleStatus()` function
- **One-Time Pass Enhancement**: Modified to disable pass on both check-in AND check-out (Code.gs:1807-1810)
  - Previously only disabled on check-in
  - Now ensures temporary access is truly one-time use

### Vehicle Lookup Fix

- **Corrected Plate Number Assignment**: Fixed bug in `logVehicleAction()` where actualPlateNumber was incorrectly set
  - Changed from `vehicleData[i][0]` (vehicle ID) to `vehicleData[i][1]` (plate number) at Code.gs:1695
  - Ensures vehicle status and one-time pass updates work correctly
  - Fixed both ID-based and plate-based lookup paths

### Driver Display Enhancement

- **Driver Names in Vehicle List**: Enhanced UI to display driver names instead of driver IDs in vehicle list table
  - Added `getDriverNameById()` helper function (app.html:3919) for frontend driver ID to name conversion
  - Updated `createVehicleTableRow()` to show driver names in Current Driver column
  - Improved user experience with readable driver information

### InOutLogs Driver Name Fix

- **Driver Name Logging**: Fixed InOutLogs to record driver names instead of driver IDs
  - Updated column header from "Driver ID" to "Driver Name" (Code.gs:2186)
  - Enhanced `logVehicleAction()` with driver ID to name conversion (Code.gs:1719-1722, 1774-1775)
  - Fixed frontend `saveVehicleEdit()` to send driver names instead of IDs (app.html:6091-6092, 6245)
  - Added safety conversion for incoming driver data to ensure names are stored
  - Created `migrateDriverIdsToNames()` function for existing data migration (Code.gs:66-128)
  - Fixed transaction remarks to show "Driver change: John Smith → Jane Doe" instead of "3 → 5"

### Recent Major Updates (Version 2)

#### One-Time Pass System Enhancement
- **Improved OTP Logic**: Fixed critical bug where OTP wasn't properly disabled after use
- **Enhanced Validation**: Added comprehensive checks for vehicle access status
- **UI Improvements**: Better visual feedback for OTP status and usage
- **Backend Optimization**: Streamlined OTP handling in `logVehicleAction()` function

#### QR Scanner Improvements
- **Vehicle Info Retention**: Fixed issue where vehicle information was lost for restricted vehicles
- **Better Error Handling**: Improved feedback for access denied scenarios
- **Transaction Refactoring**: Cleaner QR code processing workflow

#### UI/UX Enhancements
- **Navigation Bar**: Refactored locations and improved layout
- **User Management Modal**: Enhanced visibility and usability
- **Password Security**: Fixed password hash implementation
- **Responsive Design**: Better mobile experience across all modals

#### New Documentation
- **USER_MANUAL.md**: Added comprehensive 510-line user manual covering:
  - System overview and features
  - Role-based access control
  - Step-by-step guides for all operations
  - Troubleshooting and FAQ sections

#### Loading Animation Modernization (Latest Updates)
- **Pulse Animation**: Replaced spinning animations with modern pulse effects
- **Overlap Prevention**: Fixed overlapping loading animations during page refresh
- **Clean Design**: Removed white backgrounds and dark overlays for cleaner UX
- **Improved Performance**: Separated initial loading screen from general loading spinner
- **Z-Index Management**: Proper layering with initial screen (10000) and spinner (8000)
- **Enhanced Visibility**: Added subtle glow effects without intrusive backgrounds

#### Current Implementation Highlights
- **Animation Framework**: CSS3 keyframe animations with optimized performance
- **Loading States**: Dual-layer system (initial screen + operational spinner)
- **CSS Classes**: Separated `.initial-loading-spinner` and `.loading-spinner` to prevent conflicts
- **Pulse Effect**: Scale and opacity transitions (1.0 → 1.1 → 1.0) with 1.5s duration
- **Backdrop Handling**: Clean implementation without intrusive overlays

#### Search Functionality Optimization (Latest Updates)
- **Simplified Search Interface**: Streamlined search to focus exclusively on plate number searches
  - Updated placeholder text from multi-field search to "Search by plate number... (Ctrl+K)"
  - Simplified search hints to focus on plate number patterns and exact matching
  - Removed advanced search syntax (type:, status:, access:, dept:) for better UX simplicity
- **Client-Side Performance Enhancement**: Implemented fast client-side filtering for better responsiveness
  - Added `performClientSidePlateFilter()` function for instant plate number filtering (app.html:5340-5386)
  - Reduced debounce timeout from 200ms to 100ms for faster response
  - Smart fallback to server-side search only when necessary (no data loaded or empty search)
  - Original data preservation with `originalVehicleData` for seamless filter clearing
- **Enhanced Search Experience**: Improved user interaction and performance
  - Instant client-side filtering when vehicle data is already loaded
  - Simplified search suggestions to show only plate numbers (removed model, department, driver suggestions)
  - Faster search clearing with `clearClientSideFilter()` function
  - Reduced server load by avoiding unnecessary backend calls for simple plate searches
- **Search Optimization Strategy**: Performance-first approach with intelligent data handling
  - Client-side filtering for loaded data to provide instant results
  - Server-side search as fallback for comprehensive data retrieval
  - Cached search results maintained for repeated queries
  - Enhanced logging for debugging filter performance and behavior

#### Search Icon Overlap Fixes (Latest Updates)
- **Mobile View Optimization**: Removed search icon in mobile view to eliminate text overlap
  - Hidden search icon with `display: none` for mobile devices (max-width: 767px)
  - Reduced search input left padding from 4rem to 1rem for cleaner mobile experience
  - Maintained right padding for clear button functionality
- **Fullscreen Mode Enhancement**: Fixed search icon overlap in fullscreen and focus modes
  - Added specific `.fullscreen-mode #searchInput` override with proper padding
  - Set `padding-left: 3rem !important` and `padding-right: 3rem !important`
  - Ensured search icon and clear button spacing is maintained in all fullscreen states
- **Responsive Design**: Different search input behaviors across device types
  - Desktop: Full search icon and clear button with proper spacing
  - Mobile/Tablet: Hidden search icon, visible clear button, optimized padding
  - Fullscreen modes: Maintained icon spacing for enhanced user experience

#### Gate Restriction System Enhancement (Latest Updates)
- **Gate ID Validation Fix**: Resolved critical gate validation issues
  - Fixed TypeError when comparing gate IDs due to type mismatches
  - Enhanced gate ID comparison logic with proper string conversion
  - Added comprehensive debug logging for gate validation troubleshooting
- **Transaction Log Enhancement**: Improved Recent Transaction display
  - Gate IDs now display as human-readable gate names (e.g., "Main Gate" instead of "1")
  - Added `getGateNameById()` helper function for ID-to-name conversion
  - Maintains referential integrity while improving user experience
- **Gate Management Improvements**: Enhanced gate selector behavior
  - Active gate selection now persists when gate list is refreshed
  - Gate selector automatically updates when gates are added/edited/deleted
  - Added sessionStorage persistence with proper restoration logic
  - Fixed timing issues with gate selection restoration using setTimeout
- **Backend Consistency**: Ensured consistent gate ID handling
  - `generateNextGateId()` now returns string IDs for consistency
  - `getActiveGates()` converts all gate IDs to strings
  - Fixed potential number vs string comparison issues in validation
  - Updated frontend to use `saveGateSimple()` for proper Id/GateName structure

#### Transaction Protection System (Latest Updates)
- **Anti-Double-Click Protection**: Implemented comprehensive system to prevent simultaneous transactions
  - Global `isTransactionInProgress` flag prevents multiple concurrent operations
  - All transaction buttons disabled during active transactions with visual feedback
  - Loading spinner animation with CSS keyframes for processing indication
- **Mobile & Tablet Optimization**: Enhanced transaction protection for touch devices
  - Device-aware button styling with responsive opacity levels (0.4 mobile, 0.5 tablet, 0.6 desktop)
  - 300ms debounce timer to prevent rapid double-taps on mobile devices
  - Haptic feedback (vibration) for mobile devices when transactions start
  - Enhanced touch targets with minimum 44px/40px sizing for accessibility
- **Comprehensive Coverage**: Protection across all transaction entry points
  - Vehicle list transaction buttons (`toggleVehicleStatus`)
  - QR scanner transaction submission (`submitQRTransaction`)
  - Gate validation failure scenarios with proper cleanup
  - Access denial scenarios with button re-enabling
- **Visual & UX Enhancements**: Professional loading states and feedback
  - Device-specific loading spinner sizes and animations
  - Complete touch event blocking (`pointerEvents: 'none`) during processing
  - Original button state restoration after completion/failure
  - Enhanced console logging with device type detection for debugging

#### Vehicle Audit Trail Enhancement (Latest Updates)
- **Action Column Addition**: Enhanced audit trail with operation type tracking
  - New header structure: `Timestamp | Username | Action | Old Data | New Data`
  - Clear differentiation between "Create" and "Update" operations
  - Better accountability and compliance tracking for vehicle data changes
- **Comprehensive Logging Coverage**: Expanded audit trail to cover all operations
  - Vehicle creation now logged with "Create" action (previously not tracked)
  - Vehicle updates continue with "Update" action and before/after data comparison
  - All admin and super-admin vehicle modifications tracked with proper action type
- **Automatic Migration System**: Seamless upgrade for existing deployments
  - `migrateAuditTrailFormat()` function handles legacy format conversion
  - Automatic detection and migration of existing 4-column audit trails
  - Historical records preserved and marked as "Update" action by default
  - Zero-downtime migration process with detailed console logging
- **Enhanced Data Integrity**: Improved audit trail functionality
  - Proper null handling for create operations ("No data" for Old Data)
  - Enhanced `logVehicleAuditTrail()` function with action parameter
  - Backward compatibility with existing audit trail implementations
  - Complete coverage of vehicle lifecycle events (create, update, delete)

#### Security Role Interface Enhancement (Latest Updates)
- **Gate Access Control for Security Role**: Enhanced read-only restrictions for security users
  - "Allowed Gates" section now read-only for security role users with visual indicators
  - Disabled gate checkboxes with grayed-out appearance and tooltips
  - Section header updated to show "(Read-Only for Security)" status
  - Proper cleanup when switching between security and admin roles
- **Enhanced Current Driver Modal Experience**: Improved UX for security role driver changes
  - Modal title now shows "Change Current Driver - [Plate Number]" for better context
  - Current driver field highlighted with blue border and subtle background styling
  - Added "Editable Field" badge to clearly indicate which field security users can modify
  - Enhanced driver change warning with comprehensive vehicle and status information
  - Updated save button text to "Update Driver Assignment" for clearer action indication
- **Visual Enhancement System**: Comprehensive UI improvements for role-based access
  - Dynamic visual cues that adapt based on user role and permissions
  - Enhanced focus management with delayed focus for better accessibility
  - Consistent cleanup of all visual enhancements when switching user roles
  - Maintains existing security restrictions while improving user experience

## Current System Status

### File Statistics
- **Code.gs**: 5,300+ lines (165KB) - Backend with gate restriction fixes and access status normalization
- **app.html**: 9,100+ lines (430KB) - Complete frontend with search optimization and transaction protection
- **USER_MANUAL.md**: 509 lines (16KB) - Comprehensive user documentation
- **Claude.md**: 555+ lines (26KB) - Technical documentation with current git status updates
- **README.md**: 180+ lines (8KB) - Updated with Gate Restriction System documentation
- **test_gate_validation.gs**: 140 lines (5KB) - Comprehensive gate validation test suite
- **test_user_gate_bug.gs**: 110 lines (4KB) - Access status bug test scenarios
- **Total Project Size**: ~653KB, 15,600+ lines of code across all files

### Repository Information
- **Git Remote**: GitHub repository (r3dhorse/vehicle-monitoring-system)
- **Main Branch**: Single branch development model
- **Current Version**: Enhanced with driver field preservation and responsive UI improvements
- **Recent Activity**: UI/UX improvements for driver selection and tablet layout
- **Latest Changes**: 
  - Optimized search functionality to focus exclusively on plate number searches
  - Implemented client-side filtering for instant search results and better performance
  - Simplified search interface by removing advanced syntax (type:, status:, access:, dept:)
  - Enhanced user experience with faster search response times (100ms debounce)
  - Previous: Fixed driver field preservation and tablet responsive design improvements
- **Project Structure**: Enhanced 6-file architecture (Code.gs, app.html, Claude.md, USER_MANUAL.md, README.md, USER_STORIES.md)
- **Current Git Status**: Modified files pending commit (app.html, code.gs)

## Development Guidelines

### Adding New Vehicle Fields

When adding new columns to the VehicleMaster sheet:

1. **Update Headers**: Modify `createInitialSheets()` function in Code.gs
2. **Update Range Calls**: Change getRange column count from current to new total
3. **Frontend Forms**: Add input fields to both add and edit modals in app.html
4. **JavaScript Functions**: Update `saveVehicle()` and `saveVehicleEdit()` functions
5. **Backend Processing**: Update `saveVehicleRecord()` to handle new field
6. **Sample Data**: Add realistic examples to `createSampleData()` function
7. **Documentation**: Update VehicleMaster table structure in this file

### Driver Management Implementation
The system implements a simplified driver management structure:

#### DriverMaster Sheet Structure (Simplified)

| Column | Field         | Description                          |
| ------ | ------------- | ------------------------------------ |
| A      | Driver ID     | Unique identifier                    |
| B      | Name          | Driver full name                     |
| C      | Department    | Department/Company                   |
| D      | Phone         | Contact phone number                 |
| E      | Status        | Active/Inactive status               |

#### Driver Management Modal

- **New Interface**: Dedicated driver management modal for CRUD operations
- **Simplified Form**: Clean 5-field form matching new sheet structure
- **Real-time Updates**: Direct integration with Google Sheets backend
- **Data Validation**: Required field validation for essential information

#### Backend Integration

- **Streamlined Functions**: Optimized driver CRUD operations for 5-column structure
- **Performance**: Reduced data transfer and processing overhead
- **Compatibility**: Maintains existing vehicle-driver assignment functionality

#### Vehicle-Driver Assignment

- **Multi-select Interface**: Dropdown selection for assigning drivers to vehicles
- **Dynamic Loading**: Real-time driver list updates
- **Current Driver Selection**: Automatically populates from assigned drivers list
- **Driver Display**: Current driver dropdown shows only driver names (without license numbers)
- **Data Consistency**: System ensures driver names are stored in vehicle sheet and transaction logs

### Common Functions

- **Vehicle CRUD**: `saveVehicleRecord()`, `getVehicleListForManagement()`, `deleteVehicleRecord()`
- **QR Processing**: `logVehicleAction()` (with access control), `getVehicleById()`, `getVehicleByPlate()`
- **Authentication**: `loginUser()`, `hasPermission()`, `enforcePermission()`
- **Data Management**: `getVehicleList()`, `getDatabaseStatistics()`, `getRecentTransactions()`
- **Driver Management**: `getDriverList()`, `generateNextDriverId()`, `getDriverNameById()`, `migrateDriverIdsToNames()`
- **Gate Management**: `saveGateSimple()`, `getActiveGates()`, `getGateNameById()`, `validateVehicleGateAccess()`
- **UI Functions**: `editVehicle()` (replaces `showVehicleDetails()`), `toggleVehicleStatus()` (with access validation)
- **Transaction Protection**: `setTransactionInProgress()`, mobile debouncing, haptic feedback integration
- **Audit Trail**: `logVehicleAuditTrail()`, `migrateAuditTrailFormat()`, `getVehicleAuditTrail()`

### Debug and Testing Functions

- **Gate Validation Testing**: 
  - `testCurrentGateIssue()` - Tests single gate restriction scenarios with various data types
  - `testSingleGateValidation()` - Tests the fixed gate validation with single gate values
  - `debugUserGateTest()` - Debug function for user-reported gate access issues
  - `testUserGateBug()` - Tests non-standard access status scenarios (in test_user_gate_bug.gs)
  - `debugGateAccessValidation()` - Comprehensive gate access debugging with detailed logging
  - `testVehicleWithGates12()` - Tests specific vehicle with allowed gates "1,2"
  - `debugCurrentGateSystem()` - Analyzes complete gate system structure and data
  - `runGateValidationTests()` - Comprehensive test suite for gate validation (in test_gate_validation.gs)
- **System Testing & Maintenance**: 
  - `clearAllCaches()` - Manual cache clearing for development
  - `testGateSystemStructure()` - Verifies gate sheet structure and functionality
  - `fixNonStandardAccessStatus()` - Fixes non-standard access status values in spreadsheet

### Testing Approach

- **QR Code Testing**: Use vehicle IDs "1", "000001" for testing
- **Permission Testing**: Test with different user roles (super-admin, admin, security)
- **Data Validation**: Test required fields, duplicate detection, field limits
- **Cross-browser**: Test in Chrome, Firefox, Safari, Edge
- **Access Control Testing**:
  - Verify "No Access" vehicles cannot check in without one-time pass
  - Confirm one-time pass is disabled after any transaction (IN)
  - Test "Banned" vehicles are completely blocked
- **Gate Restriction Testing**:
  - Test vehicle with allowed gates "1,2" can access gate ID "1" and "2"
  - Verify gate validation works with both string and number gate IDs
  - Confirm transaction logs show gate names instead of gate IDs
  - Test gate selector persistence when managing gates (add/edit/delete)
  - Verify gate selector auto-refreshes after gate management operations
- **Transaction Protection Testing**:
  - Test rapid clicking on transaction buttons to verify protection
  - Verify all buttons disabled during active transaction processing
  - Test mobile double-tap prevention (300ms debounce timer)
  - Confirm loading spinner appears on active transaction button
  - Verify button state restoration after successful/failed transactions
  - Test QR scanner transaction protection and mobile behavior
  - Confirm haptic feedback works on supported mobile devices
- **UI Testing**:
  - Verify Edit button opens Edit Vehicle modal directly
  - Ensure no errors from removed Vehicle Details Modal references
  - Test gate selector maintains selection after refresh operations
- **Driver Management Testing**:
  - Verify vehicle list shows driver names instead of IDs in Current Driver column
  - Test current driver dropdown displays only driver names (no license numbers)
  - Confirm InOutLogs record driver names instead of IDs
  - Verify transaction remarks show proper driver name changes
  - Test `migrateDriverIdsToNames()` function on test data
- **Security Role Interface Testing**:
  - Verify "Allowed Gates" section is read-only for security users with proper visual indicators
  - Test gate checkboxes are disabled and show "not-allowed" cursor for security role
  - Confirm section header shows "(Read-Only for Security)" text for security users
  - Verify proper cleanup when switching from security to admin/super-admin roles
  - Test enhanced current driver modal shows plate number in title for security users
  - Confirm current driver field is highlighted with blue border and "Editable Field" badge
  - Verify enhanced driver change warning shows comprehensive vehicle information
  - Test save button shows "Update Driver Assignment" text for security users
  - Confirm all visual enhancements are properly cleaned up for non-security roles
- **Driver Field Preservation Testing**:
  - Verify current driver selection is preserved when changing authorized drivers checkboxes
  - Test restoration of driver dropdown value after authorized drivers list updates
  - Confirm no unnecessary field clearing when fetching driver data
  - Verify timeout handling works correctly for driver field restoration
  - Test preservation works across different user roles and permission levels
- **Tablet Responsive Design Testing**:
  - Test floating buttons appear on left side for tablet viewport (768px-1024px)
  - Verify buttons remain on right side for desktop (>1024px) and mobile (<768px)
  - Test landscape tablet orientation button positioning (768px-1366px)
  - Confirm proper button spacing and accessibility on tablet devices
  - Verify no UI conflicts or overlap issues with left-positioned buttons

#### Gate Restriction Bug Fixes (July 2025)

##### Fix 1: Single Gate Restriction Issue
- **Issue**: Vehicles with single gate restriction (e.g., only gate "1") were incorrectly denied access
- **Root Cause**: The validation logic always used `split(',')` which works for comma-separated values but failed for single gate values without commas
- **Solution Implemented** (Code.gs lines 5270-5279):
  - Added logic to detect if allowed gates string contains a comma
  - If comma exists: split by comma (multiple gates scenario)
  - If no comma: treat as single gate value (single gate scenario)
  - Added filtering to remove empty strings from the parsed array
  - Enhanced validation to ensure at least one valid gate ID exists

##### Fix 2: Non-Standard Access Status Values
- **Issue**: Vehicles with non-standard access status (e.g., "full acces", "Full Access") were denied gate access
- **Root Cause**: Access status validation used exact string matching for "Banned" and "No Access"
- **Solution Implemented** (Code.gs lines 5225-5250):
  - Added normalization of access status values (lowercase + trim)
  - Enhanced validation to handle typos and variations gracefully
  - Only "banned" and "no access" (case-insensitive) restrict access
  - All other values (including typos) allow normal gate validation
- **Helper Function Added**: `fixNonStandardAccessStatus()` (lines 126-170)
  - Automatically fixes non-standard access status values in the spreadsheet
  - Converts variations like "full acces" to standard "Access"
  - Provides data cleanup utility for existing deployments

##### Test Coverage
- Created `test_gate_validation.gs` - comprehensive test suite for gate validation
- Created `test_user_gate_bug.gs` - specific tests for access status bug scenarios
- Added debug functions: `debugUserGateTest()`, `testUserGateBug()`
- Test scenarios cover:
  - Single/multiple gate configurations
  - Non-standard access status values
  - Edge cases and data type variations
  - 11+ test scenarios with expected outcomes

##### Documentation
- Updated README.md with Gate Restriction System section
- Added configuration tables and examples
- Documented standard access status values: "Access", "No Access", "Banned"
- Added troubleshooting guide for gate restrictions

#### UI/UX Improvements (January 2025)

##### Driver Field Preservation Enhancement
- **Issue**: Current driver field was being cleared when fetching authorized drivers data in Change Current Driver modal
- **Root Cause**: `populateDriverDropdowns()` function cleared all container content without preserving current selection
- **Solution Implemented** (app.html lines 4299-4355):
  - Added preservation logic to save current driver selection before clearing containers
  - Enhanced `updateCurrentDriverDropdown()` to better preserve and restore current values
  - Added restoration logic after driver checkbox population with timeout handling
  - Improved logging for debugging value preservation and restoration
- **User Experience**: Prevents frustrating field clearing when users are updating authorized drivers list

##### Tablet Responsive Design Enhancement  
- **Issue**: Floating action buttons positioned on right side caused UI conflicts on tablet devices
- **Solution Implemented** (app.html lines 1106-1140):
  - Added tablet-specific media queries for 768px-1024px viewport
  - Relocated floating buttons to left side for tablet view
  - Added landscape tablet support for 768px-1366px with orientation detection
  - Maintained right-side positioning for desktop (>1024px) and mobile (<768px)
- **Button Positioning**:
  - Add Vehicle Button: `left: 30px` (tablet) vs `right: 30px` (desktop/mobile)
  - QR Scanner Button: `left: 100px` (tablet) vs `right: 100px` (desktop/mobile) 
  - Refresh Button: `left: 170px` (tablet) vs `right: 170px` (desktop/mobile)
- **Responsive Strategy**: Device-specific button placement for optimal accessibility
