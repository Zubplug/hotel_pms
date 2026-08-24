using System;
using System.Collections.Generic;
using System.Text;

namespace LodgeCore.Desktop.Services;

public class EscPosBuilder
{
    public static readonly byte[] Init        = { 0x1B, 0x40 };          // ESC @
    public static readonly byte[] AlignLeft   = { 0x1B, 0x61, 0x00 };   // ESC a 0
    public static readonly byte[] AlignCenter = { 0x1B, 0x61, 0x01 };   // ESC a 1
    public static readonly byte[] AlignRight  = { 0x1B, 0x61, 0x02 };   // ESC a 2
    public static readonly byte[] BoldOn      = { 0x1B, 0x45, 0x01 };   // ESC E 1
    public static readonly byte[] BoldOff     = { 0x1B, 0x45, 0x00 };   // ESC E 0
    public static readonly byte[] DoubleSize  = { 0x1D, 0x21, 0x11 };   // GS  ! – double width+height
    public static readonly byte[] NormalSize  = { 0x1D, 0x21, 0x00 };   // GS  ! – normal
    public static readonly byte[] InvertOn    = { 0x1D, 0x42, 0x01 };   // GS B 1 - invert colors
    public static readonly byte[] InvertOff   = { 0x1D, 0x42, 0x00 };   // GS B 0
    public static readonly byte[] LineFeed    = { 0x0A };
    public static readonly byte[] CutFull     = { 0x1D, 0x56, 0x41, 0x00 };   // GS V 65 0: Feed and Full Cut
    public static readonly byte[] CutPartial  = { 0x1D, 0x56, 0x42, 0x00 };   // GS V 66 0: Feed and Partial Cut
    public static readonly byte[] OpenDrawer  = { 0x1B, 0x70, 0x00, 0x19, 0xFA }; // Cash drawer kick

    private readonly List<byte[]> _doc = new();
    private readonly PrinterProfile _profile;
    private readonly int _width;

    public EscPosBuilder(PrinterProfile profile)
    {
        _profile = profile;
        _width = profile.PaperWidth > 0 ? profile.PaperWidth : 48; // default to 80mm
        _doc.Add(Init);
    }

    public void AddLineFeed(int count = 1)
    {
        for (int i = 0; i < count; i++) _doc.Add(LineFeed);
    }

    public void AddDivider(char c = '-')
    {
        AddLine(new string(c, _width));
    }

    public void AddText(string text)
    {
        _doc.Add(Encoding.UTF8.GetBytes(text));
    }

    public void AddLine(string text)
    {
        _doc.Add(Encoding.UTF8.GetBytes(text.TrimEnd() + "\n"));
    }

    public void AddCommand(byte[] cmd)
    {
        _doc.Add(cmd);
    }

    public void AddRow(string left, string right, bool isDoubleWidth = false)
    {
        int effectiveWidth = isDoubleWidth ? _width / 2 : _width;
        int spaces = effectiveWidth - left.Length - right.Length;
        if (spaces < 1) spaces = 1;
        AddLine(left + new string(' ', spaces) + right);
    }

    public void Add3ColRow(string left, string center, string right)
    {
        // Simple 3 col alignment based on width
        int leftW = _width / 3;
        int rightW = _width / 3;
        int centerW = _width - leftW - rightW;

        string l = left.PadRight(leftW);
        string c = center.PadLeft(centerW / 2).PadRight(centerW);
        string r = right.PadLeft(rightW);

        AddLine(Truncate(l, leftW) + Truncate(c, centerW) + Truncate(r, rightW));
    }

    public void Add4ColRow(string c1, string c2, string c3, string c4, int w1, int w2, int w3, int w4)
    {
        string l1 = c1.PadRight(w1);
        string l2 = c2.PadRight(w2);
        string l3 = c3.PadLeft(w3);
        string l4 = c4.PadLeft(w4);
        AddLine(Truncate(l1, w1) + Truncate(l2, w2) + Truncate(l3, w3) + Truncate(l4, w4));
    }

    private string Truncate(string s, int max) =>
        s.Length <= max ? s : s.Substring(0, max - 1) + "…";

    public void PrintHeader(string title)
    {
        AddCommand(AlignCenter);
        
        // Future logo placeholder
        if (_profile.LogoEnabled && !string.IsNullOrEmpty(_profile.LogoBitmapBase64))
        {
            // Placeholder for GS v 0 raster print
            // _doc.Add(RasterBytes(...));
        }

        AddCommand(BoldOn);
        AddCommand(DoubleSize);
        AddLine(_profile.HotelName ?? "LodgeCore PMS");
        AddCommand(NormalSize);
        AddCommand(BoldOff);

        if (!string.IsNullOrWhiteSpace(_profile.HotelAddress))
            AddLine(_profile.HotelAddress);

        AddLineFeed();
        AddDivider('=');

        AddCommand(BoldOn);
        AddLine(title);
        AddCommand(BoldOff);
        
        AddDivider('=');
        AddCommand(AlignLeft);
    }

    public byte[] Build()
    {
        int total = 0;
        foreach (var a in _doc) total += a.Length;
        var result = new byte[total];
        int offset = 0;
        foreach (var a in _doc) { Buffer.BlockCopy(a, 0, result, offset, a.Length); offset += a.Length; }
        return result;
    }
}
