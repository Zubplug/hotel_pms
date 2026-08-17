    public async Task<List<LocalProductCategory>> GetCategoriesAsync(string propertyId)
    {
        return await _dbContext.ProductCategories
            .Where(c => c.IsActive && _dbContext.PosOutlets.Any(o => o.Id == c.OutletId && o.PropertyId == propertyId))
            .OrderBy(c => c.SortOrder)
            .ToListAsync();
    }

    public async Task<List<LocalPosOutlet>> GetAuthorizedOutletsAsync(string propertyId, string deviceId)
    {
        return await _dbContext.PosOutlets
            .Where(o => o.PropertyId == propertyId && o.IsActive)
            .ToListAsync();
    }

    public async Task<LocalPosSession> GetSessionContextAsync(string sessionId)
    {
        return await _dbContext.PosSessions.FirstOrDefaultAsync(s => s.Id == sessionId);
    }

    public async Task<List<LocalPosFloorPlan>> GetFloorPlansAsync(string outletId)
    {
        return await _dbContext.PosFloorPlans
            .Where(fp => fp.OutletId == outletId)
            .OrderBy(fp => fp.SortOrder)
            .ToListAsync();
    }

    public async Task<List<LocalPosTable>> GetTablesAsync(string floorPlanId)
    {
        return await _dbContext.PosTables
            .Where(t => t.FloorPlanId == floorPlanId)
            .ToListAsync();
    }

    public async Task<List<LocalPosProductModifier>> GetProductModifiersAsync(string productId)
    {
        return await _dbContext.PosProductModifiers
            .Where(m => m.ProductId == productId && m.IsActive)
            .ToListAsync();
    }

    public async Task<List<LocalPosOrder>> GetServerOrdersAsync(string sessionId, string operatorId, string range, string statusFilter)
    {
        var query = _dbContext.PosOrders
            .Include(o => o.Items)
            .Where(o => o.SessionId == sessionId && o.OperatorId == operatorId);

        if (statusFilter != "all")
        {
            query = query.Where(o => o.Status == statusFilter);
        }

        // Simplistic range filter for offline SQLite
        if (range == "today")
        {
            var start = DateTime.UtcNow.Date;
            query = query.Where(o => o.CreatedAt >= start);
        }

        return await query.OrderByDescending(o => o.CreatedAt).ToListAsync();
    }

    public async Task<object> GetServerSalesAsync(string sessionId, string operatorId)
    {
        var orders = await _dbContext.PosOrders
            .Where(o => o.SessionId == sessionId && o.OperatorId == operatorId)
            .ToListAsync();

        var payments = await _dbContext.PosPayments
            .Where(p => orders.Select(o => o.Id).Contains(p.OrderId))
            .ToListAsync();

        var totalSales = orders.Where(o => o.Status != "VOIDED").Sum(o => o.TotalAmount);
        var totalTips = payments.Sum(p => p.TipAmount);
        var totalVoids = orders.Where(o => o.Status == "VOIDED").Sum(o => o.TotalAmount);
        var orderCount = orders.Count;

        return new
        {
            sales = totalSales,
            tips = totalTips,
            voids = totalVoids,
            orderCount = orderCount
        };
    }
