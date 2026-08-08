import { MobileNav } from '@/components/layout/mobile-nav';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { OfflineBanner } from '@/components/pwa/offline-banner';
import { ServiceWorkerRegistrar } from '@/components/pwa/service-worker-registrar';

/**
 * Public application shell: sticky header, content, footer, and a bottom
 * navigation bar on small screens. `pb-16` reserves room for that bar so the
 * last row of content is never hidden behind it.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <OfflineBanner />
      <SiteHeader />
      <main id="main" className="flex-1 pb-16 lg:pb-0">
        {children}
      </main>
      <SiteFooter />
      <MobileNav />
      <InstallPrompt />
      <ServiceWorkerRegistrar />
    </div>
  );
}
