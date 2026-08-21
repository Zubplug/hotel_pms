namespace LodgeCore.Desktop
{
    public static class PosConstants
    {
        public static class BankTypes
        {
            public const string Server = "SERVER";
            public const string Central = "CENTRAL";
            public const string Emergency = "EMERGENCY";
        }

        public static class BankingModels
        {
            public const string ServerBanking = "SERVER_BANKING";
            public const string CentralCashier = "CENTRAL_CASHIER";
        }

        public static class CashAccountTypes
        {
            public const string Safe = "SAFE";
            public const string ServerBank = "SERVER_BANK";
            public const string StationBank = "STATION_BANK";
            public const string EmergencyBank = "EMERGENCY_BANK";
            public const string BankAccount = "BANK_ACCOUNT";
            public const string External = "EXTERNAL";
        }

        public static class HandoverTypes
        {
            public const string ServerHandover = "SERVER_HANDOVER";
            public const string StationHandover = "STATION_HANDOVER";
            public const string EmergencyHandover = "EMERGENCY_HANDOVER";
        }

        public static class SessionStatus
        {
            public const string Open = "OPEN";
            public const string Closed = "CLOSED";
        }
    }
}
