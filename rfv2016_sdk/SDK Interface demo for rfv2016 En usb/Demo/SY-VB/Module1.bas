Attribute VB_Name = "Module1"
Option Explicit
Public Declare Function W_Card Lib "RFV2007NETHOTEL.dll" (ByVal nRoom As String, _
ByVal Wstartdate As String, ByVal Wenddate As String, _
ByVal Op As String, ByVal nCode As String, ByVal jlift As String) As Integer
Public Declare Function R_Card Lib "RFV2007NETHOTEL.dll" (ByVal i_dispaly As Integer) As String
Public Declare Function R_CardID Lib "RFV2007NETHOTEL.dll" (ByVal i_dispaly As Integer) As String
Public Declare Function Getcardid Lib "RFV2007NETHOTEL.dll" (ByVal IntnPort As String) As String
Public Declare Function Woff_Card Lib "RFV2007NETHOTEL.dll" () As Integer
Global aint As Integer
