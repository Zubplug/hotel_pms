namespace LodgeCore.HardwareAgent.Native;

public enum HomeLockError
{
    OPR_OK = 1,
    NO_CARD = -1,
    NO_RW_MACHINE = -2,
    INVALID_CARD = -3,
    CARD_TYPE_ERROR = -4,
    RDWR_ERROR = -5,
    PORT_NOT_OPEN = -6,
    END_OF_DATA_CARD = -7,
    INVALID_PARAMETER = -8,
    INVALID_OPR = -9,
    OTHER_ERROR = -10,
    PORT_IN_USED = -11,
    COMM_ERROR = -12,
    ERR_CLIENT = -20,
    ERR_NOT_REGISTERED = -29,
    ERR_NO_CLIENT_DATA = -30,
    ERR_ROOMS_CNT_OVER = -31
}

public class HomeLockResult
{
    public bool Success { get; }
    public HomeLockError Code { get; }
    public string Message => Code.ToString();

    public HomeLockResult(int code)
    {
        Code = (HomeLockError)code;
        Success = Code == HomeLockError.OPR_OK;
    }
}
