Write-Host "Building React app..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed!" -ForegroundColor Red; exit 1 }

Write-Host "Packaging for CF..." -ForegroundColor Cyan
Compress-Archive -Path package.json, package-lock.json, xs-app.json, resources -DestinationPath deploy.zip -Force

Write-Host "Deploying to CF..." -ForegroundColor Cyan
cf push -f manifest.yml -p deploy.zip
