-- Update existing templates to Indonesian
UPDATE broadcast_templates 
SET 
  name = 'Pesan Selamat Datang',
  description = 'Sambut pengguna baru',
  message_template = 'Selamat datang di HalloWa, {{nama}}! 🎉 Kami senang Anda bergabung. Butuh bantuan untuk memulai? Balas BANTUAN untuk bantuan.',
  variables = '["nama"]'::jsonb
WHERE id = 'c809c307-6050-4cdf-9109-75111d3615f6';

UPDATE broadcast_templates 
SET 
  name = 'Penawaran Upgrade Paket',
  description = 'Promosi upgrade paket',
  message_template = 'Hai {{nama}}! Upgrade ke paket Premium kami dan dapatkan diskon {{diskon}}% untuk bulan pertama. Penawaran terbatas! Balas UPGRADE untuk info lebih lanjut.',
  variables = '["nama", "diskon"]'::jsonb
WHERE id = '11fd9cd2-ae92-4d63-9f31-37b7d24acd8c';

UPDATE broadcast_templates 
SET 
  name = 'Pengumuman Layanan',
  description = 'Pengumuman layanan umum',
  message_template = 'Pengumuman Penting: {{pengumuman}}. Terima kasih atas perhatian Anda.',
  variables = '["pengumuman"]'::jsonb
WHERE id = 'd103c3a5-86a9-4372-b0c8-54ae663a01c2';

UPDATE broadcast_templates 
SET 
  name = 'Langganan Akan Berakhir (Salinan)',
  description = 'Notifikasi langganan akan segera berakhir',
  message_template = 'Hai {{nama}}, langganan Anda akan berakhir dalam {{hari}} hari. Silakan perpanjang untuk tetap menggunakan layanan kami. Balas YA untuk perpanjang sekarang.',
  variables = '["nama", "hari"]'::jsonb
WHERE id = 'fe0d703c-0ab3-423e-a961-ee5c3b9096a5';

UPDATE broadcast_templates 
SET 
  name = 'Pengingat Pembayaran',
  description = 'Pengingat untuk pembayaran tertunda',
  message_template = 'Hai {{nama}}, Anda memiliki pembayaran tertunda sebesar {{jumlah}}. Harap selesaikan pembayaran Anda untuk menghindari gangguan layanan.',
  variables = '["nama", "jumlah"]'::jsonb
WHERE id = 'bdf666d4-f1d9-4b91-8a14-d99e2f2e82c1';

UPDATE broadcast_templates 
SET 
  name = 'Langganan Akan Berakhir',
  description = 'Notifikasi langganan akan segera berakhir',
  message_template = 'Hai {{nama}}, langganan Anda akan berakhir dalam {{hari}} hari. Silakan perpanjang untuk tetap menggunakan layanan kami. Balas YA untuk perpanjang sekarang.',
  variables = '["nama", "hari"]'::jsonb
WHERE id = '123dc467-9ff8-40d3-a0d4-6ee3eba9f4ba';