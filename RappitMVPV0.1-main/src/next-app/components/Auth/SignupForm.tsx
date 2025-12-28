'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/UI/Button';
import { Input } from '@/components/UI/Input';
import { apiFetch } from '@/lib/fetcher';

export function SignupForm() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    accountName: '',
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validateForm = () => {
    if (!formData.name || !formData.email || !formData.password || !formData.accountName) {
      setError('جميع الحقول مطلوبة');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('كلمات المرور غير متطابقة');
      return false;
    }

    if (formData.password.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('البريد الإلكتروني غير صحيح');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // TODO: Call backend signup endpoint
      // For now, show placeholder message
      await apiFetch('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          accountName: formData.accountName,
        }),
      });

      // Success - redirect to login
      router.push('/auth/login?message=تم إنشاء الحساب بنجاح');
    } catch (err: any) {
      setError(err.message || 'فشل إنشاء الحساب. حاول مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md">
      <div>
        <Input
          type="text"
          name="name"
          label="الاسم الكامل"
          placeholder="أحمد علي"
          value={formData.name}
          onChange={handleChange}
          required
          disabled={isLoading}
        />
      </div>

      <div>
        <Input
          type="email"
          name="email"
          label="البريد الإلكتروني"
          placeholder="admin@example.com"
          value={formData.email}
          onChange={handleChange}
          required
          disabled={isLoading}
          autoComplete="email"
        />
      </div>

      <div>
        <Input
          type="text"
          name="accountName"
          label="اسم الشركة"
          placeholder="شركة التجارة الإلكترونية"
          value={formData.accountName}
          onChange={handleChange}
          required
          disabled={isLoading}
        />
      </div>

      <div>
        <Input
          type="password"
          name="password"
          label="كلمة المرور"
          placeholder="••••••••"
          value={formData.password}
          onChange={handleChange}
          required
          disabled={isLoading}
          autoComplete="new-password"
        />
      </div>

      <div>
        <Input
          type="password"
          name="confirmPassword"
          label="تأكيد كلمة المرور"
          placeholder="••••••••"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
          disabled={isLoading}
          autoComplete="new-password"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        isLoading={isLoading}
      >
        {isLoading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
      </Button>

      <div className="text-xs text-gray-500 text-center">
        بإنشاء حساب، أنت توافق على{' '}
        <a href="/terms" className="text-primary-600 hover:underline">
          شروط الخدمة
        </a>{' '}
        و{' '}
        <a href="/privacy" className="text-primary-600 hover:underline">
          سياسة الخصوصية
        </a>
      </div>
    </form>
  );
}
