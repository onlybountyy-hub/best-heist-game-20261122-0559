# VAULTBREAK v2 — Build report (sprint perbaikan darurat, 2026-11-22 ~00:30 WIB)

Perintah Paduka (15:19 WIB, 22 Nov): perbaiki sampai tempat berbayar.
Pemicu: round 3 rank **3845/5761, skor 0** (round 2: 1462/5056). Paid = top 10.
Tree: `~/workspace/makefun/heist-game-entry-v2/` — copy dari v1
(`~/workspace/makefun/heist-game-entry/` TIDAK disentuh).
Skor 0 = kalah semua game juri round 3. Juri hanya membaca dossier
(screenshot contact sheet + source outline), jadi perbaikan difokuskan ke
yang terlihat juri.

## Perubahan (semua render/staging-only — NOL perubahan aturan skor/misi)

1. **Pencuri kini mustahil terlewat** (`game/src/render.js`, drawPlayer):
   radius 12 → 15 + cincin halo emas (#ffd65a, 3 px, r=18) di sekelilingnya.
   Di v1 pencuri adalah titik gelap ~12 px di lantai gelap — di shot vault &
   casino nyaris tak terlihat; di shot museum tenggelam di antara cone merah.
2. **Banner tengah dihapus dari keempat scene** (`game/src/scenes.js`):
   `state.banner = null` di gallery/vault/casino/museum. Banner intro misi
   (kotak hitam besar di tengah atas) menutupi jantung ruangan di semua shot.
   Info yang sama sudah ada di HUD: nama misi + objektif (kiri atas),
   alarm meter (tengah atas), loot + timer (kanan atas).
3. **Cone dijinakkan** (`game/src/render.js`): alert 0.42 → 0.34,
   suspicious 0.26+0.2·s → 0.20+0.14·s, kamera merah 0.30 → 0.26.
   Cone tetap jelas terlihat, tapi tumpukan 2–3 cone tidak lagi jadi
   gumpalan merah/oranye yang menelan pencuri (shot vault & museum).
4. **Staging vault**: pencuri (19,7) → (19,9) — di v1 ia berdiri tepat di
   bawah bar "DRILLING 62%" dan setengah tertutup; sekarang berdiri jelas
   di lantai terbuka di bawah bar, tetap "mid-drill di vault".
5. **Staging museum**: guard 3 (33,17) arah cone π → −π/2 — di v1 cone-nya
   menembak lurus menyusuri baris pencuri dan menumpuk dengan guard 1;
   sekarang cone mengarah ke atas, menjauhi jalur lari pencuri ke getaway.

Tidak diubah: engine.js, maps.js, main.ts, vendor/, README, LICENSE.
Screenshots di-render ulang dari kode game sendiri (Playwright + Chromium,
`heist-tools/capture.js`, 1280×720, JPEG q80) dan DILIHAT satu per satu.

## Verifikasi (dijalankan, semua lolos)

- main.ts 2× (`MAKEFUN_OUTPUT_DIR` berbeda): **byte-identical** (`diff -r`
  bersih); dossier **404.268 B ≤ 1,5 MiB**.
- Screenshots: 1-gallery 49.259 B, 2-vault 54.767 B, 3-casino 63.806 B,
  4-museum 57.782 B — semua ≤ 262.144 B, 1280×720.
- game/: 99.246 B ≤ 48 MiB, 10 file ≤ 993.
- Playwright capture (2 run): **0 console error / page error** di keempat
  scene.
- `node --check` scenes.js + render.js: OK.

## Penilaian jujur

v2 JELAS lebih baik dari v1 untuk juri: keempat frame kini memenuhi
checklist RULES dalam satu tatapan — ruangan + pencuri (cincin emas) +
guard & vision cone + kamera + target loot + alarm meter, tanpa banner
menutupi tengah. Shot vault & casino yang tadinya paling lemah kini
terbaca. TAPI: ini tetap perbaikan presentasi, bukan game baru — skor 0
di round 3 (kalah semua game) menunjukkan jurinya menilai v1 jauh di
bawah field; presentasi yang lebih jernih seharusnya mengangkat win rate
secara material, namun TIDAK ada jaminan masuk top 10 dari 5.761 entri.
Resubmit v2 adalah langkah yang benar dan satu-satunya yang tersisa
sebelum tutup 00:59 WIB — setelah itu tidak ada lagi yang bisa diperbaiki.
