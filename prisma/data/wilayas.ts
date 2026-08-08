/**
 * Official Algerian wilayas (58, post-2019 administrative reform).
 * Reference data only — this is not demo/activity data.
 *
 * `id` is the official wilaya number. `code` is the zero-padded matricule
 * used on plates and administrative documents.
 * Coordinates point at the wilaya capital (chef-lieu) and are used only to
 * centre the map when a user filters by wilaya.
 */

export type WilayaSeed = {
  id: number;
  code: string;
  nameFr: string;
  nameAr: string;
  nameEn: string;
  latitude: number;
  longitude: number;
};

export const WILAYAS: WilayaSeed[] = [
  { id: 1, code: '01', nameFr: 'Adrar', nameAr: 'أدرار', nameEn: 'Adrar', latitude: 27.8742, longitude: -0.2939 },
  { id: 2, code: '02', nameFr: 'Chlef', nameAr: 'الشلف', nameEn: 'Chlef', latitude: 36.1652, longitude: 1.3345 },
  { id: 3, code: '03', nameFr: 'Laghouat', nameAr: 'الأغواط', nameEn: 'Laghouat', latitude: 33.8004, longitude: 2.8652 },
  { id: 4, code: '04', nameFr: 'Oum El Bouaghi', nameAr: 'أم البواقي', nameEn: 'Oum El Bouaghi', latitude: 35.8753, longitude: 7.1135 },
  { id: 5, code: '05', nameFr: 'Batna', nameAr: 'باتنة', nameEn: 'Batna', latitude: 35.5559, longitude: 6.1741 },
  { id: 6, code: '06', nameFr: 'Béjaïa', nameAr: 'بجاية', nameEn: 'Bejaia', latitude: 36.7515, longitude: 5.0567 },
  { id: 7, code: '07', nameFr: 'Biskra', nameAr: 'بسكرة', nameEn: 'Biskra', latitude: 34.8504, longitude: 5.7281 },
  { id: 8, code: '08', nameFr: 'Béchar', nameAr: 'بشار', nameEn: 'Bechar', latitude: 31.6167, longitude: -2.2167 },
  { id: 9, code: '09', nameFr: 'Blida', nameAr: 'البليدة', nameEn: 'Blida', latitude: 36.4703, longitude: 2.8277 },
  { id: 10, code: '10', nameFr: 'Bouira', nameAr: 'البويرة', nameEn: 'Bouira', latitude: 36.3739, longitude: 3.9024 },
  { id: 11, code: '11', nameFr: 'Tamanrasset', nameAr: 'تمنراست', nameEn: 'Tamanrasset', latitude: 22.785, longitude: 5.5228 },
  { id: 12, code: '12', nameFr: 'Tébessa', nameAr: 'تبسة', nameEn: 'Tebessa', latitude: 35.4042, longitude: 8.1244 },
  { id: 13, code: '13', nameFr: 'Tlemcen', nameAr: 'تلمسان', nameEn: 'Tlemcen', latitude: 34.8828, longitude: -1.3167 },
  { id: 14, code: '14', nameFr: 'Tiaret', nameAr: 'تيارت', nameEn: 'Tiaret', latitude: 35.3711, longitude: 1.317 },
  { id: 15, code: '15', nameFr: 'Tizi Ouzou', nameAr: 'تيزي وزو', nameEn: 'Tizi Ouzou', latitude: 36.7118, longitude: 4.0435 },
  { id: 16, code: '16', nameFr: 'Alger', nameAr: 'الجزائر', nameEn: 'Algiers', latitude: 36.7538, longitude: 3.0588 },
  { id: 17, code: '17', nameFr: 'Djelfa', nameAr: 'الجلفة', nameEn: 'Djelfa', latitude: 34.6704, longitude: 3.263 },
  { id: 18, code: '18', nameFr: 'Jijel', nameAr: 'جيجل', nameEn: 'Jijel', latitude: 36.8206, longitude: 5.7667 },
  { id: 19, code: '19', nameFr: 'Sétif', nameAr: 'سطيف', nameEn: 'Setif', latitude: 36.1911, longitude: 5.4137 },
  { id: 20, code: '20', nameFr: 'Saïda', nameAr: 'سعيدة', nameEn: 'Saida', latitude: 34.8303, longitude: 0.1517 },
  { id: 21, code: '21', nameFr: 'Skikda', nameAr: 'سكيكدة', nameEn: 'Skikda', latitude: 36.876, longitude: 6.9094 },
  { id: 22, code: '22', nameFr: 'Sidi Bel Abbès', nameAr: 'سيدي بلعباس', nameEn: 'Sidi Bel Abbes', latitude: 35.1878, longitude: -0.6308 },
  { id: 23, code: '23', nameFr: 'Annaba', nameAr: 'عنابة', nameEn: 'Annaba', latitude: 36.9, longitude: 7.7667 },
  { id: 24, code: '24', nameFr: 'Guelma', nameAr: 'قالمة', nameEn: 'Guelma', latitude: 36.4622, longitude: 7.4262 },
  { id: 25, code: '25', nameFr: 'Constantine', nameAr: 'قسنطينة', nameEn: 'Constantine', latitude: 36.365, longitude: 6.6147 },
  { id: 26, code: '26', nameFr: 'Médéa', nameAr: 'المدية', nameEn: 'Medea', latitude: 36.2675, longitude: 2.7539 },
  { id: 27, code: '27', nameFr: 'Mostaganem', nameAr: 'مستغانم', nameEn: 'Mostaganem', latitude: 35.9315, longitude: 0.0892 },
  { id: 28, code: '28', nameFr: "M'Sila", nameAr: 'المسيلة', nameEn: "M'Sila", latitude: 35.7058, longitude: 4.5419 },
  { id: 29, code: '29', nameFr: 'Mascara', nameAr: 'معسكر', nameEn: 'Mascara', latitude: 35.3968, longitude: 0.1401 },
  { id: 30, code: '30', nameFr: 'Ouargla', nameAr: 'ورقلة', nameEn: 'Ouargla', latitude: 31.9527, longitude: 5.3335 },
  { id: 31, code: '31', nameFr: 'Oran', nameAr: 'وهران', nameEn: 'Oran', latitude: 35.6971, longitude: -0.6308 },
  { id: 32, code: '32', nameFr: 'El Bayadh', nameAr: 'البيض', nameEn: 'El Bayadh', latitude: 33.6831, longitude: 1.0192 },
  { id: 33, code: '33', nameFr: 'Illizi', nameAr: 'إليزي', nameEn: 'Illizi', latitude: 26.4833, longitude: 8.4667 },
  { id: 34, code: '34', nameFr: 'Bordj Bou Arréridj', nameAr: 'برج بوعريريج', nameEn: 'Bordj Bou Arreridj', latitude: 36.0731, longitude: 4.7614 },
  { id: 35, code: '35', nameFr: 'Boumerdès', nameAr: 'بومرداس', nameEn: 'Boumerdes', latitude: 36.7664, longitude: 3.4772 },
  { id: 36, code: '36', nameFr: 'El Tarf', nameAr: 'الطارف', nameEn: 'El Tarf', latitude: 36.7672, longitude: 8.3139 },
  { id: 37, code: '37', nameFr: 'Tindouf', nameAr: 'تندوف', nameEn: 'Tindouf', latitude: 27.6742, longitude: -8.1478 },
  { id: 38, code: '38', nameFr: 'Tissemsilt', nameAr: 'تيسمسيلت', nameEn: 'Tissemsilt', latitude: 35.6072, longitude: 1.8111 },
  { id: 39, code: '39', nameFr: 'El Oued', nameAr: 'الوادي', nameEn: 'El Oued', latitude: 33.3683, longitude: 6.8674 },
  { id: 40, code: '40', nameFr: 'Khenchela', nameAr: 'خنشلة', nameEn: 'Khenchela', latitude: 35.4361, longitude: 7.1436 },
  { id: 41, code: '41', nameFr: 'Souk Ahras', nameAr: 'سوق أهراس', nameEn: 'Souk Ahras', latitude: 36.2864, longitude: 7.9511 },
  { id: 42, code: '42', nameFr: 'Tipaza', nameAr: 'تيبازة', nameEn: 'Tipaza', latitude: 36.5894, longitude: 2.4478 },
  { id: 43, code: '43', nameFr: 'Mila', nameAr: 'ميلة', nameEn: 'Mila', latitude: 36.4503, longitude: 6.2644 },
  { id: 44, code: '44', nameFr: 'Aïn Defla', nameAr: 'عين الدفلى', nameEn: 'Ain Defla', latitude: 36.2639, longitude: 1.9681 },
  { id: 45, code: '45', nameFr: 'Naâma', nameAr: 'النعامة', nameEn: 'Naama', latitude: 33.2667, longitude: -0.3167 },
  { id: 46, code: '46', nameFr: 'Aïn Témouchent', nameAr: 'عين تموشنت', nameEn: 'Ain Temouchent', latitude: 35.2978, longitude: -1.14 },
  { id: 47, code: '47', nameFr: 'Ghardaïa', nameAr: 'غرداية', nameEn: 'Ghardaia', latitude: 32.4911, longitude: 3.6736 },
  { id: 48, code: '48', nameFr: 'Relizane', nameAr: 'غليزان', nameEn: 'Relizane', latitude: 35.7372, longitude: 0.5556 },
  { id: 49, code: '49', nameFr: 'Timimoun', nameAr: 'تيميمون', nameEn: 'Timimoun', latitude: 29.2639, longitude: 0.2306 },
  { id: 50, code: '50', nameFr: 'Bordj Badji Mokhtar', nameAr: 'برج باجي مختار', nameEn: 'Bordj Badji Mokhtar', latitude: 21.325, longitude: 0.9542 },
  { id: 51, code: '51', nameFr: 'Ouled Djellal', nameAr: 'أولاد جلال', nameEn: 'Ouled Djellal', latitude: 34.4239, longitude: 5.0722 },
  { id: 52, code: '52', nameFr: 'Béni Abbès', nameAr: 'بني عباس', nameEn: 'Beni Abbes', latitude: 30.1333, longitude: -2.1667 },
  { id: 53, code: '53', nameFr: 'In Salah', nameAr: 'عين صالح', nameEn: 'In Salah', latitude: 27.1935, longitude: 2.4608 },
  { id: 54, code: '54', nameFr: 'In Guezzam', nameAr: 'عين قزام', nameEn: 'In Guezzam', latitude: 19.5686, longitude: 5.7722 },
  { id: 55, code: '55', nameFr: 'Touggourt', nameAr: 'تقرت', nameEn: 'Touggourt', latitude: 33.1, longitude: 6.0667 },
  { id: 56, code: '56', nameFr: 'Djanet', nameAr: 'جانت', nameEn: 'Djanet', latitude: 24.5544, longitude: 9.4844 },
  { id: 57, code: '57', nameFr: "El M'Ghair", nameAr: 'المغير', nameEn: "El M'Ghair", latitude: 33.9539, longitude: 5.9242 },
  { id: 58, code: '58', nameFr: 'El Meniaa', nameAr: 'المنيعة', nameEn: 'El Meniaa', latitude: 30.5806, longitude: 2.8853 },
];
