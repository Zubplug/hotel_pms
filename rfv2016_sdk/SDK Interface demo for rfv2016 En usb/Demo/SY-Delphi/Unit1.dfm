object Form1: TForm1
  Left = 210
  Top = 145
  BorderStyle = bsDialog
  Caption = 'ForDemo'
  ClientHeight = 345
  ClientWidth = 794
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -14
  Font.Name = 'MS Sans Serif'
  Font.Style = []
  OldCreateOrder = False
  Position = poDesktopCenter
  PixelsPerInch = 120
  TextHeight = 16
  object Label2: TLabel
    Left = 10
    Top = 10
    Width = 218
    Height = 16
    AutoSize = False
    Caption = 'RoomNo'
  end
  object Label3: TLabel
    Left = 10
    Top = 69
    Width = 109
    Height = 16
    AutoSize = False
    Caption = 'StartTime'
    Font.Charset = ANSI_CHARSET
    Font.Color = clWindowText
    Font.Height = -17
    Font.Name = #23435#20307
    Font.Style = []
    ParentFont = False
  end
  object Label4: TLabel
    Left = 354
    Top = 138
    Width = 120
    Height = 16
    AutoSize = False
    Caption = 'Operator'
  end
  object Label5: TLabel
    Left = 10
    Top = 137
    Width = 90
    Height = 16
    AutoSize = False
    Caption = 'EndTime'
  end
  object Label6: TLabel
    Left = 167
    Top = 138
    Width = 179
    Height = 16
    AutoSize = False
    Caption = 'NewCode(1)Or Old Code(0)'
  end
  object Label1: TLabel
    Left = 10
    Top = 197
    Width = 543
    Height = 16
    AutoSize = False
    Caption = 'Lift Floor'
  end
  object Label8: TLabel
    Left = 807
    Top = 335
    Width = 71
    Height = 16
    AutoSize = False
    Caption = 'Build'
    Visible = False
  end
  object Label9: TLabel
    Left = 866
    Top = 335
    Width = 90
    Height = 16
    AutoSize = False
    Caption = 'Usercode'
    Visible = False
  end
  object Button1: TButton
    Left = 10
    Top = 305
    Width = 80
    Height = 31
    Caption = 'Write Card'
    TabOrder = 0
    OnClick = Button1Click
  end
  object Button2: TButton
    Left = 108
    Top = 305
    Width = 93
    Height = 31
    Caption = 'Read Card'
    TabOrder = 1
    OnClick = Button2Click
  end
  object Button5: TButton
    Left = 207
    Top = 305
    Width = 70
    Height = 31
    Caption = 'Close'
    TabOrder = 2
    OnClick = Button5Click
  end
  object Edit1: TEdit
    Left = 10
    Top = 30
    Width = 149
    Height = 21
    Font.Charset = ANSI_CHARSET
    Font.Color = clWindowText
    Font.Height = -17
    Font.Name = #23435#20307
    Font.Style = []
    ImeName = #20013#25991' ('#31616#20307') - '#25628#29399#25340#38899#36755#20837#27861
    ParentFont = False
    TabOrder = 3
    Text = '1101'
  end
  object Edit2: TEdit
    Left = 10
    Top = 89
    Width = 149
    Height = 21
    Font.Charset = ANSI_CHARSET
    Font.Color = clWindowText
    Font.Height = -17
    Font.Name = #23435#20307
    Font.Style = []
    ImeName = #20013#25991' ('#31616#20307') - '#25628#29399#25340#38899#36755#20837#27861
    ParentFont = False
    TabOrder = 4
    Text = '200903310800'
  end
  object Edit5: TEdit
    Left = 10
    Top = 156
    Width = 149
    Height = 21
    Font.Charset = DEFAULT_CHARSET
    Font.Color = clWindowText
    Font.Height = -17
    Font.Name = #23435#20307
    Font.Style = []
    ImeName = #20013#25991' ('#31616#20307') - '#25628#29399#25340#38899#36755#20837#27861
    ParentFont = False
    TabOrder = 5
    Text = '201512311200'
  end
  object Edit4: TEdit
    Left = 354
    Top = 158
    Width = 149
    Height = 21
    ImeName = #20013#25991' ('#31616#20307') - '#25628#29399#25340#38899#36755#20837#27861
    TabOrder = 6
    Text = '8888'
  end
  object Edit6: TEdit
    Left = 167
    Top = 158
    Width = 149
    Height = 21
    ImeName = #20013#25991' ('#31616#20307') - '#25628#29399#25340#38899#36755#20837#27861
    TabOrder = 7
    Text = '1'
  end
  object Button4: TButton
    Left = 295
    Top = 305
    Width = 93
    Height = 31
    Caption = 'Erase Card'
    TabOrder = 8
    OnClick = Button4Click
  end
  object Edit8: TEdit
    Left = 10
    Top = 217
    Width = 651
    Height = 21
    ImeName = #20013#25991' ('#31616#20307') - '#25628#29399#25340#38899#36755#20837#27861
    TabOrder = 9
    Text = 
      '1+2+3+E+5+6+7+8+9+10+11+12+13+14+15+16+17+18+19+20+21+22+23+24+2' +
      '5+26+27+28+29+30'
  end
  object Edit9: TEdit
    Left = 798
    Top = 354
    Width = 60
    Height = 21
    ImeName = #20013#25991' ('#31616#20307') - '#25628#29399#25340#38899#36755#20837#27861
    TabOrder = 10
    Text = '1'
    Visible = False
  end
  object Edit10: TEdit
    Left = 866
    Top = 354
    Width = 100
    Height = 21
    ImeName = #20013#25991' ('#31616#20307') - '#25628#29399#25340#38899#36755#20837#27861
    TabOrder = 11
    Text = '1234567'
    Visible = False
  end
  object GroupBox1: TGroupBox
    Left = 551
    Top = 10
    Width = 238
    Height = 109
    TabOrder = 12
    object Edit3: TEdit
      Left = 20
      Top = 31
      Width = 149
      Height = 21
      ImeName = #20013#25991' ('#31616#20307') - '#25628#29399#25340#38899#36755#20837#27861
      TabOrder = 0
    end
    object Button3: TButton
      Left = 17
      Top = 69
      Width = 93
      Height = 31
      Caption = 'GetCardID'
      TabOrder = 1
      OnClick = Button3Click
    end
  end
end
