// rwini.h: interface for the Crwini class.
//
//////////////////////////////////////////////////////////////////////

#if !defined(AFX_RWINI_H__7D3FE520_41BD_41E6_A155_5DE0DE3B4625__INCLUDED_)
#define AFX_RWINI_H__7D3FE520_41BD_41E6_A155_5DE0DE3B4625__INCLUDED_

#if _MSC_VER > 1000
#pragma once
#endif // _MSC_VER > 1000

class Crwini  
{
public:
    void SetPath(char *path);
	void WriteInt(char* appname, char* keyname, int i);
	void Crwini::ReadString(char *appname, char *keyname, char str[], long bufSize);
	int GetInt(char* appname, char* keyname);
	bool WriteString(char* appname,char* keyname,char* s);
	
    void WriteLong(char* appname, char* keyname, long int i);
	long GetLong(char* appname, char* keyname);
    void DeleteKey(char* appname, char* keyname);
    short GetSections(char secNames[][100], char *secPrefix);
	
	
	Crwini();
	virtual ~Crwini();
	
private:
    char m_strPath[200];
	
};

#endif // !defined(AFX_RWINI_H__7D3FE520_41BD_41E6_A155_5DE0DE3B4625__INCLUDED_)
