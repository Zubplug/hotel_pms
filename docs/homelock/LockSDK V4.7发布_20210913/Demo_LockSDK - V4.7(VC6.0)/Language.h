#ifndef __LANGUAGE_H__
#define __LANGUAGE_H__
 

//20121110
extern void GetLanguagePath_Ex(void);
extern CString g_LoadString_Ex(char* szID);
extern void g_SetDialogStrings_Ex(CDialog *pDlg,UINT uDlgID);
extern void ChkWriteConfigEn_Ex(void);
// extern CString g_szT57WriteConfig;			// 卡片初始化时是否写T5557卡的配置块
#endif			// #ifndef __LANGUAGE_H__