Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the directory where the script is located
strScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Set the current directory to the script's folder
WshShell.CurrentDirectory = strScriptDir

' Set the target wrapper absolute path
strWrapperPath = "backend\scripts\start_wrapper.bat"
strFullWrapperPath = fso.BuildPath(strScriptDir, strWrapperPath)

' Check if wrapper exists to avoid failure
If fso.FileExists(strFullWrapperPath) Then
    ' Run silently (0 = hidden window, False = don't wait)
    WshShell.Run "cmd /c """ & strFullWrapperPath & """", 0, False
Else
    MsgBox "Error: Could not find startup file at " & strFullWrapperPath & vbCrLf & vbCrLf & "Please make sure the backend\scripts\start_wrapper.bat file exists.", 16, "Startup Error"
    WScript.Quit
End If

' Wait 8 seconds for the backend to initialize
WScript.Sleep 8000

' Open the frontend in the default browser via the backend server
WshShell.Run "http://localhost:8000"