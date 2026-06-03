@echo off
REM Run this after restarting terminal/IDE to complete the folder reorganization.
REM These moves were locked during the active session.

SET ROOT=E:\Project\Master

echo Moving agent-coding to Agent group...
if exist "%ROOT%\agent-coding" (
    xcopy "%ROOT%\agent-coding" "%ROOT%\Agent\agent-coding\" /E /H /I /Y /Q
    if %ERRORLEVEL%==0 (
        rmdir /S /Q "%ROOT%\agent-coding"
        echo   Done: agent-coding
    ) else (
        echo   FAILED: agent-coding - check manually
    )
)

echo Moving agent-coding-api-keys to Agent group...
if exist "%ROOT%\agent-coding-api-keys" (
    xcopy "%ROOT%\agent-coding-api-keys" "%ROOT%\Agent\agent-coding-api-keys\" /E /H /I /Y /Q
    if %ERRORLEVEL%==0 (
        rmdir /S /Q "%ROOT%\agent-coding-api-keys"
        echo   Done: agent-coding-api-keys
    ) else (
        echo   FAILED: agent-coding-api-keys - check manually
    )
)

echo Removing locked root copies...
if exist "%ROOT%\packing-list" rmdir /S /Q "%ROOT%\packing-list" && echo   Done: packing-list
if exist "%ROOT%\LinkTreeHL" rmdir /S /Q "%ROOT%\LinkTreeHL" && echo   Done: LinkTreeHL
if exist "%ROOT%\agentai-agency" rmdir /S /Q "%ROOT%\agentai-agency" && echo   Done: agentai-agency (deprecated)

echo.
echo Cleanup complete. Root should now be clean.
echo Final structure:
dir /B "%ROOT%"
