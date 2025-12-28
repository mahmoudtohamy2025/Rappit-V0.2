import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/Auth/LoginForm';
import { getServerAccountContext } from '@/lib/auth/getServerAccountContext';

/**
 * Login Page
 *
 * Public page for authentication
 * Redirects to dashboard if already logged in
 */
export default async function LoginPage() {
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
              منصة التجارة الإلكترونية للشرق الأوسط
            </p>
          </div>

          {/* Login Form */}
          <LoginForm />

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              ليس لديك حساب؟{' '}
              <a
                href="/auth/signup"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                سجل الآن
              </a>
            </p>
          </div>
        </div>

        {/* Demo Credentials (Development only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-4 bg-white rounded-lg shadow text-sm">
            <p className="font-semibold text-gray-700 mb-2">
              Demo Credentials:
            </p>
            <p className="text-gray-600">
              Email: admin@example.com<br />
              Password: password123
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
