program LockSDK_Demo;

uses
  Forms,
  Unit1 in 'Unit1.pas' {IDD102};

{$R *.res}

begin
  Application.Initialize;
  Application.CreateForm(TIDD102, IDD102);
  Application.Run;
end.
