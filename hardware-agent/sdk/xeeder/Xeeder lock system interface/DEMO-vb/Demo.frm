VERSION 5.00
Object = "{248DD890-BB45-11CF-9ABC-0080C7E7B78D}#1.0#0"; "MSWINSCK.OCX"
Begin VB.Form Form1 
   BorderStyle     =   3  'Fixed Dialog
   Caption         =   "Demo :"
   ClientHeight    =   5280
   ClientLeft      =   45
   ClientTop       =   330
   ClientWidth     =   11820
   LinkTopic       =   "Form1"
   MaxButton       =   0   'False
   MinButton       =   0   'False
   ScaleHeight     =   5280
   ScaleWidth      =   11820
   StartUpPosition =   3  'Windows Default
   Begin VB.CommandButton Command3 
      Caption         =   "Disconnection"
      Height          =   735
      Left            =   6720
      TabIndex        =   8
      Top             =   240
      Width           =   1455
   End
   Begin VB.CommandButton Command2 
      Caption         =   "Send"
      Height          =   375
      Left            =   240
      TabIndex        =   6
      Top             =   2280
      Width           =   975
   End
   Begin VB.TextBox Text4 
      Height          =   375
      Left            =   2160
      ScrollBars      =   2  'Vertical
      TabIndex        =   7
      Top             =   2880
      Width           =   8415
   End
   Begin VB.TextBox Text3 
      Height          =   375
      Left            =   2160
      TabIndex        =   5
      Text            =   "00000I|R101,102,103,104|T04|D201003261702|O201003291800"
      Top             =   2280
      Width           =   8415
   End
   Begin VB.CommandButton Command1 
      Caption         =   "Connection"
      Height          =   735
      Left            =   4680
      TabIndex        =   4
      Top             =   240
      Width           =   1455
   End
   Begin VB.TextBox Text2 
      Height          =   375
      Left            =   2160
      TabIndex        =   2
      Text            =   "7800"
      Top             =   600
      Width           =   1935
   End
   Begin VB.TextBox Text1 
      Height          =   375
      Left            =   2160
      TabIndex        =   0
      Text            =   "127.0.0.1"
      Top             =   120
      Width           =   1935
   End
   Begin MSWinsockLib.Winsock Winsock1 
      Left            =   9600
      Top             =   120
      _ExtentX        =   741
      _ExtentY        =   741
      _Version        =   393216
   End
   Begin VB.Label Label3 
      Caption         =   "Received string"
      Height          =   255
      Index           =   4
      Left            =   240
      TabIndex        =   13
      Top             =   3000
      Width           =   1215
   End
   Begin VB.Label Label3 
      Caption         =   "ETX"
      Height          =   255
      Index           =   3
      Left            =   10680
      TabIndex        =   12
      Top             =   2400
      Width           =   495
   End
   Begin VB.Label Label3 
      Caption         =   "ETX"
      Height          =   255
      Index           =   2
      Left            =   10680
      TabIndex        =   11
      Top             =   3000
      Width           =   495
   End
   Begin VB.Label Label3 
      Caption         =   "STX"
      Height          =   255
      Index           =   1
      Left            =   1680
      TabIndex        =   10
      Top             =   3000
      Width           =   375
   End
   Begin VB.Label Label3 
      Caption         =   "STX"
      Height          =   255
      Index           =   0
      Left            =   1680
      TabIndex        =   9
      Top             =   2400
      Width           =   495
   End
   Begin VB.Label Label2 
      Caption         =   " Port :"
      Height          =   255
      Left            =   840
      TabIndex        =   3
      Top             =   600
      Width           =   1095
   End
   Begin VB.Label Label1 
      Caption         =   "IP Address"
      Height          =   255
      Left            =   840
      TabIndex        =   1
      Top             =   120
      Width           =   975
   End
End
Attribute VB_Name = "Form1"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit
Dim IsConnectionOpen As Boolean

Private Sub Command1_Click()
On Error GoTo er
    Winsock1.RemoteHost = Text1.Text
    Winsock1.RemotePort = CLng(Text2.Text)
    Winsock1.Connect
    Command1.Enabled = False
    Exit Sub
er:
    Winsock1.Close
    MsgBox "connect failed!", vbOKOnly, "Demo"
End Sub

Private Sub Command2_Click()
    Dim s, stmp As String
    Dim bySend() As Byte
    Dim byTemp() As Byte
    Dim tmp() As Byte
    Dim i As Integer
    
    Command2.Enabled = False
    Text4.Text = ""
    If IsConnectionOpen = False Then
        MsgBox "No connection!", vbOKOnly, "Demo"
    Else
        
    ReDim Preserve bySend(Len(Text3) + 1)
    ReDim Preserve byTemp(Len(Text3) * 3)
    byTemp = Text3
    For i = 0 To Len(Text3) - 1
        bySend(1 + i) = byTemp(i * 2)
    Next i
    bySend(0) = 2
    bySend(Len(Text3) + 1) = 3
    Winsock1.SendData bySend
    End If
End Sub

Private Sub Command3_Click()
    Command3.Enabled = False
    Command1.Enabled = True
    Command2.Enabled = False
    Text4.Text = ""
    Text3.Text = ""
    Form1.Caption = "not connected"
    Winsock1.Close
End Sub

Private Sub Form_Load()
    Command3.Enabled = False
    Command2.Enabled = False
    Form1.Caption = "not connected"
End Sub

Private Sub Form_Unload(Cancel As Integer)
    Winsock1.Close
End Sub

Private Sub Winsock1_Close()
    Caption = "Demo : disconnected ."
    IsConnectionOpen = False
End Sub

Private Sub Winsock1_Connect()
    Caption = "Demo : connected ."
    Command1.Enabled = False
    Command2.Enabled = True
    Command3.Enabled = True
    IsConnectionOpen = True
End Sub

Private Sub Winsock1_DataArrival(ByVal bytesTotal As Long)
    Dim str As String
    str = ""
    Winsock1.GetData str
    Text4.Text = str
    Text4.SelStart = Len(Text4.Text)
    Command2.Enabled = True
End Sub

Private Sub Winsock1_Error(ByVal Number As Integer, Description As String, ByVal Scode As Long, ByVal Source As String, ByVal HelpFile As String, ByVal HelpContext As Long, CancelDisplay As Boolean)
    Winsock1.Close
    MsgBox "connect failed!", vbOKOnly, "Demo"
    Command1.Enabled = True
    Number = 0
End Sub
