using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LodgeCore.Desktop.Data.Entities
{
    public class LocalOverrideAudit
    {
        [Key]
        [MaxLength(36)]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        [MaxLength(36)]
        public string PropertyId { get; set; } = string.Empty;

        [MaxLength(36)]
        public string OperatorStaffId { get; set; } = string.Empty;

        [MaxLength(36)]
        public string ManagerStaffId { get; set; } = string.Empty;

        [MaxLength(50)]
        public string Action { get; set; } = string.Empty;

        [MaxLength(50)]
        public string EntityType { get; set; } = string.Empty;

        [MaxLength(36)]
        public string EntityId { get; set; } = string.Empty;

        public string? Reason { get; set; }

        public decimal? Amount { get; set; }

        public string? Metadata { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [MaxLength(20)]
        public string SyncStatus { get; set; } = "PENDING";
    }
}
