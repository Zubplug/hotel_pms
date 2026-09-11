import { ChannelManagerAdapter } from './ChannelManagerAdapter';
import { ChannelProvider } from './types';
import { ChannexAdapter } from './providers/channex';

// Registry of available provider adapters
const adapters = new Map<string, ChannelManagerAdapter>();

// Auto-register default adapters
adapters.set('CHANNEX', new ChannexAdapter());

export const ProviderFactory = {
  
  /**
   * Register a new adapter implementation
   */
  register(provider: ChannelProvider, adapter: ChannelManagerAdapter) {
    adapters.set(provider, adapter);
  },

  /**
   * Get an adapter implementation for a provider
   */
  getAdapter(provider: ChannelProvider | string): ChannelManagerAdapter {
    const adapter = adapters.get(provider);
    if (!adapter) {
      throw new Error(`[ProviderFactory] No adapter registered for provider: ${provider}`);
    }
    return adapter;
  },
  
  /**
   * List all registered providers
   */
  getAvailableProviders(): string[] {
    return Array.from(adapters.keys());
  }
};
