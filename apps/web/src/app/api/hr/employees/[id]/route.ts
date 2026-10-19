import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';
import { PiiMaskingService } from '@/lib/services/pii-masking-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(authContext, 'hr.employee.view');

    const { id } = await params;

    const where: any = { id, deletedAt: null };
    if (authContext.organizationId) {
      where.organizationId = authContext.organizationId;
    }
    if (authContext.propertyId) {
      where.propertyAccess = { has: authContext.propertyId };
    }
    if (authContext.role === 'DEPARTMENT_HEAD' && authContext.department) {
      where.department = authContext.department;
    }

    const staff = await prisma.staff.findFirst({
      where,
      include: {
        employeeProfile: true,
        salaryStructure: true,
        employeeMovements: {
          orderBy: { effectiveDate: 'desc' },
          take: 10,
        },
        employeeDocuments: {
          where: authContext.canViewSensitive ? undefined : { isConfidential: false },
          orderBy: { createdAt: 'desc' },
        },
        leaveApplications: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            leaveType: true,
          },
        },
        attendanceRecords: {
          orderBy: { date: 'desc' },
          take: 14,
        },
        employeeLoans: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!staff) {
      return NextResponse.json({ error: 'Employee not found or inaccessible' }, { status: 404 });
    }

    const canViewSensitive = HrAuthorizationService.can(authContext, 'hr.employee.sensitive.view');

    const rawBvn = staff.employeeProfile?.bvn;
    const rawNin = staff.employeeProfile?.nin;
    const rawTin = staff.employeeProfile?.tin;
    const rawAcct = staff.salaryStructure?.bankAccountNumber;

    const safeProfile = staff.employeeProfile
      ? {
          ...staff.employeeProfile,
          bvn: canViewSensitive ? rawBvn : PiiMaskingService.maskBvn(rawBvn),
          nin: canViewSensitive ? rawNin : PiiMaskingService.maskNin(rawNin),
          tin: canViewSensitive ? rawTin : PiiMaskingService.maskTin(rawTin),
        }
      : null;

    const safeSalaryStructure = staff.salaryStructure
      ? {
          ...staff.salaryStructure,
          basicSalary: canViewSensitive ? staff.salaryStructure.basicSalary : 0,
          bankAccountNumber: canViewSensitive ? rawAcct : PiiMaskingService.maskAccountNumber(rawAcct),
          pensionNumber: canViewSensitive ? staff.salaryStructure.pensionNumber : (staff.salaryStructure.pensionNumber ? 'PEN-******' : null),
        }
      : null;

    return NextResponse.json({
      employee: {
        ...staff,
        profile: safeProfile,
        salaryStructure: safeSalaryStructure,
        attendance: staff.attendanceRecords,
        documents: staff.employeeDocuments,
        loans: canViewSensitive ? staff.employeeLoans : [],
        movements: staff.employeeMovements,
      },
    });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to get employee details:', error);
    return NextResponse.json({ error: 'Failed to retrieve employee record' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(authContext, 'hr.employee.manage');

    const { id } = await params;

    // Verify employee belongs to tenant
    const existingWhere: any = { id, deletedAt: null };
    if (authContext.organizationId) {
      existingWhere.organizationId = authContext.organizationId;
    }
    if (authContext.propertyId) {
      existingWhere.propertyAccess = { has: authContext.propertyId };
    }
    if (authContext.role === 'DEPARTMENT_HEAD' && authContext.department) {
      existingWhere.department = authContext.department;
    }
    const existing = await prisma.staff.findFirst({ where: existingWhere, include: { employeeProfile: true, salaryStructure: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found or inaccessible' }, { status: 404 });
    }

    const body = await req.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      departmentName,
      positionTitle,
      employmentStatus,
      employmentType,
      baseSalary,
      nin,
      bvn,
      taxId,
      pfaName,
      rsaPin,
      bankName,
      bankAccountNumber,
      bankSortCode,
      bankAccountName,
      emergencyContact,
      emergencyPhone,
      emergencyRelation,
      pensionExempt,
      nhfExempt,
      nhisMonthlyContribution,
      annualRentPaid,
      annualLifeAssurance,
      annualMortgageInterest,
      statutoryExemptionReason,
    } = body;

    if (['TERMINATED', 'RESIGNED', 'RETIRED'].includes(String(employmentStatus || '').toUpperCase())) {
      return NextResponse.json({ error: 'Employee separation must be submitted through the General Manager approval workflow' }, { status: 400 });
    }

    const changeReason = String(body.changeReason || '').trim();
    if (changeReason.length < 10) {
      return NextResponse.json({ error: 'A change reason of at least 10 characters is required for General Manager review' }, { status: 400 });
    }

    const proposedValue = {
      firstName, lastName, email, phone, departmentName, positionTitle, employmentStatus, employmentType,
      baseSalary, housingAllowance: body.housingAllowance, transportAllowance: body.transportAllowance,
      otherAllowances: body.otherAllowances, nin, bvn, taxId, pfaName, rsaPin, bankName,
      bankAccountNumber, bankSortCode, bankAccountName, emergencyContact, emergencyPhone, emergencyRelation,
      pensionExempt, nhfExempt, nhisMonthlyContribution, annualRentPaid, annualLifeAssurance, annualMortgageInterest,
      statutoryExemptionReason,
    };
    const pendingChange = await prisma.employeeChangeRequest.findFirst({ where: { staffId: id, fieldName: 'staffProfile', status: { in: ['PENDING', 'CLARIFICATION'] } } });
    if (pendingChange?.status === 'PENDING') return NextResponse.json({ error: 'This employee already has a profile change awaiting General Manager review' }, { status: 409 });
    if (pendingChange?.status === 'CLARIFICATION') {
      const request = await prisma.employeeChangeRequest.update({
        where: { id: pendingChange.id },
        data: {
          currentValue: JSON.stringify({ staff: existing, employeeProfile: existing.employeeProfile, salaryStructure: existing.salaryStructure }),
          proposedValue: JSON.stringify(proposedValue),
          reason: changeReason,
          requestedBy: authContext.userId,
          status: 'PENDING',
          reviewedBy: null,
          reviewedAt: null,
          reviewerNotes: null,
          effectiveAt: null,
        },
      });
      return NextResponse.json({ success: true, pendingApproval: true, resubmitted: true, request }, { status: 202 });
    }

    const request = await prisma.employeeChangeRequest.create({
      data: {
        staffId: id,
        fieldName: 'staffProfile',
        currentValue: JSON.stringify({ staff: existing, employeeProfile: existing.employeeProfile, salaryStructure: existing.salaryStructure }),
        proposedValue: JSON.stringify(proposedValue),
        reason: changeReason,
        requestedBy: authContext.userId,
      },
    });
    return NextResponse.json({ success: true, pendingApproval: true, request }, { status: 202 });

    const updated = await prisma.$transaction(async (tx: any) => {
      // 1. Update Staff
      const staffUpdateData: any = {};
      if (firstName) staffUpdateData.firstName = firstName.trim();
      if (lastName) staffUpdateData.lastName = lastName.trim();
      if (email) staffUpdateData.email = email.trim().toLowerCase();
      if (phone !== undefined) staffUpdateData.phone = phone?.trim() || null;
      if (departmentName) staffUpdateData.department = departmentName.trim();
      if (positionTitle) staffUpdateData.position = positionTitle.trim();
      if (employmentStatus) staffUpdateData.isActive = employmentStatus === 'ACTIVE';

      const updatedStaff = await tx.staff.update({
        where: { id },
        data: staffUpdateData,
      });

      // 2. Upsert EmployeeProfile
      const profileData: any = {};
      if (employmentStatus) profileData.status = employmentStatus;
      if (employmentType) profileData.employmentType = employmentType;
      if (nin !== undefined) profileData.nin = nin?.trim() || null;
      if (bvn !== undefined) profileData.bvn = bvn?.trim() || null;
      if (taxId !== undefined) profileData.tin = taxId?.trim() || null;
      if (emergencyContact || emergencyPhone) {
        profileData.emergencyContacts = [
          {
            name: emergencyContact?.trim() || '',
            phone: emergencyPhone?.trim() || '',
            relationship: emergencyRelation?.trim() || 'Emergency Contact',
          },
        ];
      }

      const profile = await tx.employeeProfile.upsert({
        where: { staffId: id },
        update: profileData,
        create: {
          staffId: id,
          ...profileData,
        },
      });

      // 3. Upsert SalaryStructure with version history tracking
      if (baseSalary !== undefined && Number(baseSalary) > 0) {
        const existingStructure = await tx.salaryStructure.findUnique({
          where: { staffId: id },
        });

        const newBasic = Number(baseSalary);
        const newHousing = body.housingAllowance !== undefined ? Number(body.housingAllowance) : (existingStructure?.housingAllowance ? Number(existingStructure.housingAllowance) : 0);
        const newTransport = body.transportAllowance !== undefined ? Number(body.transportAllowance) : (existingStructure?.transportAllowance ? Number(existingStructure.transportAllowance) : 0);
        const newOther = body.otherAllowances !== undefined ? Number(body.otherAllowances) : (existingStructure?.otherAllowances ? Number(existingStructure.otherAllowances) : 0);

        // If compensation changed, record immutable EmployeeMovement history for audit and version tracking
        if (
          existingStructure &&
          (Number(existingStructure.basicSalary) !== newBasic ||
            Number(existingStructure.housingAllowance) !== newHousing ||
            Number(existingStructure.transportAllowance) !== newTransport ||
            Number(existingStructure.otherAllowances) !== newOther)
        ) {
          await tx.employeeMovement.create({
            data: {
              staffId: id,
              effectiveDate: new Date(),
              type: 'SALARY_REVISION',
              reason: body.salaryRevisionReason || 'Compensation adjustment',
              fromDetails: {
                basicSalary: Number(existingStructure.basicSalary),
                housingAllowance: Number(existingStructure.housingAllowance),
                transportAllowance: Number(existingStructure.transportAllowance),
                otherAllowances: Number(existingStructure.otherAllowances),
                effectiveFrom: existingStructure.effectiveFrom,
              },
              toDetails: {
                basicSalary: newBasic,
                housingAllowance: newHousing,
                transportAllowance: newTransport,
                otherAllowances: newOther,
                effectiveFrom: new Date(),
              },
              approvedBy: authContext.userId,
            },
          });
        }

        const effectiveFrom = new Date();
        const versionBankName = bankName !== undefined ? bankName?.trim() || null : (existingStructure?.bankName || null);
        const versionAccountNumber = bankAccountNumber !== undefined ? bankAccountNumber?.trim() || null : (existingStructure?.bankAccountNumber || null);
        const versionBankSortCode = bankSortCode !== undefined ? bankSortCode?.trim() || null : (existingStructure?.bankSortCode || null);
        const versionPfa = pfaName !== undefined ? pfaName?.trim() || null : (existingStructure?.pensionFundAdmin || null);
        const versionRsa = rsaPin !== undefined ? rsaPin?.trim() || null : (existingStructure?.pensionNumber || null);

        await tx.salaryStructureVersion.updateMany({
          where: { staffId: id, effectiveTo: null, effectiveFrom: { lt: effectiveFrom } },
          data: { effectiveTo: effectiveFrom },
        });
        await tx.salaryStructureVersion.create({
          data: {
            organizationId: authContext.organizationId,
            propertyId: authContext.propertyId || existing!.propertyAccess[0],
            staffId: id,
            basicSalary: newBasic,
            housingAllowance: newHousing,
            transportAllowance: newTransport,
            otherAllowances: newOther,
            bankName: versionBankName,
            bankAccountNumber: versionAccountNumber,
            bankSortCode: versionBankSortCode,
            pensionFundAdmin: versionPfa,
            pensionNumber: versionRsa,
            effectiveFrom,
            createdBy: authContext.userId || id,
          },
        });

        await tx.salaryStructure.upsert({
          where: { staffId: id },
          update: {
            basicSalary: newBasic,
            housingAllowance: newHousing,
            transportAllowance: newTransport,
            otherAllowances: newOther,
            bankName: bankName?.trim() || undefined,
            bankAccountNumber: bankAccountNumber?.trim() || undefined,
            bankSortCode: bankSortCode?.trim() || undefined,
            bankAccountName: bankAccountName?.trim() || undefined,
            pensionFundAdmin: pfaName?.trim() || undefined,
            pensionNumber: rsaPin?.trim() || undefined,
            effectiveFrom,
          },
          create: {
            organizationId: authContext.organizationId,
            propertyId: authContext.propertyId || existing!.propertyAccess[0],
            staffId: id,
            basicSalary: newBasic,
            housingAllowance: newHousing,
            transportAllowance: newTransport,
            otherAllowances: newOther,
            bankName: bankName?.trim() || null,
            bankAccountNumber: bankAccountNumber?.trim() || null,
            bankSortCode: bankSortCode?.trim() || null,
            bankAccountName: bankAccountName?.trim() || null,
            pensionFundAdmin: pfaName?.trim() || null,
            pensionNumber: rsaPin?.trim() || null,
            effectiveFrom,
            createdBy: authContext.userId || id,
          },
        });
      }

      return { staff: updatedStaff, profile };
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to update employee details:', error);
    return NextResponse.json({ error: 'Failed to update employee record' }, { status: 500 });
  }
}
