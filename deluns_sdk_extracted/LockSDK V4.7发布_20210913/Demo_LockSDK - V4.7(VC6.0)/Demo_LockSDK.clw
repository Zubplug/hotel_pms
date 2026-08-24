; CLW file contains information for the MFC ClassWizard

[General Info]
Version=1
LastClass=CDemo_LockSDKDlg
LastTemplate=CDialog
NewFileInclude1=#include "stdafx.h"
NewFileInclude2=#include "Demo_LockSDK.h"

ClassCount=3
Class1=CDemo_LockSDKApp
Class2=CDemo_LockSDKDlg

ResourceCount=2
Resource1=IDR_MAINFRAME
Class3=CDlgHelp
Resource2=IDD_Demo_LockSDK_DIALOG

[CLS:CDemo_LockSDKApp]
Type=0
HeaderFile=Demo_LockSDK.h
ImplementationFile=Demo_LockSDK.cpp
Filter=N

[CLS:CDemo_LockSDKDlg]
Type=0
HeaderFile=Demo_LockSDKDlg.h
ImplementationFile=Demo_LockSDKDlg.cpp
Filter=D
LastObject=IDC_CHK_REPLACE
BaseClass=CDialog
VirtualFilter=dWC



[DLG:IDD_Demo_LockSDK_DIALOG]
Type=1
Class=CDemo_LockSDKDlg
ControlCount=16
Control1=IDC_RD_LOCK_TYPE,button,1342308361
Control2=IDC_RD_LOCK_TYPE2,button,1342177289
Control3=IDC_BN_CONFIG,button,1342242816
Control4=IDC_BN_CHECKIN,button,1476460544
Control5=IDC_BN_CHECKOUT,button,1476460544
Control6=IDC_ED_ROOM_NO,edit,1350631552
Control7=IDC_STATIC_2,static,1342308864
Control8=IDC_ED_CHECKIN_TIME,edit,1350631552
Control9=IDC_STATIC_3,static,1342308864
Control10=IDC_ED_CHECKOUT_TIME,edit,1350631552
Control11=IDC_BN_READ_CARD,button,1476460544
Control12=IDC_STATIC_1,static,1342308352
Control13=IDC_BN_CHECKINTIME,button,1342242816
Control14=IDC_CHK_REPLACE,button,1342242819
Control15=IDC_CHK_CHECKIN_TIME,button,1342242819
Control16=IDC_CHK_OPEN_BLOCK,button,1342242819

[CLS:CDlgHelp]
Type=0
HeaderFile=DlgHelp.h
ImplementationFile=DlgHelp.cpp
BaseClass=CDialog
Filter=D
LastObject=CDlgHelp

