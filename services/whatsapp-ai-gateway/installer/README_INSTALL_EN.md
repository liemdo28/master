# WhatsApp AI Gateway Windows Installer

## Before installing

- Windows 10 or Windows 11
- Internet connection is not required for installation
- Node.js is bundled with this installer
- Chrome is bundled with this installer
- Google service account file is required for Google Sheets
- WhatsApp phone is required to scan the QR code

## Install

1. Unzip `whatsapp-ai-gateway-windows-installer.zip`.
2. Open the `installer` folder.
3. Double-click `Install WhatsApp AI Gateway.bat`.
4. Follow the screen instructions.
5. Put `google-service-account.json` in `secrets\google-service-account.json` when prompted.
6. Scan the WhatsApp QR code when the gateway starts.
7. Open the dashboard.

## After install

- Dashboard: http://localhost:3210
- Install folder: `%USERPROFILE%\Bakudan\whatsapp-ai-gateway`
- Config file: `%USERPROFILE%\Bakudan\whatsapp-ai-gateway\.env`
- Google credentials: `%USERPROFILE%\Bakudan\whatsapp-ai-gateway\secrets\google-service-account.json`
- Logs folder: `%USERPROFILE%\Bakudan\whatsapp-ai-gateway\logs`
- Desktop shortcuts:
  - Start Gateway
  - Stop Gateway
  - Open Dashboard
  - Gateway Status

The installer also creates a Windows auto-start task named `WhatsApp AI Gateway`.

## Update existing install

If the install folder already exists, the installer asks before updating. It backs up `.env` and `secrets` before overwriting files.

## Troubleshooting

- If the installer says the bundled runtime is missing, use the complete installer zip.
- If the dashboard does not open, double-click `Gateway Status` on the desktop.
- If WhatsApp is not ready, open the dashboard and scan the QR code.
