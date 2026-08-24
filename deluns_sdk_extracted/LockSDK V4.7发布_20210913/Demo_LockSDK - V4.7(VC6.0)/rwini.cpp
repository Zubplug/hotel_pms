// rwini.cpp: implementation of the Crwini class.
//
//////////////////////////////////////////////////////////////////////

#include "stdafx.h"
#include <stdlib.h>
#include "rwini.h"


//////////////////////////////////////////////////////////////////////
// Construction/Destruction
//////////////////////////////////////////////////////////////////////

Crwini::Crwini()
{

}

Crwini::~Crwini()
{

}


// 设置Ini文件路径
void Crwini::SetPath(char *path)
{
    strcpy(m_strPath, path);
}

// 删除键
void Crwini::DeleteKey(char* appname, char* keyname)

{

         WritePrivateProfileString(appname, keyname, NULL, m_strPath);
}

// 写入字符串
bool Crwini::WriteString(char* appname, char* keyname,char* s)
{
	WritePrivateProfileString(appname,keyname,s,m_strPath);
	return 1;
}


// 读取短整型数据
int Crwini::GetInt(char* appname, char* keyname)
{
   return GetPrivateProfileInt(appname,keyname,1,m_strPath);
}

// 读取字符串
void Crwini::ReadString(char *appname, char *keyname, char str[], long bufSize)
{
	::GetPrivateProfileString(appname,keyname,NULL,str,bufSize,m_strPath);
}


// 写入短整型数据
void Crwini::WriteInt(char *appname, char *keyname, int i)
{
	char r[10];
	itoa(i,r,10);
    WritePrivateProfileString(appname,keyname,r,m_strPath);
}


// 写入长整型数据
void Crwini::WriteLong(char *appname, char *keyname, long int i)
{
	char r[10];
	ltoa(i,r,10);
    WritePrivateProfileString(appname,keyname,r,m_strPath);
}



// 读取长整型数据
long Crwini::GetLong(char* appname, char* keyname)
{
    char buf[100];
    GetPrivateProfileString(appname, keyname, NULL, buf, 100, m_strPath );
    return atol(buf);
}


// 枚举前缀为secPrefix的段名
// 返回段数
short Crwini::GetSections(char secNames[][100], char *secPrefix)
{ 
/* 
本函数基础： 
GetPrivateProfileSectionNames - 从 ini 文件中获得 Section 的名称
如果 ini 中有两个 Section: [sec1] 和 [sec2]，则返回的是 'sec1',0,'sec2',0,0 ，当你不知道  
ini 中有哪些 section 的时候可以用这个 api 来获取名称 
*/ 
    int i;  
    int iPos=0;  
    int iMaxCount; 
    int iCnt;
    const int MAX_ALLSECTIONS = 1000;
    const int MAX_SECTION = 100;
    TCHAR chSectionNames[MAX_ALLSECTIONS]={0}; //总的提出来的字符串 
    TCHAR chSection[MAX_SECTION]={0}; //存放一个段名。 
    GetPrivateProfileSectionNames(chSectionNames,MAX_ALLSECTIONS,m_strPath); 

    //以下循环，截断到两个连续的0 
    for(i=0;i<MAX_ALLSECTIONS;i++) 
    { 
        if (chSectionNames[i]==0) 
           if (chSectionNames[i]==chSectionNames[i+1]) 
           break; 
    } 

    iMaxCount=i+1; //要多一个0号元素。即找出全部字符串的结束部分。 
    //rSection.RemoveAll();//清空原数组 

    iCnt = 0;
    for(i=0;i<iMaxCount;i++) 
    { 
        chSection[iPos++]=chSectionNames[i]; 
        if(chSectionNames[i]==0) 
        {  
           if (strstr(chSection, secPrefix) == chSection)
           {
                strcpy(secNames[iCnt], chSection);
                iCnt++;
           }           
           memset(chSection,0,MAX_SECTION); 
           iPos=0; 
        } 
    } 

    return iCnt;
} 
 




/*
//////////////////////////////////////////////////////////////////////////

// File: IniFile.h

// Date: October 2004

// Author: lixiaosan

// Email: airforcetwo@163.com

// Copyright (c) 2004. All Rights Reserved.

//////////////////////////////////////////////////////////////////////////

#if !defined(AFX_INIFILE_H__B5C0D7F7_8353_4C93_AAA4_38A688CA253C__INCLUDED_)

#define AFX_INIFILE_H__B5C0D7F7_8353_4C93_AAA4_38A688CA253C__INCLUDED_

#if _MSC_VER > 1000

#pragma once

#endif // _MSC_VER > 1000

class CIniFile  

{

public:

         CIniFile();

         virtual ~CIniFile();

         //    设置ini文件路径
    //    成功返回TRUE;否则返回FALSE

         BOOL         SetPath(CString strPath);

         

         //    检查section是否存在
    //    存在返回TRUE;否则返回FALSE

         BOOL         SectionExist(CString strSection);

         //    从指定的Section和Key读取KeyValue
        //    返回KeyValue

         CString         GetKeyValue(CString    strSection,

                                                        CString    strKey);         

         

         //    设置Section、Key以及KeyValue，若Section或者Key不存在则创建

         void          SetKeyValue(CString    strSection, 

                                                   CString    strKey, 

                                                   CString    strKeyValue);

         //    删除指定Section下的一个Key

         void          DeleteKey(CString strSection,

                                               CString strKey);

         //    删除指定的Section以及其下的所有Key

         void          DeleteSection(CString strSection);

         //    获得所有的Section
        //    返回Section数目

         int              GetAllSections(CStringArray& strArrSection);

         

         //    根据指定Section得到其下的所有Key和KeyValue
        //    返回Key的数目

         int              GetAllKeysAndValues(CString strSection,

                                                                     CStringArray& strArrKey,

                                                                     CStringArray& strArrKeyValue);

         //       删除所有Section

         void          DeleteAllSections();

         

private:

         //       ini文件路径

         CString m_strPath;

         

};





*/




/*


//////////////////////////////////////////////////////////////////////////

// File: IniFile.cpp

// Date: October 2004

// Author: lixiaosan

// Email: airforcetwo@163.com

// Copyright (c) 2004. All Rights Reserved.

//////////////////////////////////////////////////////////////////////////

＃i nclude "stdafx.h"

//＃i nclude "test6.h"

＃i nclude "IniFile.h"



#ifdef _DEBUG

#undef THIS_FILE

static char THIS_FILE[]=__FILE__;

#define new DEBUG_NEW

#endif

#define         MAX_SECTION                260        //Section最大长度

#define         MAX_KEY                         260        //KeyValues最大长度

#define         MAX_ALLSECTIONS     65535    //所有Section的最大长度

#define         MAX_ALLKEYS              65535    //所有KeyValue的最大长度

//////////////////////////////////////////////////////////////////////

// Construction/Destruction

//////////////////////////////////////////////////////////////////////

CIniFile::CIniFile()

{

}

CIniFile::~CIniFile()

{

}

//////////////////////////////////////////////////////////////////////////

//   Public Functions

//////////////////////////////////////////////////////////////////////////

BOOL CIniFile::SetPath(CString strPath)

{

         m_strPath = strPath;

         

         //       检查文件是否存在

         DWORD  dwFlag = GetFileAttributes((LPCTSTR)m_strPath);

         

         //       文件或者路径不存在，返回FALSE

         if( 0xFFFFFFFF == dwFlag )

                   return FALSE;

         

         //       路径是目录，返回FALSE

         if (  FILE_ATTRIBUTE_DIRECTORY & dwFlag )

                   return FALSE;

         return TRUE;

}



CString CIniFile::GetKeyValue(CString strSection,

                                                         CString strKey)

{

         TCHAR         chKey[MAX_KEY];

         DWORD         dwRetValue;

         CString strKeyValue=_T("");

         dwRetValue = GetPrivateProfileString(

                  (LPCTSTR)strSection,

                  (LPCTSTR)strKey,

                   _T(""),

                   chKey,

                  sizeof(chKey)/sizeof(TCHAR),

                  (LPCTSTR)m_strPath);       

         

         strKeyValue = chKey;

         

         return strKeyValue;

}

void CIniFile::SetKeyValue(CString strSection,

                                                 CString strKey,

                                                 CString strKeyValue)

{

         WritePrivateProfileString(

                  (LPCTSTR)strSection, 

                  (LPCTSTR)strKey, 

                  (LPCTSTR)strKeyValue, 

                  (LPCTSTR)m_strPath);

}

void CIniFile::DeleteKey(CString strSection, CString strKey)

{

         WritePrivateProfileString(

                  (LPCTSTR)strSection, 

                  (LPCTSTR)strKey, 

                   NULL,          //       这里写NULL,则删除Key

                  (LPCTSTR)m_strPath);

}

void CIniFile::DeleteSection(CString strSection)

{

         WritePrivateProfileString(

                  (LPCTSTR)strSection, 

                   NULL,          

                   NULL,          //       这里都写NULL,则删除Section

                  (LPCTSTR)m_strPath);

}

int CIniFile::GetAllSections(CStringArray& strArrSection)

{

         int dwRetValue, i, j, iPos=0;

         TCHAR chAllSections[MAX_ALLSECTIONS];

         TCHAR chTempSection[MAX_SECTION];

         ZeroMemory(chAllSections, MAX_ALLSECTIONS);

         ZeroMemory(chTempSection, MAX_SECTION);

         dwRetValue = GetPrivateProfileSectionNames(

                  chAllSections,

                  MAX_ALLSECTIONS,

                  m_strPath);

         //       因为Section在数组中的存放形式为“Section1”，0，“Section2”，0，0。
    //       所以如果检测到连续两个0，则break

         for(i=0; i<MAX_ALLSECTIONS; i++) 

         { 

                  if( chAllSections[i] == NULL ) 

                   {

                            if( chAllSections[i] == chAllSections[i+1] )

                                     break; 

                   }

         } 

         

         i++; //         保证数据读完

         strArrSection.RemoveAll(); //         清空数组

         

         for(j=0; j<i; j++) 

         { 

                  chTempSection[iPos++] = chAllSections[j]; 

                  if( chAllSections[j] == NULL ) 

                   {  

                            strArrSection.Add(chTempSection); 

                            ZeroMemory(chTempSection, MAX_SECTION);

                            iPos = 0; 

                   } 

         }

         

         return strArrSection.GetSize();

}

int CIniFile::GetAllKeysAndValues(CString  strSection, 

                                                            CStringArray&         strArrKey, 

                                                            CStringArray& strArrKeyValue)

{

         int dwRetValue, i, j, iPos=0;

         TCHAR chAllKeysAndValues[MAX_ALLKEYS];

         TCHAR chTempkeyAndValue[MAX_KEY];

         CString strTempKey;

         ZeroMemory(chAllKeysAndValues, MAX_ALLKEYS);

         ZeroMemory(chTempkeyAndValue, MAX_KEY);

         dwRetValue = GetPrivateProfileSection(

                  strSection,

                  chAllKeysAndValues,

                  MAX_ALLKEYS,

                  m_strPath);

         //       因为Section在数组中的存放形式为“Key1=KeyValue1”，0，“Key2=KeyValue2”，0
         //       所以如果检测到连续两个0，则break

         for(i=0; i<MAX_ALLSECTIONS; i++) 

         { 

                  if( chAllKeysAndValues[i] == NULL ) 

                   {

                            if( chAllKeysAndValues[i] == chAllKeysAndValues[i+1] )

                                     break; 

                   }

         } 

         

         i++;

         strArrKey.RemoveAll();

         strArrKeyValue.RemoveAll();

         

         for(j=0; j<i; j++) 

         { 

                  chTempkeyAndValue[iPos++] = chAllKeysAndValues[j]; 

                  if( chAllKeysAndValues[j] == NULL ) 

                   {  

                            strTempKey = chTempkeyAndValue; 

                            strArrKey.Add( strTempKey.Left(strTempKey.Find('=')) );

                            strArrKeyValue.Add( strTempKey.Mid(strTempKey.Find('=')+1) );

                            ZeroMemory(chTempkeyAndValue, MAX_KEY);

                            iPos = 0; 

                   } 

         }

         

         return strArrKey.GetSize();

}

void CIniFile::DeleteAllSections()

{

         int nSecNum; 

         CStringArray strArrSection; 

         nSecNum = GetAllSections(strArrSection); 

         for(int i=0; i<nSecNum; i++) 

         { 

                  WritePrivateProfileString(

                            (LPCTSTR)strArrSection[i],

                            NULL,

                            NULL,

                            (LPCTSTR)m_strPath);       

         }

}


*/
