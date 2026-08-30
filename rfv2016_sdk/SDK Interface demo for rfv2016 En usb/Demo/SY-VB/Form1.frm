VERSION 5.00
Begin VB.Form ForSY540EDemo 
   Caption         =   "Demo"
   ClientHeight    =   3864
   ClientLeft      =   60
   ClientTop       =   348
   ClientWidth     =   7992
   BeginProperty Font 
      Name            =   "ËÎÌו"
      Size            =   9
      Charset         =   0
      Weight          =   400
      Underline       =   0   'False
      Italic          =   0   'False
      Strikethrough   =   0   'False
   EndProperty
   LinkTopic       =   "Form1"
   ScaleHeight     =   3864
   ScaleWidth      =   7992
   StartUpPosition =   2  'CenterScreen
   Begin VB.Frame Frame1 
      Height          =   1575
      Left            =   5520
      TabIndex        =   20
      Top             =   2160
      Width           =   2415
      Begin VB.TextBox Text9 
         Height          =   375
         Left            =   240
         TabIndex        =   22
         Top             =   360
         Width           =   1455
      End
      Begin VB.CommandButton Command1 
         Caption         =   "Get CardID"
         Height          =   375
         Left            =   240
         TabIndex        =   21
         Top             =   960
         Width           =   1572
      End
   End
   Begin VB.TextBox Text12 
      Height          =   375
      Left            =   8880
      TabIndex        =   18
      Text            =   "1234567"
      Top             =   4200
      Visible         =   0   'False
      Width           =   1455
   End
   Begin VB.TextBox Text11 
      Height          =   375
      Left            =   7320
      TabIndex        =   16
      Text            =   "1"
      Top             =   4200
      Visible         =   0   'False
      Width           =   1455
   End
   Begin VB.TextBox Text10 
      Height          =   375
      Left            =   120
      TabIndex        =   14
      Text            =   "1+2+3+E+5+6+7+8+9+10+11+12+13+14+15+16+17+18+19+20+21+22+23+24+25+26+27+28+29+30"
      Top             =   1680
      Width           =   7815
   End
   Begin VB.CommandButton Command2 
      Caption         =   "Erase Card"
      Height          =   375
      Left            =   3600
      TabIndex        =   13
      Top             =   2160
      Width           =   975
   End
   Begin VB.TextBox Text8 
      Height          =   375
      Left            =   1440
      TabIndex        =   7
      Text            =   "1"
      Top             =   960
      Width           =   1455
   End
   Begin VB.TextBox Text7 
      Height          =   375
      Left            =   120
      TabIndex        =   6
      Text            =   "99"
      Top             =   960
      Width           =   1095
   End
   Begin VB.TextBox Text4 
      Height          =   375
      Left            =   4200
      TabIndex        =   5
      Text            =   "201512301200"
      Top             =   240
      Width           =   1455
   End
   Begin VB.TextBox Text3 
      Height          =   375
      Left            =   1920
      TabIndex        =   4
      Text            =   "200801301200"
      Top             =   240
      Width           =   1455
   End
   Begin VB.TextBox Text2 
      Height          =   375
      Left            =   120
      TabIndex        =   3
      Text            =   "1101"
      Top             =   240
      Width           =   1455
   End
   Begin VB.CommandButton Command20 
      Caption         =   "Read Card"
      Height          =   375
      Left            =   1440
      TabIndex        =   2
      Top             =   2160
      Width           =   975
   End
   Begin VB.CommandButton Command19 
      Caption         =   "Close"
      Height          =   375
      Left            =   2520
      TabIndex        =   1
      Top             =   2160
      Width           =   975
   End
   Begin VB.CommandButton Command18 
      Caption         =   "Write Card"
      Height          =   375
      Left            =   120
      TabIndex        =   0
      Top             =   2160
      Width           =   1215
   End
   Begin VB.Label Label11 
      Caption         =   "User code"
      Height          =   255
      Left            =   8880
      TabIndex        =   19
      Top             =   3960
      Visible         =   0   'False
      Width           =   1575
   End
   Begin VB.Label Label10 
      Caption         =   "Build"
      Height          =   255
      Left            =   7320
      TabIndex        =   17
      Top             =   3960
      Visible         =   0   'False
      Width           =   1575
   End
   Begin VB.Label Label9 
      Caption         =   "Lift Floor"
      Height          =   255
      Left            =   120
      TabIndex        =   15
      Top             =   1440
      Width           =   6855
   End
   Begin VB.Label Label8 
      Caption         =   "NewCode(1)Or OldCode(0))"
      Height          =   255
      Left            =   1440
      TabIndex        =   12
      Top             =   720
      Width           =   2535
   End
   Begin VB.Label Label7 
      Caption         =   "Operator"
      Height          =   255
      Left            =   120
      TabIndex        =   11
      Top             =   720
      Width           =   1455
   End
   Begin VB.Label Label4 
      Caption         =   "EndTime"
      Height          =   255
      Left            =   4200
      TabIndex        =   10
      Top             =   0
      Width           =   2295
   End
   Begin VB.Label Label3 
      Caption         =   "StartTime"
      Height          =   255
      Left            =   1920
      TabIndex        =   9
      Top             =   0
      Width           =   2055
   End
   Begin VB.Label Label2 
      Caption         =   "RoomNo"
      Height          =   255
      Left            =   120
      TabIndex        =   8
      Top             =   0
      Width           =   1575
   End
End
Attribute VB_Name = "ForSY540EDemo"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Private Sub Command1_Click()
astr = R_CardID(1)
Text9.Text = astr

End Sub

Private Sub Command18_Click()
nRoom = Trim(Text2.Text)
Wstartdate = Trim(Text3.Text): Wenddate = Trim(Text4.Text)
Op = Trim(Text7.Text): nCode = Trim(Text8.Text)
jlift = Trim(Text10.Text)
aint = W_Card(nRoom, Wstartdate, Wenddate, Op, nCode, jlift)
If aint = 1 Then
  MsgBox "OK     Return Values:" & aint, vbInformation, "Info"
Else
  MsgBox "Fail   Return Values:" + Trim(aint), vbExclamation, "Info"
End If

End Sub

Private Sub Command19_Click()
End

End Sub

Private Sub Command2_Click()
aint = Woff_Card()
If aint = 1 Then
  MsgBox "Erase card ok     ", vbInformation, "Info"
Else
  MsgBox "Erase card fail   return value:" + Trim(aint), vbExclamation, "Info"
End If

End Sub

Private Sub Command20_Click()
astr = R_Card(1)
MsgBox astr, vbInformation, "Info"

End Sub

