// Demo_LockSDKDlg.h : header file
//

#if !defined(AFX_Demo_LockSDKDLG_H__54B70D59_747A_4704_8206_8AFFE9C666A0__INCLUDED_)
#define AFX_Demo_LockSDKDLG_H__54B70D59_747A_4704_8206_8AFFE9C666A0__INCLUDED_

#if _MSC_VER > 1000
#pragma once
#endif // _MSC_VER > 1000

/////////////////////////////////////////////////////////////////////////////
// CDemo_LockSDKDlg dialog

class CDemo_LockSDKDlg : public CDialog
{
// Construction
public:
	CDemo_LockSDKDlg(CWnd* pParent = NULL);	// standard constructor
    void CheckErr(int st);    //¼ì²âº¯Êý

// Dialog Data
	//{{AFX_DATA(CDemo_LockSDKDlg)
	enum { IDD = IDD_Demo_LockSDK_DIALOG };
	CString	m_strCheckinTime;
	CString	m_strCheckoutTime;
	CString	m_strRoomNo;
	int		m_iLockType;
	BOOL	m_fReplaceEn;
	BOOL	m_fChkCheckInTimeEn;
	BOOL	m_fAllowOpenBlock;
	//}}AFX_DATA

	// ClassWizard generated virtual function overrides
	//{{AFX_VIRTUAL(CDemo_LockSDKDlg)
	protected:
	virtual void DoDataExchange(CDataExchange* pDX);	// DDX/DDV support
	//}}AFX_VIRTUAL

// Implementation
protected:
	HICON m_hIcon;

	// Generated message map functions
	//{{AFX_MSG(CDemo_LockSDKDlg)
	virtual BOOL OnInitDialog();
	afx_msg void OnPaint();
	afx_msg HCURSOR OnQueryDragIcon();
	afx_msg void OnBnConfig();
	afx_msg void OnBnCheckin();
	afx_msg void OnBnCheckout();
	afx_msg void OnBnReadCard(); 
	afx_msg void OnBnCheckintime();  
	//}}AFX_MSG
	DECLARE_MESSAGE_MAP()
};

//{{AFX_INSERT_LOCATION}}
// Microsoft Visual C++ will insert additional declarations immediately before the previous line.

#endif // !defined(AFX_Demo_LockSDKDLG_H__54B70D59_747A_4704_8206_8AFFE9C666A0__INCLUDED_)
