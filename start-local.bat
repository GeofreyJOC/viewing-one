@echo off
echo ============================================
echo 🏠 Viewing.One - Local Development Server
echo ============================================
echo.
echo Starting local development environment...
echo.
echo Domain: viewing.one (to be registered)
echo Local URL: http://localhost:3000
echo Admin: http://localhost:3000/admin.html
echo.
echo Email workflow:
echo - listings@viewing.one (property submissions)
echo - feedback@viewing.one (bug reports)
echo.
echo ============================================
echo Starting server...
echo ============================================
timeout /t 2 /nobreak > nul

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

REM Start the server
node server.js