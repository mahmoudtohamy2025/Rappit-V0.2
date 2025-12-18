import { redirect } from 'next/navigation';
import { SignupForm } from '@/components/Auth/SignupForm';
import { getServerAccountContext } from '@/lib/auth/getServerAccountContext';

/**
 * Signup Page (Optional)
 *
 * Public page for user registration
 * Redirects to dashboard if already logged in
 */
export default async function SignupPage() {
  const context = await getServerAccountContext();

  // Already authenticated - redirect to dashboard
  if (context) {
    redirect('/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-primary-600 mb-2">
              Rappit
            </h1>
            <p className="text-gray-600">
              إنشاء حساب جديد
            </p>
          </div>

          {/* Signup Form */}
          <SignupForm />

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              لديك حساب بالفعل؟{' '}
              <a
                href="/auth/login"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                سجل الدخول
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
