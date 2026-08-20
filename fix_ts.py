import re
from collections import defaultdict

errors_text = """
Error: src/app/_dashboard/sync-center/page.tsx(62,32): error TS7006: Parameter 'c' implicitly has an 'any' type.
Error: src/app/_dashboard/sync-center/page.tsx(94,29): error TS7006: Parameter 'a' implicitly has an 'any' type.
Error: src/app/api/cron/night-audit/route.ts(70,42): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/cron/night-audit/route.ts(80,45): error TS7006: Parameter 'f' implicitly has an 'any' type.
Error: src/app/api/cron/night-audit/route.ts(149,60): error TS7006: Parameter 'acc' implicitly has an 'any' type.
Error: src/app/api/cron/night-audit/route.ts(149,65): error TS7006: Parameter 'r' implicitly has an 'any' type.
Error: src/app/api/manager/approvals/[id]/approve/route.ts(18,53): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/manager/approvals/[id]/reject/route.ts(18,53): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/manager/auth/login/route.ts(44,26): error TS7006: Parameter 'ur' implicitly has an 'any' type.
Error: src/app/api/manager/auth/login/route.ts(46,37): error TS7006: Parameter 'rp' implicitly has an 'any' type.
Error: src/app/api/manager/dashboard/route.ts(65,19): error TS7006: Parameter 'r' implicitly has an 'any' type.
Error: src/app/api/mobile/v1/executive/approvals/[id]/route.ts(30,53): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/mobile/v1/executive/finance/route.ts(100,55): error TS7006: Parameter 'acc' implicitly has an 'any' type.
Error: src/app/api/mobile/v1/executive/finance/route.ts(100,60): error TS7006: Parameter 'f' implicitly has an 'any' type.
Error: src/app/api/mobile/v1/executive/finance/route.ts(122,58): error TS7006: Parameter 'acc' implicitly has an 'any' type.
Error: src/app/api/mobile/v1/executive/finance/route.ts(122,63): error TS7006: Parameter 'r' implicitly has an 'any' type.
Error: src/app/api/mobile/v1/executive/hub/route.ts(42,43): error TS7006: Parameter 'r' implicitly has an 'any' type.
Error: src/app/api/mobile/v1/executive/hub/route.ts(47,64): error TS7006: Parameter 'p' implicitly has an 'any' type.
Error: src/app/api/mobile/v1/executive/hub/route.ts(119,42): error TS7006: Parameter 'r' implicitly has an 'any' type.
Error: src/app/api/mobile/v1/executive/hub/route.ts(142,39): error TS7006: Parameter 'app' implicitly has an 'any' type.
Error: src/app/api/mobile/v1/executive/hub/route.ts(161,48): error TS7006: Parameter 'int' implicitly has an 'any' type.
Error: src/app/api/mobile/v1/me/route.ts(71,68): error TS7006: Parameter 'p' implicitly has an 'any' type.
Error: src/app/api/mobile/v1/me/route.ts(74,22): error TS7006: Parameter 'p' implicitly has an 'any' type.
Error: src/app/api/mobile/v1/me/route.ts(75,19): error TS7006: Parameter 'p' implicitly has an 'any' type.
Error: src/app/api/v1/dashboard/analytics/route.ts(78,19): error TS7006: Parameter 'r' implicitly has an 'any' type.
Error: src/app/api/v1/dashboard/analytics/route.ts(132,52): error TS7006: Parameter 'p' implicitly has an 'any' type.
Error: src/app/api/v1/dashboard/analytics/route.ts(134,23): error TS7006: Parameter 'r' implicitly has an 'any' type.
Error: src/app/api/v1/dashboard/analytics/route.ts(143,41): error TS7006: Parameter 'sum' implicitly has an 'any' type.
Error: src/app/api/v1/dashboard/analytics/route.ts(143,46): error TS7006: Parameter 'pay' implicitly has an 'any' type.
Error: src/app/api/v1/dashboard/analytics/route.ts(144,42): error TS7006: Parameter 'sum' implicitly has an 'any' type.
Error: src/app/api/v1/dashboard/analytics/route.ts(144,47): error TS7006: Parameter 'ref' implicitly has an 'any' type.
Error: src/app/api/v1/dashboard/analytics/route.ts(198,39): error TS7006: Parameter 'p' implicitly has an 'any' type.
Error: src/app/api/v1/dashboard/analytics/route.ts(199,38): error TS7006: Parameter 'r' implicitly has an 'any' type.
Error: src/app/api/v1/dashboard/analytics/route.ts(200,32): error TS7006: Parameter 'sum' implicitly has an 'any' type.
Error: src/app/api/v1/dashboard/analytics/route.ts(200,37): error TS7006: Parameter 'p' implicitly has an 'any' type.
Error: src/app/api/v1/dashboard/analytics/route.ts(200,85): error TS7006: Parameter 'sum' implicitly has an 'any' type.
Error: src/app/api/v1/dashboard/analytics/route.ts(200,90): error TS7006: Parameter 'r' implicitly has an 'any' type.
Error: src/app/api/v1/dashboard/analytics/route.ts(266,30): error TS7006: Parameter 'a' implicitly has an 'any' type.
Error: src/app/api/v1/dashboard/analytics/route.ts(269,39): error TS7006: Parameter 'p' implicitly has an 'any' type.
Error: src/app/api/v1/frontdesk/dashboard/route.ts(60,41): error TS7006: Parameter 'r' implicitly has an 'any' type.
Error: src/app/api/v1/hardware/commands/[id]/route.ts(52,55): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/housekeeping/tasks/[id]/status/route.ts(74,58): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/inventory/reconcile/route.ts(14,53): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/maintenance/tickets/[id]/status/route.ts(40,60): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/maintenance/tickets/route.ts(36,79): error TS7006: Parameter 'res' implicitly has an 'any' type.
Error: src/app/api/v1/maintenance/tickets/route.ts(36,94): error TS7006: Parameter 't' implicitly has an 'any' type.
Error: src/app/api/v1/maintenance/tickets/route.ts(84,53): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/night-audit/run/route.ts(44,38): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/payments/[id]/refund/route.ts(112,53): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/payments/online/initialize/route.ts(62,54): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/payments/online/webhook/route.ts(75,38): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/payments/online/webhook/route.ts(205,38): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/payments/online/webhook/route.ts(282,38): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/payments/route.ts(72,53): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/pos/categories/route.ts(21,35): error TS7006: Parameter 'o' implicitly has an 'any' type.
Error: src/app/api/v1/pos/floor-plans/[floorPlanId]/tables/route.ts(19,40): error TS7006: Parameter 't' implicitly has an 'any' type.
Error: src/app/api/v1/pos/floor-plans/[floorPlanId]/tables/route.ts(38,40): error TS7006: Parameter 'table' implicitly has an 'any' type.
Error: src/app/api/v1/pos/orders/[orderId]/fire/route.ts(83,53): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/pos/orders/[orderId]/pay/route.ts(47,53): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/pos/orders/[orderId]/split/route.ts(31,53): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/pos/orders/route.ts(68,52): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/pos/outlets/authorized/route.ts(63,17): error TS7006: Parameter 'access' implicitly has an 'any' type.
Error: src/app/api/v1/pos/outlets/authorized/route.ts(64,14): error TS7006: Parameter 'access' implicitly has an 'any' type.
Error: src/app/api/v1/pos/outlets/authorized/route.ts(70,50): error TS7006: Parameter 'o' implicitly has an 'any' type.
Error: src/app/api/v1/pos/products/route.ts(26,36): error TS7006: Parameter 'p' implicitly has an 'any' type.
Error: src/app/api/v1/pos/reports/server-orders/route.ts(77,40): error TS7006: Parameter 'order' implicitly has an 'any' type.
Error: src/app/api/v1/pos/reports/server-sales/route.ts(71,20): error TS7006: Parameter 'order' implicitly has an 'any' type.
Error: src/app/api/v1/pos/reports/server-sales/route.ts(80,32): error TS7006: Parameter 'payment' implicitly has an 'any' type.
Error: src/app/api/v1/pos/sessions/[sessionId]/active-orders/route.ts(80,40): error TS7006: Parameter 'order' implicitly has an 'any' type.
Error: src/app/api/v1/pos/sessions/route.ts(70,53): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/pos/sync/push/route.ts(72,42): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/pos/terminals/[id]/sync/route.ts(49,35): error TS7006: Parameter 'sa' implicitly has an 'any' type.
Error: src/app/api/v1/pos/terminals/[id]/sync/route.ts(73,26): error TS7006: Parameter 's' implicitly has an 'any' type.
Error: src/app/api/v1/reports/gateway-reconciliation/route.ts(71,47): error TS7006: Parameter 'sum' implicitly has an 'any' type.
Error: src/app/api/v1/reports/gateway-reconciliation/route.ts(71,52): error TS7006: Parameter 'r' implicitly has an 'any' type.
Error: src/app/api/v1/reports/receivables/route.ts(55,35): error TS7006: Parameter 'f' implicitly has an 'any' type.
Error: src/app/api/v1/reservations/[id]/cancel/route.ts(38,56): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/reservations/[id]/check-in/route.ts(79,59): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/reservations/[id]/check-out/route.ts(36,55): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/reservations/[id]/check-out/route.ts(86,62): error TS7006: Parameter 'p' implicitly has an 'any' type.
Error: src/app/api/v1/reservations/[id]/extend/route.ts(101,38): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/reservations/[id]/extend/route.ts(145,19): error TS7006: Parameter 'i' implicitly has an 'any' type.
Error: src/app/api/v1/reservations/[id]/extend/route.ts(146,20): error TS7006: Parameter 'acc' implicitly has an 'any' type.
Error: src/app/api/v1/reservations/[id]/extend/route.ts(146,25): error TS7006: Parameter 'item' implicitly has an 'any' type.
Error: src/app/api/v1/reservations/[id]/extend/route.ts(148,19): error TS7006: Parameter 'i' implicitly has an 'any' type.
Error: src/app/api/v1/reservations/[id]/extend/route.ts(149,20): error TS7006: Parameter 'acc' implicitly has an 'any' type.
Error: src/app/api/v1/reservations/[id]/extend/route.ts(149,25): error TS7006: Parameter 'item' implicitly has an 'any' type.
Error: src/app/api/v1/reservations/[id]/route.ts(198,54): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/reservations/[id]/route.ts(263,56): error TS7006: Parameter 'i' implicitly has an 'any' type.
Error: src/app/api/v1/reservations/[id]/route.ts(263,90): error TS7006: Parameter 'acc' implicitly has an 'any' type.
Error: src/app/api/v1/reservations/[id]/route.ts(263,95): error TS7006: Parameter 'item' implicitly has an 'any' type.
Error: src/app/api/v1/reservations/[id]/route.ts(264,57): error TS7006: Parameter 'i' implicitly has an 'any' type.
Error: src/app/api/v1/reservations/[id]/route.ts(264,92): error TS7006: Parameter 'acc' implicitly has an 'any' type.
Error: src/app/api/v1/reservations/[id]/route.ts(264,97): error TS7006: Parameter 'item' implicitly has an 'any' type.
Error: src/app/api/v1/reservations/route.ts(115,58): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/staff/[id]/route.ts(31,59): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/staff/route.ts(72,55): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/sync/conflicts/[id]/resolve/route.ts(44,53): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/sync/pull/route.ts(96,28): error TS7006: Parameter 'staff' implicitly has an 'any' type.
Error: src/app/api/v1/sync/pull/route.ts(124,33): error TS7006: Parameter 'ur' implicitly has an 'any' type.
Error: src/app/api/v1/sync/pull/route.ts(125,41): error TS7006: Parameter 'rp' implicitly has an 'any' type.
Error: src/app/api/v1/sync/push/route.ts(65,40): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/sync/push/route.ts(240,40): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/sync/push/route.ts(501,40): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/app/api/v1/sync/push/route.ts(606,40): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/lib/attention-engine.ts(87,53): error TS7006: Parameter 'acc' implicitly has an 'any' type.
Error: src/lib/attention-engine.ts(87,58): error TS7006: Parameter 'f' implicitly has an 'any' type.
Error: src/lib/auth.ts(54,30): error TS7006: Parameter 'ur' implicitly has an 'any' type.
Error: src/lib/auth.ts(56,41): error TS7006: Parameter 'rp' implicitly has an 'any' type.
Error: src/lib/executive/approvals.ts(15,47): error TS7006: Parameter 'sum' implicitly has an 'any' type.
Error: src/lib/executive/approvals.ts(15,52): error TS7006: Parameter 'req' implicitly has an 'any' type.
Error: src/lib/executive/approvals.ts(22,32): error TS7006: Parameter 'req' implicitly has an 'any' type.
Error: src/lib/executive/room-status.ts(73,57): error TS7006: Parameter 'r' implicitly has an 'any' type.
Error: src/lib/executive/room-status.ts(74,45): error TS7006: Parameter 'b' implicitly has an 'any' type.
Error: src/lib/executive/room-status.ts(76,58): error TS7006: Parameter 'r' implicitly has an 'any' type.
Error: src/lib/executive/room-status.ts(77,50): error TS7006: Parameter 'b' implicitly has an 'any' type.
Error: src/lib/executive/room-status.ts(77,86): error TS7006: Parameter 'b' implicitly has an 'any' type.
Error: src/lib/executive/room-status.ts(78,50): error TS7006: Parameter 'b' implicitly has an 'any' type.
Error: src/lib/executive/room-status.ts(78,88): error TS7006: Parameter 'b' implicitly has an 'any' type.
Error: src/lib/executive/room-status.ts(314,49): error TS7006: Parameter 'sum' implicitly has an 'any' type.
Error: src/lib/executive/room-status.ts(314,54): error TS7006: Parameter 'f' implicitly has an 'any' type.
Error: src/lib/executive/room-status.ts(414,39): error TS7006: Parameter 'record' implicitly has an 'any' type.
Error: src/lib/locks/orchestrator.ts(275,49): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/lib/locks/orchestrator.ts(332,53): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/lib/night-audit.ts(76,40): error TS7006: Parameter 'reservation' implicitly has an 'any' type.
Error: src/lib/night-audit.ts(82,44): error TS7006: Parameter 'tx' implicitly has an 'any' type.
Error: src/lib/notification-engine/index.ts(127,43): error TS7006: Parameter 'ur' implicitly has an 'any' type.
Error: src/lib/notification-engine/index.ts(390,52): error TS7006: Parameter 'rr' implicitly has an 'any' type.
Error: src/lib/notification-engine/index.ts(423,52): error TS7006: Parameter 'rr' implicitly has an 'any' type.
"""

file_edits = defaultdict(list)

for line in errors_text.strip().split('\n'):
    m = re.search(r"Error: (.+?)\((\d+),(\d+)\): error TS7006: Parameter '(.+?)'", line)
    if m:
        path = m.group(1).strip()
        l_num = int(m.group(2))
        c_num = int(m.group(3))
        p_name = m.group(4)
        file_edits[path].append((l_num, c_num, p_name))

for path, edits in file_edits.items():
    # Sort by line descending, column descending so that insertions don't affect previous offsets
    edits.sort(key=lambda x: (x[0], x[1]), reverse=True)
    full_path = "apps/web/" + path
    try:
        with open(full_path, "r", encoding="utf-8") as f:
            lines = f.read().split('\n')
        
        for l_num, c_num, p_name in edits:
            line_idx = l_num - 1
            # column number is 1-based, we want 0-based
            c_idx = c_num - 1
            
            # The column points to the start of the parameter name. We need to append ': any' right after it.
            # E.g., if p_name is 'tx', we insert ': any' at c_idx + len(p_name)
            
            insert_pos = c_idx + len(p_name)
            
            orig_line = lines[line_idx]
            if orig_line[c_idx:insert_pos] == p_name:
                lines[line_idx] = orig_line[:insert_pos] + ": any" + orig_line[insert_pos:]
            else:
                print(f"Warning: could not find {p_name} at col {c_num} on line {l_num} in {full_path}")
        
        with open(full_path, "w", encoding="utf-8") as f:
            f.write('\n'.join(lines))
    except Exception as e:
        print(f"Failed to process {full_path}: {e}")

