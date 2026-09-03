export type Language = 'en' | 'ar';

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.expenses': 'Expenses',
    'nav.debts': 'Debts',

    'app.name': 'BirdsEye Finance',

    'settings.title': 'Settings',
    'settings.monthlyIncome': '{{amount}} · Monthly income',
    'settings.appearance': 'Appearance',
    'settings.language': 'Language',
    'settings.fontSize': 'Font Size',
    'settings.baseCurrency': 'Base Currency',
    'settings.backupData': 'Backup & Data',
    'settings.backupDataValue': 'Export (JSON)',
    'settings.notifications': 'Notifications',
    'settings.editProfileComingSoon': 'Editing your profile arrives in Phase 2.',
    'settings.dataComingSoon': 'Backup, export, and import arrive in Phase 2.',
    'settings.back': 'Back',

    'about.version': 'Version {{version}}',

    'placeholder.dashboard.title': 'Dashboard',
    'placeholder.dashboard.subtitle': 'A full financial overview is coming in Phase 5.',
    'placeholder.expenses.title': 'Expenses',
    'placeholder.expenses.subtitle': 'Expense tracking arrives in Phase 4.',
    'placeholder.debts.title': 'Debts',
    'placeholder.debts.subtitle': 'Debt tracking arrives in Phase 3.',

    'common.comingSoon': 'Coming soon',
  },
  ar: {
    'nav.dashboard': 'الرئيسية',
    'nav.expenses': 'المصروفات',
    'nav.debts': 'الديون',

    'app.name': 'بيردز آي فايننس',

    'settings.title': 'الإعدادات',
    'settings.monthlyIncome': '{{amount}} · الدخل الشهري',
    'settings.appearance': 'المظهر',
    'settings.language': 'اللغة',
    'settings.fontSize': 'حجم الخط',
    'settings.baseCurrency': 'العملة الأساسية',
    'settings.backupData': 'النسخ الاحتياطي والبيانات',
    'settings.backupDataValue': 'تصدير (JSON)',
    'settings.notifications': 'الإشعارات',
    'settings.editProfileComingSoon': 'تعديل الملف الشخصي متاح في المرحلة الثانية.',
    'settings.dataComingSoon': 'النسخ الاحتياطي والتصدير والاستيراد متاحة في المرحلة الثانية.',
    'settings.back': 'رجوع',

    'about.version': 'الإصدار {{version}}',

    'placeholder.dashboard.title': 'الرئيسية',
    'placeholder.dashboard.subtitle': 'نظرة مالية شاملة قادمة في المرحلة الخامسة.',
    'placeholder.expenses.title': 'المصروفات',
    'placeholder.expenses.subtitle': 'تتبع المصروفات قادم في المرحلة الرابعة.',
    'placeholder.debts.title': 'الديون',
    'placeholder.debts.subtitle': 'تتبع الديون قادم في المرحلة الثالثة.',

    'common.comingSoon': 'قريباً',
  },
};
