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

## Current System Status

### File Statistics
- **Code.gs**: 5,100+ lines (155KB) - Backend with enhanced gate validation and debug functions  
- **app.html**: 8,950+ lines (410KB) - Complete frontend with gate selector persistence
- **USER_MANUAL.md**: 509 lines (16KB) - Comprehensive user documentation
- **Claude.md**: 370+ lines (18KB) - Technical documentation and development guide
- **Total Project Size**: ~599KB, 14,929+ lines of code across main files

### Repository Information
- **Git Remote**: Bitbucket repository (noc88/vehicle-monitoring-system)
- **Main Branch**: Single branch development model
- **Current Version**: Enhanced with gate validation fixes
- **Recent Activity**: Gate restriction system improvements and validation fixes
- **Latest Changes**: 
  - Fixed gate ID validation TypeError and comparison logic
  - Enhanced transaction logs to show gate names instead of IDs
  - Improved gate selector persistence and auto-refresh functionality
  - Ensured consistent string handling for gate IDs throughout system
- **Project Structure**: Enhanced 6-file architecture (Code.gs, app.html, Claude.md, USER_MANUAL.md, README.md, USER_STORIES.md)

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

### Debug and Testing Functions

- **Gate Validation Testing**: 
  - `testCurrentGateIssue()` - Tests different gate ID scenarios with various data types
  - `debugGateAccessValidation()` - Comprehensive gate access debugging with detailed logging
  - `testVehicleWithGates12()` - Tests specific vehicle with allowed gates "1,2"
  - `debugCurrentGateSystem()` - Analyzes complete gate system structure and data
- **System Testing**: 
  - `clearAllCaches()` - Manual cache clearing for development
  - `testGateSystemStructure()` - Verifies gate sheet structure and functionality

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
