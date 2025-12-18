import './globals.css';
import type { Metadata } from 'next';
import { getServerAccountContext } from '@/lib/auth/getServerAccountContext';
import { TopBar } from '@/components/AppShell/TopBar';
import { RightSideNav } from '@/components/AppShell/RightSideNav';

export const metadata: Metadata = {
  title: 'Rappit - منصة التجارة الإلكترونية',
  description: 'Multi-tenant SaaS operations hub for MENA e-commerce',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getServerAccountContext();

  return (
    <html lang="ar" dir="rtl">
      <body className="font-sans">
        {context ? (
          /* Authenticated Layout */
          <div className="h-screen flex flex-col">
            <TopBar
              user={context.user}
              account={context.account}
              organizations={context.organizations}
              selectedOrg={context.selectedOrg}
            />

            <div className="flex-1 flex overflow-hidden">
              {/* Main Content */}
              <main className="flex-1 overflow-y-auto">
                {children}
              </main>

              {/* Right Side Navigation */}
              <RightSideNav account={context.account} />
            </div>
          </div>
        ) : (
          /* Unauthenticated Layout (Public pages) */
          <div className="min-h-screen">{children}</div>
        )}
      </body>
    </html>
  );
}
