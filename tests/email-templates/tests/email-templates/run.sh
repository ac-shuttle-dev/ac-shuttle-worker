#!/bin/bash

# Email Template Preview Generator
# Generates HTML previews of all email templates for visual testing

echo "🎫 AC Shuttles Email Template Preview Generator"
echo "=============================================="
echo ""

# Check if we're in the right directory
if [ ! -f "generatePreviews.cjs" ]; then
    echo "❌ Error: Please run this script from the tests/email-templates directory"
    echo "   Usage: cd tests/email-templates && ./run.sh"
    exit 1
fi

# Generate the previews
echo "📧 Generating email template previews..."
node generatePreviews.cjs

# Check if successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✨ Success! Email previews generated in the previews/ directory"
    echo ""
    echo "🌐 To view the previews:"
    echo "   Open: $(pwd)/previews/index.html"
    echo ""
    echo "📱 Individual preview files:"
    echo "   • Owner Notification: $(pwd)/previews/owner-notification.html"
    echo "   • Customer Confirmation: $(pwd)/previews/customer-confirmation.html" 
    echo "   • Customer Denial: $(pwd)/previews/customer-denial.html"
    echo ""
    echo "💡 Tip: Open the index.html file in your browser to see all templates"
else
    echo ""
    echo "❌ Error generating previews. Check the output above for details."
    exit 1
fi