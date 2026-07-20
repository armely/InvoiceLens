import { RuntimeAuthConfig } from './models.js';

export interface RuntimeConfig {
  auth: RuntimeAuthConfig;
}

declare global {
  interface Window {
    InvoiceLensRuntimeConfig?: RuntimeConfig;
  }
}

export function getRuntimeConfig(): RuntimeConfig {
  return (
    window.InvoiceLensRuntimeConfig ?? {
      auth: {
        clientId: '',
        tenantId: '',
        redirectUri: '',
        postLogoutRedirectUri: '',
        scopes: ['openid', 'profile', 'email', 'User.Read', 'Mail.Send'],
      },
    }
  );
}
