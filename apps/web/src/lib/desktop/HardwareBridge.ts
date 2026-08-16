import { invokeDesktop } from './IpcBridge';

export const HardwareBridge = {
  isAvailable: () => typeof window !== 'undefined' && !!(window as any).chrome?.webview,
  
  readCard: async () => {
    return invokeDesktop('hardware.readCard');
  },
  
  encodeCard: async (lockCode: string) => {
    return invokeDesktop('hardware.encodeCard', { lockCode });
  },
  
  cancelCard: async () => {
    return invokeDesktop('hardware.cancelCard');
  }
};
