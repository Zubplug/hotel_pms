ALTER TABLE "EmployeeChangeRequest"
    ADD CONSTRAINT "EmployeeChangeRequest_requestedBy_fkey"
    FOREIGN KEY ("requestedBy") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeChangeRequest"
    ADD CONSTRAINT "EmployeeChangeRequest_reviewedBy_fkey"
    FOREIGN KEY ("reviewedBy") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
