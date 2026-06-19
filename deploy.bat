@echo off
echo.
echo ========================================
echo   DEPLOY - Editor de Croquis Vial
echo ========================================
echo.

echo [1/4] Agregando archivos...
git add .

echo [2/4] Haciendo commit...
git commit -m "deploy: actualizacion"

echo [3/4] Subiendo a GitHub...
git push

echo [4/4] Publicando en GitHub Pages...
npm run deploy

echo.
echo ========================================
echo   Listo! App publicada exitosamente.
echo   https://ausamaps.github.io/croquis_ausa
echo ========================================
echo.
pause
