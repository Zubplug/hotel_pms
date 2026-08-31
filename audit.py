import re

with open("packages/db/prisma/schema.prisma", "r") as f:
    content = f.read()

models = {}
current_model = None

for line in content.split("\n"):
    line = line.strip()
    if line.startswith("model "):
        current_model = line.split()[1]
        models[current_model] = []
    elif current_model and line.startswith("}"):
        current_model = None
    elif current_model and line and not line.startswith("//"):
        parts = line.split()
        if len(parts) >= 2:
            models[current_model].append(parts[0])

classifications = {
    "TENANT_ROOT": [],
    "ORGANIZATION_SCOPED": [],
    "PROPERTY_SCOPED": [],
    "OUTLET_SCOPED": [],
    "TERMINAL_SCOPED": [],
    "USER_SCOPED": [],
    "INDIRECT_OR_GLOBAL": []
}

for model, fields in models.items():
    if model == "Organization":
        classifications["TENANT_ROOT"].append(model)
    elif "organizationId" in fields:
        classifications["ORGANIZATION_SCOPED"].append(model)
    elif "propertyId" in fields:
        classifications["PROPERTY_SCOPED"].append(model)
    elif "posOutletId" in fields or "outletId" in fields:
        classifications["OUTLET_SCOPED"].append(model)
    elif "posTerminalId" in fields or "terminalId" in fields or "deviceId" in fields or "posDeviceId" in fields:
        classifications["TERMINAL_SCOPED"].append(model)
    elif "userId" in fields or "staffId" in fields:
        classifications["USER_SCOPED"].append(model)
    else:
        classifications["INDIRECT_OR_GLOBAL"].append(model)

print("### Model Scoping Audit\n")
for category, mods in classifications.items():
    if mods:
        print(f"**{category}**:")
        for m in mods:
            print(f"- {m}")
        print()
