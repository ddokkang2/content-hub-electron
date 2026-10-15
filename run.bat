@echo off
set ELECTRON_DISABLE_GPU=1
set ELECTRON_DISABLE_SANDBOX=1
npx electron . --disable-gpu --disable-gpu-sandbox --no-sandbox --in-process-gpu --disable-software-rasterizer
