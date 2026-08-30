unit Unit2;

interface
var
  ReadDataStr:string;
  //--------------------------------------------------
  Procedure WriteCardTxt(WriteDataStr:string;WriteDBPath:String);
  Procedure WriteCardReceiveTxt(WriteReceiveDBPath:String);
  Procedure ReadCardTxt(ReadDBPath:String);
implementation
//-----------------------------------------------------------------
Procedure WriteCardTxt(WriteDataStr:string;WriteDBPath:String);
var
  F:TextFile;
begin
  AssignFile(F,WriteDBPath);
  Rewrite(F);
  Writeln(F,WriteDataStr);
  CloseFile(f);
end;

Procedure WriteCardReceiveTxt(WriteReceiveDBPath:String);
var
  F:TextFile;
begin
  AssignFile(F,WriteReceiveDBPath);
  Reset(F);
  Readln(F,ReadDataStr);
  CloseFile(f);
end;

Procedure ReadCardTxt(ReadDBPath:String);
var
  F:TextFile;
begin
  AssignFile(F,ReadDBPath);
  Reset(F);
  Readln(F,ReadDataStr);
  CloseFile(f);
end;
//-------------------------------------------------------------------
end.
 