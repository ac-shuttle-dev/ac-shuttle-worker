# Email Templates Test Suite

This directory contains test scripts for visualizing and testing the AC Shuttles email templates.

## Quick Start

Generate HTML previews of all email templates:

```bash
cd tests/email-templates
node generatePreviews.cjs
```

Or use the convenient shell script:

```bash
cd tests/email-templates
./run.sh
```

This will create a `previews/` directory with HTML files you can open in your browser.

## Generated Files

After running the script, you'll get:

- `previews/index.html` - Overview page with links to all templates
- `previews/owner-notification.html` - Business owner notification email
- `previews/customer-confirmation.html` - Customer booking confirmation
- `previews/customer-denial.html` - Customer booking denial

## Features

### 🎫 Ticket Card Design
All templates use a realistic airline-style ticket design with:
- Professional perforated edges
- Location codes (DTWN → LAX)
- Clear information hierarchy
- Mobile-responsive layout

### 📱 Cross-Platform Testing
Templates are designed to work across:
- Gmail (desktop & mobile)
- Outlook (desktop & mobile)
- Apple Mail
- Other major email clients

### 🎨 Visual Styling
- **Owner notifications**: Teal/green theme with action buttons
- **Confirmations**: Green success theme with driver details
- **Denials**: Red/gray theme with alternative options

## Sample Data

The test uses realistic sample data including:
- Long addresses with suite numbers
- Multiple passenger bookings
- Special instructions and notes
- Driver contact information
- Alternative contact options

## File Structure

```
tests/email-templates/
├── README.md               # This file
├── generatePreviews.cjs    # Main preview generator
├── mockTemplates.cjs       # JavaScript versions of templates
├── run.sh                  # Convenient shell script
└── previews/               # Generated HTML files (after running)
    ├── index.html
    ├── owner-notification.html
    ├── customer-confirmation.html
    └── customer-denial.html
```

## Development Notes

The `mockTemplates.cjs` file contains JavaScript implementations of the TypeScript email templates. This allows the Node.js preview generator to work without requiring TypeScript compilation.

When you update the actual email templates in `src/templates/emails/`, make sure to update the mock templates as well if you want the previews to reflect your changes.