import { redirect } from 'next/navigation';
import { getServerAccountContext } from '@/lib/auth/getServerAccountContext';
import { OrgSelector } from './OrgSelector';

/**
 * Select Organization Page
 *
 * Shown when user has multiple organizations and hasn't selected one yet
 */
export default async function SelectOrgPage({
  searchParams,
}: {
  searchParams: { redirect?: string };
}) {
  const context = await getServerAccountContext();

  if (!context) {
    redirect('/auth/login');
  }

  const { organizations, selectedOrg } = context;

  // If only one org, redirect immediately
  if (organizations.length === 1) {
    redirect(searchParams.redirect || '/');
  }

  // If org already selected, redirect
  if (selectedOrg && searchParams.redirect) {
    redirect(searchParams.redirect);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              اختر المؤسسة
            </h1>
            <p className="text-gray-600">
              اختر المؤسسة التي تريد العمل معها
            </p>
          </div>

          {/* Organization List */}
          <OrgSelector
            organizations={organizations}
            redirectTo={searchParams.redirect || '/'}
          />
        </div>
      </div>
    </div>
  );
}
