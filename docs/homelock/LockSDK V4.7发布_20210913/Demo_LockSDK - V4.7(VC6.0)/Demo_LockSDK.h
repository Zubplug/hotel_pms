// Demo_LockSDK.h : main header file for the Demo_LockSDK application
//

#if !defined(AFX_Demo_LockSDK_H__473B082C_DB9C_45D1_9FB4_3C37BFD8064D__INCLUDED_)
#define AFX_Demo_LockSDK_H__473B082C_DB9C_45D1_9FB4_3C37BFD8064D__INCLUDED_

#if _MSC_VER > 1000
#pragma once
#endif // _MSC_VER > 1000

#ifndef __AFXWIN_H__
	#error include 'stdafx.h' before including this file for PCH
#endif

#include "resource.h"		// main symbols

/////////////////////////////////////////////////////////////////////////////
// CDemo_LockSDKApp:
// See Demo_LockSDK.cpp for the implementation of this class
//

class CDemo_LockSDKApp : public CWinApp
{
public:
	CDemo_LockSDKApp();

// Overrides
	// ClassWizard generated virtual function overrides
	//{{AFX_VIRTUAL(CDemo_LockSDKApp)
	public:
	virtual BOOL InitInstance();
	//}}AFX_VIRTUAL

// Implementation

	//{{AFX_MSG(CDemo_LockSDKApp)
		// NOTE - the ClassWizard will add and remove member functions here.
		//    DO NOT EDIT what you see in these blocks of generated code !
	//}}AFX_MSG
	DECLARE_MESSAGE_MAP()
};


/////////////////////////////////////////////////////////////////////////////

//{{AFX_INSERT_LOCATION}}
// Microsoft Visual C++ will insert additional declarations immediately before the previous line.

#endif // !defined(AFX_Demo_LockSDK_H__473B082C_DB9C_45D1_9FB4_3C37BFD8064D__INCLUDED_)
