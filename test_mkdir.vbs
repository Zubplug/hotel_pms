On Error Resume Next
Dim fso
Set fso = CreateObject("Scripting.FileSystemObject")
fso.CreateFolder ".\TestDir\"
If Err.Number <> 0 Then
    WScript.Echo "FSO Error: " & Err.Number & " - " & Err.Description
End If
Err.Clear
