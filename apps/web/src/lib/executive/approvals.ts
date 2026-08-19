import prisma from '@hotel-pms/db';

export async function fetchPendingApprovals(propertyId: string) {
  const pendingRequests = await prisma.approvalRequest.findMany({
    where: {
      propertyId,
      status: 'PENDING'
    },
    orderBy: {
      requestedAt: 'desc'
    },
    take: 10 // only return top 10 for dashboard preview
  });

  const totalAmount = pendingRequests.reduce((sum, req) => {
    return sum + (req.amount ? Number(req.amount) : 0);
  }, 0);

  return {
    pendingCount: pendingRequests.length,
    totalAmount,
    items: pendingRequests.map(req => ({
      id: req.id,
      type: req.type,
      title: `${req.type} Request`,
      amount: req.amount ? Number(req.amount) : 0,
      requestedBy: req.requestedBy, // Ideally join with Staff table to get name
      createdAt: req.requestedAt.toISOString(),
      priority: 'HIGH', // Could be calculated based on amount or type
      status: req.status
    }))
  };
}
