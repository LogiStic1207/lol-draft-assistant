@echo off
SET DIR=%~dp0
"%DIR%node_modules\electron\dist\electron.exe" "%DIR%." %*
