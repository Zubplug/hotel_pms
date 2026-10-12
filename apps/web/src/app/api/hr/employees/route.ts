import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@hotel-pms/db';
import { hash } from 'bcryptjs';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';
import { PiiMaskingService } from '@/lib/services/pii-masking-service';

export async function GET(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(authContext, 'hr.employee.view');

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const status = searchParams.get('status');
    const propertyId = searchParams.get('propertyId') || authContext.propertyId;
    const organizationId = authContext.organizationId;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (propertyId) {
      where.propertyAccess = { has: propertyId };
    }
    if (authContext.role === 'DEPARTMENT_HEAD' && authContext.department) {
      where.department = authContext.department;
    }

    if (status && status !== 'ALL') {
      if (status === 'ACTIVE' || status === 'INACTIVE') {
        where.isActive = status === 'ACTIVE';
      }
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { department: { contains: search, mode: 'insensitive' } },
            { position: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [total, staffList] = await Promise.all([
      prisma.staff.count({ where }),
      prisma.staff.findMany({
        where,
        include: {
          employeeProfile: true,
          salaryStructure: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const canViewSensitive = HrAuthorizationService.can(authContext, 'hr.employee.sensitive.view');

    const formattedEmployees = staffList.map((s) => {
      const emergencyContacts = Array.isArray(s.employeeProfile?.emergencyContacts)
        ? (s.employeeProfile?.emergencyContacts as any[])[0]
        : null;

      const rawBvn = s.employeeProfile?.bvn;
      const rawNin = s.employeeProfile?.nin;
      const rawTin = s.employeeProfile?.tin;
      const rawAcct = s.salaryStructure?.bankAccountNumber;
      const rawSalary = s.salaryStructure ? Number(s.salaryStructure.basicSalary) : 0;

      return {
        id: s.id,
        name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email,
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        phone: s.phone || emergencyContacts?.phone || '',
        employeeCode: s.employeeId || `EMP-${s.id.slice(0, 4).toUpperCase()}`,
        department: s.department || 'General',
        position: s.position || 'Staff',
        status: s.employeeProfile?.status || (s.isActive ? 'ACTIVE' : 'INACTIVE'),
        isActive: s.isActive,
        employmentType: s.employeeProfile?.employmentType || 'FULL_TIME',
        hireDate: s.hiredAt || s.createdAt,
        baseSalary: canViewSensitive ? rawSalary : 0,
        currency: s.salaryStructure?.currency || 'NGN',
        profile: {
          ...s.employeeProfile,
          bvn: canViewSensitive ? rawBvn : PiiMaskingService.maskBvn(rawBvn),
          nin: canViewSensitive ? rawNin : PiiMaskingService.maskNin(rawNin),
          tin: canViewSensitive ? rawTin : PiiMaskingService.maskTin(rawTin),
          taxId: canViewSensitive ? rawTin : PiiMaskingService.maskTin(rawTin),
          employeeCode: s.employeeId || `EMP-${s.id.slice(0, 4).toUpperCase()}`,
          employmentStatus: s.employeeProfile?.status || 'ACTIVE',
          emergencyContact: emergencyContacts?.name,
          emergencyPhone: emergencyContacts?.phone,
          emergencyRelation: emergencyContacts?.relationship,
          bankName: s.salaryStructure?.bankName,
          bankAccountNumber: canViewSensitive ? rawAcct : PiiMaskingService.maskAccountNumber(rawAcct),
          pfaName: s.salaryStructure?.pensionFundAdmin,
          rsaPin: canViewSensitive ? s.salaryStructure?.pensionNumber : (s.salaryStructure?.pensionNumber ? 'PEN-******' : null),
        },
      };
    });

    return NextResponse.json({
      employees: formattedEmployees,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to list HR employees:', error);
    return NextResponse.json({ error: 'Failed to retrieve employees' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(authContext, 'hr.employee.manage');

    const organizationId = authContext.organizationId;
    const propertyId = authContext.propertyId;

    if (!organizationId || !propertyId) {
      return NextResponse.json({ error: 'Organization and property context are required' }, { status: 400 });
    }

    const body = await req.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      departmentName,
      positionTitle,
      employmentType = 'FULL_TIME',
      hireDate,
      baseSalary = 0,
      transportAllowance = 0,
      housingAllowance = 0,
      otherAllowances = 0,
      nin,
      bvn,
      taxId,
      pfaName,
      rsaPin,
      bankName,
      bankAccountNumber,
      bankSortCode,
      bankAccountName,
      emergencyContactName,
      emergencyContactRelationship,
      emergencyContactPhone,
      posPin,
    } = body;

    if (!firstName || !lastName || !email || !departmentName?.trim() || !positionTitle?.trim()) {
      return NextResponse.json(
        { error: 'First name, last name, email, department, and position are mandatory' },
        { status: 400 }
      );
    }

    // A count-based code races under concurrent onboarding. Keep the human-readable
    // prefix while using a collision-resistant suffix as the identifier contract.
    const employeeCode = `EMP-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

    let posPinHash = null;
    if (posPin && posPin.length === 4) {
      posPinHash = await hash(posPin, 10);
    }

    const newStaff = await prisma.$transaction(async (tx: any) => {
      // 1. Create Staff record
      const staff = await tx.staff.create({
        data: {
          organizationId,
          employeeId: employeeCode,
          email: email.trim().toLowerCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone?.trim() || null,
          department: departmentName.trim(),
          position: positionTitle.trim(),
          propertyAccess: propertyId ? [propertyId] : [],
          posPinHash,
          isActive: true,
          hiredAt: hireDate ? new Date(hireDate) : new Date(),
        },
      });

      // 2. Create EmployeeProfile
      const profile = await tx.employeeProfile.create({
        data: {
          staffId: staff.id,
          employmentType,
          status: 'ACTIVE',
          nin: nin?.trim() || null,
          bvn: bvn?.trim() || null,
          tin: taxId?.trim() || null,
          emergencyContacts: emergencyContactName
            ? [
                {
                  name: emergencyContactName.trim(),
                  phone: emergencyContactPhone?.trim() || '',
                  relationship: emergencyContactRelationship?.trim() || 'Emergency Contact',
                },
              ]
            : undefined,
        },
      });

      // 3. Create initial SalaryStructure
      if (Number(baseSalary) > 0 || bankAccountNumber) {
        const effectiveFrom = new Date();
        const structureData = {
          staffId: staff.id,
          basicSalary: Number(baseSalary) || 0,
          housingAllowance: Number(housingAllowance) || 0,
          transportAllowance: Number(transportAllowance) || 0,
          otherAllowances: Number(otherAllowances) || 0,
          bankName: bankName?.trim() || null,
          bankAccountNumber: bankAccountNumber?.trim() || null,
          bankSortCode: bankSortCode?.trim() || null,
          bankAccountName: bankAccountName?.trim() || null,
          pensionFundAdmin: pfaName?.trim() || null,
          pensionNumber: rsaPin?.trim() || null,
          effectiveFrom,
          createdBy: authContext.userId || staff.id,
        };
        await tx.salaryStructure.create({
          data: {
            ...structureData,
            organizationId,
            propertyId,
          },
        });
        await tx.salaryStructureVersion.create({
          data: {
            ...structureData,
            organizationId,
            propertyId,
          },
        });
      }

      return { staff, profile };
    });

    return NextResponse.json({ success: true, data: newStaff }, { status: 201 });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to create HR employee:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'An employee with this email address already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Failed to create employee record' }, { status: 500 });
  }
}
