Imports System.Text
Public Class Language 
    Dim g_szCurPath As String
    Dim g_szLanguagePath As String
    '    /// <summary>
    '    /// 取得语言资源文件的路径
    '    /// </summary>
    Public Sub GetLanguagePath_Ex()
        Dim sldefault As String = ""
        g_szCurPath = Application.StartupPath  
        'Dim sLan As String = ""
        'sLan = GetINI("System", "Language", sldefault, g_szCurPath + "\\Config.ini")
        'If sLan = "" Then 
        '    sLan = "Chinese"
        'End If
        g_szLanguagePath = g_szCurPath + "\\ToolsLanguage.ini"
    End Sub

    '     /// <summary>
    '     /// 根据标识szID到选定的语言文件中加载字符串
    '     /// </summary>
    '    /// <param name="szID"></param>
    '    /// <returns></returns>
    Public Function g_LoadString_Ex(ByVal szID As String) As String

        Dim szValue As String = ""
        Dim sldefault As String = ""
        If g_szLanguagePath = "" Then
            GetLanguagePath_Ex()
        End If
        szValue = GetINI("String", szID, sldefault, g_szLanguagePath)
        If szValue = "" Then
            szValue = "Not found"
        Else
            szValue.Replace("\\n", "\n") '//替换回换行符号
        End If
        Return szValue
    End Function

    '      /// <summary>
    '     /// 当对话框运行时获取其所有可得到的字符串，并保存到语言文件中
    '    ///	每个控件用对话框ID和控件ID唯一标识
    '    /// </summary>
    '    /// <param name="frm"></param>
    Public Sub g_SetFormStrings_Ex(ByVal frm As Form)

        Dim szSection As String = "LockSDKDemo"
        Dim szKey As String
        Dim szText As String
        Dim bSetText As Boolean = True '//true,从文件中读，设置窗口；false:从对话框读保存到文件
        Dim c1 As Control
        If g_szLanguagePath = "" Then
            GetLanguagePath_Ex()
        End If 

        If bSetText Then '//从文件中读，设置对话框
            Dim szDefault As String
            Dim sldefault As String = ""
            '   //读窗口标题
            szKey = frm.Name + "_Title"

            szDefault = GetINI(szSection, szKey, sldefault, g_szLanguagePath)
            If szDefault = "" Then

                szDefault = "Not found"

            Else

                szDefault.Replace("\\n", "\n") '//替换回换行符号
            End If
            frm.Text = szDefault

            '//写入各个字控件标题
            For Each c1 In frm.Controls

                szKey = c1.Name ' frm.Name + "_" + c1.Name
                szText = GetINI(szSection, szKey, sldefault, g_szLanguagePath)
                c1.Text = szText
            Next

        Else '//从窗口保存到文件
            '//写入窗口标题
            szKey = frm.Name + "_Title"
            szText = frm.Text
            '            Writue(szSection, szKey, szText, g_szLanguagePath)

            '   //写入各个子控件的标题文字
            For Each c1 In frm.Controls

                szKey = frm.Name + "_" + c1.Name
                szText = c1.Text
                '  Writue(szSection, szKey, szText, g_szLanguagePath)
            Next
        End If
    End Sub
 

    ''  // 声明INI文件的写操作函数 WritePrivateProfileString() 
    'Declare Function WritePrivateProfileString Lib "kernel32.dll" (ByVal section As String, ByVal key As String, ByVal val As String, ByVal filePath As String)

    '' // 声明INI文件的读操作函数 GetPrivateProfileString()

    'Declare Function GetPrivateProfileString Lib "kernel32.dll" (ByVal section As String, ByVal key As String, ByVal def As String, ByVal retVal As StringBuilder, ByVal size As Integer, ByVal filePath As String)



    'Public Sub Writue(ByVal section As String, ByVal key As String, ByVal value As String, ByVal sPath As String)
    '    ' section=配置节，key=键名，value=键值，path=路径
    '    WritePrivateProfileString(section, key, value, sPath)
    'End Sub
    'Public Function ReadValue(ByVal section As String, ByVal key As String, ByVal sPath As String) As String
    '    '            // 每次从ini中读取多少字节
    '    Dim temp As StringBuilder = New StringBuilder

    '    '   System.Text.StringBuilder temp = new System.Text.StringBuilder(255);
    '    '           // section=配置节，key=键名，temp=上面，path=路径
    '    GetPrivateProfileString(section, key, "", temp, 255, sPath)
    '    ReadValue = temp.ToString()
    'End Function
    Private Declare Function GetPrivateProfileString Lib "kernel32" Alias "GetPrivateProfileStringA" (ByVal lpApplicationName As String, ByVal lpKeyName As String, ByVal lpDefault As String, ByVal lpReturnedString As String, ByVal nSize As Int32, ByVal lpFileName As String) As Int32
    Private Declare Function WritePrivateProfileString Lib "kernel32" Alias "WritePrivateProfileStringA" (ByVal lpApplicationName As String, ByVal lpKeyName As String, ByVal lpString As String, ByVal lpFileName As String) As Int32

    '定義讀取配置檔函數
    Public Function GetINI(ByVal Section As String, ByVal AppName As String, ByVal lpDefault As String, ByVal FileName As String) As String
        Dim Str As String = LSet(Str, 256)
        GetPrivateProfileString(Section, AppName, lpDefault, Str, Len(Str), FileName)
        Return Microsoft.VisualBasic.Left(Str, InStr(Str, Chr(0)) - 1)
    End Function
    '定義寫入配置檔函數
    Public Function WriteINI(ByVal Section As String, ByVal AppName As String, ByVal lpDefault As String, ByVal FileName As String) As Long
        WriteINI = WritePrivateProfileString(Section, AppName, lpDefault, FileName)
    End Function
End Class

