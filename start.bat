@echo off
cd /d "%~dp0"
echo Wardern - iniciando servidor en http://localhost:8099 ...
start "" http://localhost:8099
python serve.py
