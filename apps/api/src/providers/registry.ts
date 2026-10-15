// Configuration-based provider resolution for backend services (T3.5).
// Services must resolve adapters through this module (which in turn asks the
// shared country config for the right provider id) instead of importing a
// concrete adapter directly.

import { ProviderRegistry } from "@surescore/shared";
import { PaystackProvider } from "./payment/paystack-provider.js";
import { EspnSportsProvider } from "./sports/espn-provider.js";
import { KudiSmsProvider } from "./sms/kudisms-provider.js";
import { CloudflareEmailProvider } from "./email/cloudflare-email-provider.js";

export function createProviderRegistry(env: Env): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.registerPaymentProvider(
    new PaystackProvider({ secretKey: env.PAYSTACK_SECRET_KEY, customerEmail: env.PAYSTACK_CUSTOMER_EMAIL }),
  );
  registry.registerSmsProvider(new KudiSmsProvider({ apiKey: env.KUDISMS_API_KEY, senderId: env.KUDISMS_SENDER_ID }));
  registry.registerEmailProvider(
    new CloudflareEmailProvider({ binding: env.EMAIL, fromAddress: env.EMAIL_FROM_ADDRESS, fromName: env.EMAIL_FROM_NAME }),
  );
  registry.registerSportsProvider(new EspnSportsProvider());
  return registry;
}

export { ProviderRegistry } from "@surescore/shared";
