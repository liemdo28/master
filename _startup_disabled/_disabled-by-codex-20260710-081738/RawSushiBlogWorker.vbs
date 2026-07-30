Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d E:\Project\Master\agentai-agency && python apps\worker\blog_worker.py", 0, False
