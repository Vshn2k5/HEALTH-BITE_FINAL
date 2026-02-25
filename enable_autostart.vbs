
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script is located
strScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
strTargetScript = fso.BuildPath(strScriptDir, "start_silent.vbs")

' Define startup folder path
strStartupFolder = WshShell.SpecialFolders("Startup")
strShortcutPath = fso.BuildPath(strStartupFolder, "HealthBite Autostart.lnk")

' Create the shortcut
Set oShortcut = WshShell.CreateShortcut(strShortcutPath)
oShortcut.TargetPath = "wscript.exe"
oShortcut.Arguments = """" & strTargetScript & """"
oShortcut.WorkingDirectory = strScriptDir
oShortcut.WindowStyle = 7 ' Minimized
oShortcut.Description = "Auto-start HealthBite Smart Canteen"
oShortcut.IconLocation = "shell32.dll, 14"
oShortcut.Save

MsgBox "Success! HealthBite will now start automatically when you log in." & vbCrLf & _
       "Shortcut created at: " & strShortcutPath, 64, "Autostart Enabled"
