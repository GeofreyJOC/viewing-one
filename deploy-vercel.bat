@echo off
echo 🚀 Deploying Viewing.One to Vercel...
echo.

echo 📦 Installing Vercel CLI...
call npm install -g vercel

echo.
echo 🔧 Creating deployment...
call vercel --prod

echo.
echo ✅ Deployment complete!
echo 🌐 Visit: https://viewing.one
pause