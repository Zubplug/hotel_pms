#include "stdafx.h"
#include "PubFuns.h"

#define RESIDTOSTR(nResID) #nResID
CString g_szCurPath="";
char szLanguage[100];
//取得需要用到的语言的ini文件
void GetLanguagePath_Ex(void)
{  
	g_szLanguagePath ="ToolsLanguage.ini";
 	strcpy(szLanguage,g_szLanguagePath);
  
}
/*********************************************************************
 * 函数名称:g_LoadString_Ex
 * 说明:	根据标识 szID到选定的语言文件中加载字符串
 * 作者:	zs
*********************************************************************/
CString g_LoadString_Ex(char* szID)
{
	char szValue[100]; 
	if (g_szLanguagePath == "") 
		GetLanguagePath_Ex();  
	PF_SetIniPath_Ex(szLanguage);
	PF_ReadIniString_Ex("String",szID,szValue,sizeof(szValue));
	if(szValue=="")
	{
		PF_ReadIniString_Ex("String","IDS_STRING_NOTFOUND",szValue,sizeof(szValue));
	}
	return szValue;
}
/*********************************************************************
 * 函数名称:g_SetDialogStrings_Ex(CDialog *pDlg,UINT uDlgID)
 * 说明:	当对话框运行时获取其所有可得到的字符串，并保存到语言文件中
			每个控件用对话框ID和控件ID唯一标识

 * 入口参数:
 * CDialog *pDlg -- 对话框的指针
 *  UINT uDlgID -- 该对话框的ID
 * 作者: zs 
*********************************************************************/
void g_SetDialogStrings_Ex(CDialog *pDlg,UINT uDlgID)
{
	char szSection[20] = "LockSDKDemo";
	CString szKey,szText;
	char cBuf[100]={0};
	char cTemp[100]={0};
	bool bSetText = 1;	//1:从文件读，设置对话框
	//0:从对话框读，保存到文件
	if (g_szLanguagePath == "") 
		GetLanguagePath_Ex();
 
	PF_SetIniPath_Ex(szLanguage);
	if(bSetText)	//1:从文件读，设置对话框
	{
		CString szDefault = "";
		DWORD dwSize = 1000;
		char* pData = (char*)malloc(dwSize);
		
		//读对话框标题
		szKey.Format("IDD%d_Title",uDlgID); 
		strcpy(cBuf,szKey);
		PF_ReadIniString_Ex(szSection,cBuf,cTemp,sizeof(cTemp));
		if(cTemp=="")
		{
			PF_ReadIniString_Ex(szSection,"IDS_STRING_NOTFOUND",cTemp,sizeof(cTemp));
		}
		pDlg->SetWindowText(cTemp);

		//写入各个子控件的标题文字
		CWnd* pWnd = pDlg->GetWindow(GW_CHILD);
		while(pWnd != NULL)
		{
			szKey.Format("IDD%d_%d",uDlgID,pWnd->GetDlgCtrlID()); 
		 
			 
			memset(cBuf,0,sizeof(cBuf));
			strcpy(cBuf,szKey);
			PF_ReadIniString_Ex(szSection,cBuf,cTemp,sizeof(cTemp));
			if(cTemp=="")
			{
				PF_ReadIniString_Ex(szSection,"IDS_STRING_NOTFOUND",cTemp,sizeof(cTemp));
			}
			pWnd->SetWindowText(cTemp);
			pWnd = pWnd->GetWindow(GW_HWNDNEXT);
		}
		
		//释放内存
		free(pData);
	}
	else	//0:从对话框读，保存到文件
	{
		//写入对话框标题
		szKey.Format("IDD%d_Title",uDlgID);
		pDlg->GetWindowText(szText);
		WritePrivateProfileString(szSection,szKey,szText,g_szLanguagePath);
		
		//写入各个子控件的标题文字
		CWnd* pWnd = pDlg->GetWindow(GW_CHILD);
		while(pWnd != NULL)
		{
			szKey.Format("IDD%d_%d",uDlgID,pWnd->GetDlgCtrlID());
			pWnd->GetWindowText(szText);
			WritePrivateProfileString(szSection,szKey,szText,g_szLanguagePath);
			
			pWnd = pWnd->GetWindow(GW_HWNDNEXT);
		}
	}
}
  
