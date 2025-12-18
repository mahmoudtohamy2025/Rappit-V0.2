/**
 * Application constants
 */

export const APP_NAME = 'Rappit';
export const APP_DESCRIPTION = 'منصة التجارة الإلكترونية للشرق الأوسط';

export const PLAN_FEATURES: Record<string, string[]> = {
  free: ['orders', 'inventory', 'channels'],
  pro: ['orders', 'inventory', 'channels', 'shipping', 'team', 'analytics'],
  enterprise: [
    'orders',
    'inventory',
    'channels',
    'shipping',
    'team',
    'analytics',
    'api',
    'support',
    'sso',
  ],
};

export const PLAN_LABELS: Record<string, string> = {
  free: 'مجاني',
  pro: 'احترافي',
  enterprise: 'مؤسسي',
};

export const ROLE_LABELS: Record<string, string> = {
  ORG_ADMIN: 'مدير',
  ORG_MEMBER: 'عضو',
  ORG_VIEWER: 'مشاهد',
  ORG_READONLY: 'قراءة فقط',
};

export const FEATURE_LABELS: Record<string, string> = {
  orders: 'إدارة الطلبات',
  inventory: 'إدارة المخزون',
  channels: 'القنوات البيعية',
  shipping: 'الشحن المتقدم',
  team: 'إدارة الفريق',
  analytics: 'التحليلات',
  api: 'واجهة برمجية',
  support: 'الدعم الممتاز',
  sso: 'تسجيل الدخول الموحد',
};

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'نشط',
  PAST_DUE: 'متأخر في الدفع',
  CANCELLED: 'ملغى',
};

export const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/signup',
  '/terms',
  '/privacy',
];

export const AUTH_REQUIRED_ROUTES = ['/select-org'];
