using System;
using System.Collections.Generic;
using System.Text;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace CSharpDemo
{
    public class Language
    { 
        static string g_szLanguagePath = "";
        static string g_szCurPath = "";

        /// <summary>
        /// 取得语言资源文件的路径
        /// </summary>
        public static void GetLanguagePath_Ex()
        {
            g_szCurPath = Application.StartupPath; 
            //Ini ini = new Ini(g_szCurPath + "\\Config.ini");
            //string sLan = ini.ReadValue("System", "Language");
            //if (sLan == "")
            //{
            //    sLan = "Chinese";
            //}
            g_szLanguagePath = g_szCurPath + "\\ToolsLanguage.ini";
        }

        /// <summary>
        /// 根据标识szID到选定的语言文件中加载字符串
        /// </summary>
        /// <param name="szID"></param>
        /// <returns></returns>
        public static string g_LoadString_Ex(string szID)
        {
            string szValue = "";
            if (g_szLanguagePath == "")
                GetLanguagePath_Ex();
            Ini ini = new Ini(g_szLanguagePath);
            szValue = ini.ReadValue("String", szID);
            if (szValue == "")
            {
                szValue = "Not found";
            }
            else
            {
                szValue.Replace("\\n", "\n");//替换回换行符号
            }
            return szValue;
        }

        /// <summary>
        /// 当对话框运行时获取其所有可得到的字符串，并保存到语言文件中
        ///	每个控件用对话框ID和控件ID唯一标识
        /// </summary>
        /// <param name="frm"></param>
        public static void g_SetFormStrings_Ex(Form frm)
        {
            string szSection = "LockSDKDemo";
            string szKey = "", szText = "";
            bool bSetText = true;//true,从文件中读，设置窗口；false:从对话框读保存到文件

            if (g_szLanguagePath == "")
                GetLanguagePath_Ex();
            Ini ini = new Ini(g_szLanguagePath);
            if (bSetText)//从文件中读，设置对话框
            {
                string szDefault = "";

                //读窗口标题
                szKey = frm.Name + "_Title";

                szDefault = ini.ReadValue(szSection, szKey);
                if (szDefault == "")
                {
                    szDefault = "Not found";
                }
                else
                {
                    szDefault.Replace("\\n", "\n");//替换回换行符号
                }
                frm.Text = szDefault;

                //写入各个字控件标题
                foreach (Control c1 in frm.Controls)
                {
                    szKey = c1.Name;// frm.Name + "_" + c1.Name;
                    szText = ini.ReadValue(szSection, szKey);
                    c1.Text = szText;
                }
            }
            else//从窗口保存到文件
            {
                //写入窗口标题
                szKey = frm.Name + "_Title";
                szText = frm.Text;
                ini.Writue(szSection, szKey, szText);

                //写入各个子控件的标题文字
                foreach (Control c2 in frm.Controls)
                {
                    szKey = frm.Name + "_" + c2.Name;
                    szText = c2.Text;
                    ini.Writue(szSection, szKey, szText);
                }
            }
        }
    }
    public class Ini
    {
        // 声明INI文件的写操作函数 WritePrivateProfileString()

        [System.Runtime.InteropServices.DllImport("kernel32")]

        private static extern long WritePrivateProfileString(string section, string key, string val, string filePath);

        // 声明INI文件的读操作函数 GetPrivateProfileString()

        [System.Runtime.InteropServices.DllImport("kernel32")]

        private static extern int GetPrivateProfileString(string section, string key, string def, System.Text.StringBuilder retVal, int size, string filePath);


        private string sPath = null;
        public Ini(string path)
        {
            this.sPath = path;
        }

        public void Writue(string section, string key, string value)
        {

            // section=配置节，key=键名，value=键值，path=路径

            WritePrivateProfileString(section, key, value, sPath);

        }
        public string ReadValue(string section, string key)
        {

            // 每次从ini中读取多少字节

            System.Text.StringBuilder temp = new System.Text.StringBuilder(255);

            // section=配置节，key=键名，temp=上面，path=路径

            GetPrivateProfileString(section, key, "", temp, 255, sPath);

            return temp.ToString();

        }
    }
}
