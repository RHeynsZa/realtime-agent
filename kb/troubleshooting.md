# Troubleshooting Guide

## Login Issues

### Error: "Invalid credentials"
- Check that Caps Lock is off
- Try resetting your password
- Clear browser cache and cookies

### Error: "Account locked"
- Accounts lock after 5 failed login attempts
- Wait 15 minutes or contact support to unlock

### Two-factor authentication not working
- Ensure your device time is synced correctly
- Use backup codes if you've lost access to your authenticator app
- Contact support with your account email for manual verification

## Performance Issues

### Slow loading times
- Check your internet connection speed (minimum 5 Mbps recommended)
- Try disabling browser extensions
- Clear browser cache

### File upload failures
- Maximum file size: 5GB
- Supported formats: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, GIF, MP4
- Check available storage in Settings > Storage

### Sync not working
- Ensure you're connected to the internet
- Check if sync is paused in Settings > Sync
- Try signing out and back in

## Mobile App Issues

### App crashing
- Update to the latest version from App Store or Google Play
- Restart your device
- Reinstall the app if issues persist

### Notifications not working
- Check notification permissions in device settings
- Ensure Do Not Disturb is disabled
- Verify notifications are enabled in app Settings > Notifications

## Integration Issues

### Slack integration not connecting
- Ensure you have admin permissions in your Slack workspace
- Disconnect and reconnect the integration
- Check that the Slack app is approved by your IT admin

### API rate limits
- Basic: 100 requests per minute
- Pro: 1,000 requests per minute
- Enterprise: 10,000 requests per minute
- Implement exponential backoff for rate limit errors
