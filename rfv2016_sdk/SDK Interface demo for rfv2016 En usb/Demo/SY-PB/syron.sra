$PBExportHeader$syron.sra
$PBExportComments$Generated Application Object
forward
global type syron from application
end type
global transaction sqlca
global dynamicdescriptionarea sqlda
global dynamicstagingarea sqlsa
global error error
global message message
end forward

global type syron from application
string appname = "syron"
end type
global syron syron

type prototypes

end prototypes
on syron.create
appname="syron"
message=create message
sqlca=create transaction
sqlda=create dynamicdescriptionarea
sqlsa=create dynamicstagingarea
error=create error
end on

on syron.destroy
destroy(sqlca)
destroy(sqlda)
destroy(sqlsa)
destroy(error)
destroy(message)
end on

event open;open(win)
end event

