@echo off
chcp 65001 >nul
title Assistant Jeedom
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe sur cet ordinateur.
  echo Executer : winget install OpenJS.NodeJS.LTS --accept-package-agreements dans un PowerShell administrateur puis relancez ce fichier.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Premiere utilisation : installation des dépendances en cours...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo L'installation a echoue. Verifiez la connexion internet puis relancez.
    pause
    exit /b 1
  )
)

echo Demarrage de l'assistant Jeedom...
call npm start

echo.
echo L'assistant est arrete. Vous pouvez fermer cette fenetre.
pause
