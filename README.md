# Vehicle Monitoring System

A web-based vehicle monitoring system built with Google Apps Script and Google Sheets for tracking vehicle movements in and out of premises.

## Features

### Core Functionality
- **Vehicle Check-in/Check-out**: Track vehicle movements with gate information
- **Real-time Dashboard**: View vehicle status (IN/OUT) with statistics
- **Search & Filter**: Find vehicles by plate number or model
- **Driver Assignment**: Track which driver is using which vehicle
- **Activity Logging**: Complete audit trail of all vehicle movements

### Security Features
- **User Authentication**: Login system with username/password
- **Role-based Access**: Admin and regular user roles
- **Activity Tracking**: User login attempts and actions are logged
- **Session Management**: Secure session handling

### Admin Features
- **Vehicle Management**: Edit vehicle and driver assignments
- **User Management**: Add/remove users and manage roles
- **Report Generation**: Export activity logs to PDF
- **System Monitoring**: View user activity and system usage

## Setup Instructions

### 1. Google Sheets Setup
1. The system will automatically create required sheets when first run
2. Sheets created:
   - **VehicleMaster**: Vehicle information
   - **DriverMaster**: Driver information
   - **InOutLogs**: Movement logs
   - **Users**: System users
   - **UserActivity**: Login and action logs

### 2. Deploy as Web App
1. Open Google Apps Script editor
2. Copy all files to your project:
   - `code.gs` - Backend code
   - `login.html` - Login page
   - `index.html` - Main dashboard
3. Update the `SPREADSHEET_ID` in `code.gs` with your Google Sheets ID
4. Deploy as Web App:
   - Click "Deploy" > "New Deployment"
   - Choose "Web app" as type
   - Set execute as "Me"
   - Set access to "Anyone" or your organization
   - Click "Deploy"

### 3. Initial Setup
1. First deployment creates default admin account:
   - Username: `admin`
   - Password: `admin123`
   - **Important**: Change this password immediately
2. Add vehicles to VehicleMaster sheet
3. Add drivers to DriverMaster sheet
4. Create additional users in Users sheet

## Data Structure

### VehicleMaster Sheet
| Column | Description |
|--------|-------------|
| Plate Number | Unique vehicle identifier |
| Model | Vehicle model/make |
| Year | Manufacturing year |
| Type | Vehicle type (Car, Truck, etc.) |
| Status | Current status (IN/OUT) |
| Current Driver | Currently assigned driver |
| Assigned Drivers | Comma-separated list of authorized drivers |

### DriverMaster Sheet
| Column | Description |
|--------|-------------|
| Driver ID | Unique driver identifier |
| Name | Driver full name |
| License Number | Driving license number |
| Phone | Contact number |
| Email | Email address |
| Status | Active/Inactive |

### Users Sheet
| Column | Description |
|--------|-------------|
| Username | Login username |
| Password | Login password (plain text - use with caution) |
| Role | User role (admin/user) |
| Email | User email |
| Created Date | Account creation date |

## Usage

### For Regular Users
1. Login with provided credentials
2. View vehicle dashboard
3. Click "Check In" or "Check Out" buttons
4. Enter gate number when prompted
5. Use search/filter to find specific vehicles

### For Administrators
1. All regular user features plus:
2. Edit vehicle assignments (click edit button)
3. View detailed activity logs
4. Export reports
5. Manage users through Google Sheets

## Security Considerations

1. **Password Storage**: Currently stores passwords in plain text. For production use, implement proper hashing
2. **Access Control**: Deploy with appropriate access settings
3. **Data Privacy**: Ensure spreadsheet permissions are properly configured
4. **Regular Audits**: Review UserActivity logs regularly

## Troubleshooting

### Common Issues
1. **"Failed to retrieve data"**: Check spreadsheet ID and permissions
2. **Login failures**: Verify user exists in Users sheet
3. **Missing sheets**: System auto-creates sheets on first run

### Support
For issues or questions, contact your system administrator.

## Future Enhancements
- SMS/Email notifications
- Advanced reporting dashboard
- Mobile app integration
- Barcode/QR code scanning
- Integration with access control systems