/**
 * Reference taxonomy shipped with the platform. Admins can add, rename,
 * reorder or deactivate categories at runtime from /admin/categories — these
 * values are only the starting set, not hardcoded UI content.
 */

export type CategorySeed = {
  kind: 'REQUEST' | 'CAMPAIGN' | 'EVENT' | 'MISSION';
  slug: string;
  nameFr: string;
  nameAr: string;
  nameEn: string;
  icon: string;
  color: string;
  sortOrder: number;
};

export const CATEGORIES: CategorySeed[] = [
  // --- Help requests --------------------------------------------------------
  { kind: 'REQUEST', slug: 'medicine', nameFr: 'Médicaments', nameAr: 'أدوية', nameEn: 'Medicine', icon: 'Pill', color: '#DC2626', sortOrder: 10 },
  { kind: 'REQUEST', slug: 'medical-equipment', nameFr: 'Équipement médical', nameAr: 'معدات طبية', nameEn: 'Medical equipment', icon: 'Stethoscope', color: '#0891B2', sortOrder: 20 },
  { kind: 'REQUEST', slug: 'food', nameFr: 'Alimentation', nameAr: 'مواد غذائية', nameEn: 'Food', icon: 'UtensilsCrossed', color: '#EA580C', sortOrder: 30 },
  { kind: 'REQUEST', slug: 'water', nameFr: 'Eau', nameAr: 'ماء', nameEn: 'Water', icon: 'Droplets', color: '#2563EB', sortOrder: 40 },
  { kind: 'REQUEST', slug: 'clothing', nameFr: 'Vêtements', nameAr: 'ملابس', nameEn: 'Clothing', icon: 'Shirt', color: '#7C3AED', sortOrder: 50 },
  { kind: 'REQUEST', slug: 'education', nameFr: 'Éducation & fournitures scolaires', nameAr: 'التعليم واللوازم المدرسية', nameEn: 'Education & school supplies', icon: 'GraduationCap', color: '#0D9488', sortOrder: 60 },
  { kind: 'REQUEST', slug: 'housing', nameFr: 'Logement', nameAr: 'السكن', nameEn: 'Housing', icon: 'Home', color: '#B45309', sortOrder: 70 },
  { kind: 'REQUEST', slug: 'orphan-support', nameFr: 'Soutien aux orphelins', nameAr: 'كفالة اليتيم', nameEn: 'Orphan support', icon: 'HeartHandshake', color: '#16A34A', sortOrder: 80 },
  { kind: 'REQUEST', slug: 'blood-donation', nameFr: 'Don de sang', nameAr: 'التبرع بالدم', nameEn: 'Blood donation', icon: 'HeartPulse', color: '#BE123C', sortOrder: 90 },
  { kind: 'REQUEST', slug: 'emergency', nameFr: 'Urgence', nameAr: 'حالة طارئة', nameEn: 'Emergency', icon: 'Siren', color: '#DC2626', sortOrder: 100 },
  { kind: 'REQUEST', slug: 'other', nameFr: 'Autre besoin', nameAr: 'حاجة أخرى', nameEn: 'Other need', icon: 'CircleEllipsis', color: '#475569', sortOrder: 999 },

  // --- Campaigns ------------------------------------------------------------
  { kind: 'CAMPAIGN', slug: 'water-access', nameFr: "Accès à l'eau", nameAr: 'الوصول إلى الماء', nameEn: 'Water access', icon: 'Droplets', color: '#2563EB', sortOrder: 10 },
  { kind: 'CAMPAIGN', slug: 'food-packages', nameFr: 'Colis alimentaires', nameAr: 'طرود غذائية', nameEn: 'Food packages', icon: 'ShoppingBasket', color: '#EA580C', sortOrder: 20 },
  { kind: 'CAMPAIGN', slug: 'ramadan', nameFr: 'Ramadan', nameAr: 'رمضان', nameEn: 'Ramadan', icon: 'Moon', color: '#7C3AED', sortOrder: 30 },
  { kind: 'CAMPAIGN', slug: 'eid-clothing', nameFr: "Vêtements de l'Aïd", nameAr: 'كسوة العيد', nameEn: 'Eid clothing', icon: 'Shirt', color: '#DB2777', sortOrder: 40 },
  { kind: 'CAMPAIGN', slug: 'school-supplies', nameFr: 'Fournitures scolaires', nameAr: 'اللوازم المدرسية', nameEn: 'School supplies', icon: 'Backpack', color: '#0D9488', sortOrder: 50 },
  { kind: 'CAMPAIGN', slug: 'orphan-support', nameFr: 'Soutien aux orphelins', nameAr: 'كفالة اليتيم', nameEn: 'Orphan support', icon: 'HeartHandshake', color: '#16A34A', sortOrder: 60 },
  { kind: 'CAMPAIGN', slug: 'winter-relief', nameFr: 'Solidarité hiver', nameAr: 'تضامن الشتاء', nameEn: 'Winter relief', icon: 'Snowflake', color: '#0EA5E9', sortOrder: 70 },
  { kind: 'CAMPAIGN', slug: 'medical-aid', nameFr: 'Aide médicale', nameAr: 'المساعدة الطبية', nameEn: 'Medical aid', icon: 'Stethoscope', color: '#0891B2', sortOrder: 80 },
  { kind: 'CAMPAIGN', slug: 'emergency-relief', nameFr: "Secours d'urgence", nameAr: 'الإغاثة العاجلة', nameEn: 'Emergency relief', icon: 'Siren', color: '#DC2626', sortOrder: 90 },
  { kind: 'CAMPAIGN', slug: 'community-projects', nameFr: 'Projets communautaires', nameAr: 'مشاريع مجتمعية', nameEn: 'Community projects', icon: 'Building2', color: '#475569', sortOrder: 100 },

  // --- Events ---------------------------------------------------------------
  { kind: 'EVENT', slug: 'distribution', nameFr: 'Distribution', nameAr: 'توزيع', nameEn: 'Distribution', icon: 'PackageOpen', color: '#EA580C', sortOrder: 10 },
  { kind: 'EVENT', slug: 'blood-drive', nameFr: 'Collecte de sang', nameAr: 'حملة تبرع بالدم', nameEn: 'Blood drive', icon: 'HeartPulse', color: '#BE123C', sortOrder: 20 },
  { kind: 'EVENT', slug: 'celebration', nameFr: 'Célébration', nameAr: 'احتفال', nameEn: 'Celebration', icon: 'PartyPopper', color: '#DB2777', sortOrder: 30 },
  { kind: 'EVENT', slug: 'medical-caravan', nameFr: 'Caravane médicale', nameAr: 'قافلة طبية', nameEn: 'Medical caravan', icon: 'Ambulance', color: '#0891B2', sortOrder: 40 },
  { kind: 'EVENT', slug: 'cleanup', nameFr: 'Nettoyage citoyen', nameAr: 'حملة تنظيف', nameEn: 'Community cleanup', icon: 'Trash2', color: '#16A34A', sortOrder: 50 },
  { kind: 'EVENT', slug: 'tree-planting', nameFr: "Plantation d'arbres", nameAr: 'غرس الأشجار', nameEn: 'Tree planting', icon: 'TreePine', color: '#15803D', sortOrder: 60 },
  { kind: 'EVENT', slug: 'awareness', nameFr: 'Sensibilisation', nameAr: 'التوعية', nameEn: 'Awareness', icon: 'Megaphone', color: '#7C3AED', sortOrder: 70 },
  { kind: 'EVENT', slug: 'training', nameFr: 'Formation', nameAr: 'تكوين', nameEn: 'Training', icon: 'BookOpen', color: '#0D9488', sortOrder: 80 },
  { kind: 'EVENT', slug: 'other', nameFr: 'Autre événement', nameAr: 'حدث آخر', nameEn: 'Other event', icon: 'CalendarDays', color: '#475569', sortOrder: 999 },

  // --- Volunteer missions ---------------------------------------------------
  { kind: 'MISSION', slug: 'distribution', nameFr: 'Distribution', nameAr: 'توزيع', nameEn: 'Distribution', icon: 'PackageOpen', color: '#EA580C', sortOrder: 10 },
  { kind: 'MISSION', slug: 'logistics', nameFr: 'Logistique', nameAr: 'اللوجستيك', nameEn: 'Logistics', icon: 'Truck', color: '#B45309', sortOrder: 20 },
  { kind: 'MISSION', slug: 'transport', nameFr: 'Transport', nameAr: 'النقل', nameEn: 'Transport', icon: 'Car', color: '#2563EB', sortOrder: 30 },
  { kind: 'MISSION', slug: 'medical', nameFr: 'Médical', nameAr: 'طبي', nameEn: 'Medical', icon: 'Stethoscope', color: '#0891B2', sortOrder: 40 },
  { kind: 'MISSION', slug: 'teaching', nameFr: 'Enseignement & soutien scolaire', nameAr: 'التدريس والدعم المدرسي', nameEn: 'Teaching & tutoring', icon: 'GraduationCap', color: '#0D9488', sortOrder: 50 },
  { kind: 'MISSION', slug: 'administrative', nameFr: 'Administratif', nameAr: 'إداري', nameEn: 'Administrative', icon: 'ClipboardList', color: '#475569', sortOrder: 60 },
  { kind: 'MISSION', slug: 'communication', nameFr: 'Communication', nameAr: 'الاتصال', nameEn: 'Communication', icon: 'Megaphone', color: '#7C3AED', sortOrder: 70 },
  { kind: 'MISSION', slug: 'translation', nameFr: 'Traduction', nameAr: 'الترجمة', nameEn: 'Translation', icon: 'Languages', color: '#DB2777', sortOrder: 80 },
  { kind: 'MISSION', slug: 'other', nameFr: 'Autre mission', nameAr: 'مهمة أخرى', nameEn: 'Other mission', icon: 'CircleEllipsis', color: '#475569', sortOrder: 999 },
];
