' start-silent.vbs — launches Mi Ultimate start.bat without console window
' Placed in Windows Startup folder by autostart-install.bat

Dim shell
Set shell = CreateObject("WScript.Shell")
shell.Run "cmd /c ""E:\Project\Master\mi-core\start.bat""", 0, False
Set shell = Nothing
