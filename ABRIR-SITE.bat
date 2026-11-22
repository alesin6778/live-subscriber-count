@echo off
setlocal
title Live Subscriber Count - servidor local
cd /d "%~dp0"

set "PORT=8080"
set "URL_LIVE=http://127.0.0.1:%PORT%/index.html"
set "URL_OBS=http://127.0.0.1:%PORT%/index.html?obs=1"
set "URL_CTRL=http://127.0.0.1:%PORT%/controle.html"

rem --- Python disponivel? (o atalho falso da Microsoft Store falha neste teste) ---
python --version >nul 2>nul
if errorlevel 1 goto SEM_PYTHON

echo.
echo   Servidor local do Live Subscriber Count
echo.
echo   LIVE (voce, com a engrenagem):   %URL_LIVE%
echo   FONTE DO OBS (nada aparece):     %URL_OBS%
echo   CONTROLE (durante a live):       %URL_CTRL%
echo.
echo   Deixe a janela minimizada "Live Subscriber Count - servidor" aberta.
echo   Para encerrar o site, feche aquela janela.
echo.

rem --- servidor local, so acessivel nesta maquina ---
start "Live Subscriber Count - servidor" /min cmd /c "python -m http.server %PORT% --bind 127.0.0.1"

rem --- espera ~2s e abre a live (engrenagem) e o painel de controle ---
ping -n 3 127.0.0.1 >nul
start "" "%URL_LIVE%"
ping -n 2 127.0.0.1 >nul
start "" "%URL_CTRL%"

ping -n 5 127.0.0.1 >nul
exit /b 0

:SEM_PYTHON
echo.
echo   Python nao encontrado neste computador.
echo   Abrindo os arquivos direto no navegador (o painel externo precisa do servidor)...
echo.
start "" "%~dp0index.html"
ping -n 4 127.0.0.1 >nul
exit /b 0
