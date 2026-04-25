# AI Trading Analyst Dashboard

AI Trading Analyst Dashboard adalah sistem pendukung keputusan untuk trading crypto manual.

Produk ini membantu pengguna memantau watchlist, memahami kondisi pasar lebih cepat, menerima analisis dan alert yang terstruktur, lalu menjaga keputusan tetap konsisten antara dashboard web dan chat layer. Eksekusi trading tetap dilakukan di aplikasi broker atau exchange eksternal.

## Product Intent

Fokus utama produk ini adalah mengubah data pasar yang tersebar menjadi keputusan yang lebih jelas dan bisa diaudit. Sistem ini tidak mengejar spam sinyal atau automasi order, tetapi membantu pengguna menjawab pertanyaan inti:

- aset mana yang layak diperhatikan sekarang
- mengapa aset itu menarik atau berisiko
- apa rencana aksi yang masuk akal
- kapan kondisi analisis sudah tidak valid
- bagaimana analisis berubah saat pengguna sudah punya posisi

Produk ini bukan:

- auto-trading bot
- broker atau exchange
- alat eksekusi order
- sistem copy-trading

## MVP Scope

Phase 1 bersifat crypto-first.

Lingkup MVP saat ini:

- fokus pada aset crypto likuid seperti BTC, ETH, dan SOL
- MVP ini private/internal dulu
- analisis operasional utama berjalan pada timeframe `4H`
- dashboard dan API read view mendukung `1H` dan `4H`
- sistem menghasilkan ranking watchlist, decision card aset, alert bermakna, dan dukungan posisi manual
- hasil analisis tersedia lewat dashboard web dan WhatsApp API chat layer

Di luar MVP:

- saham US
- saham IDX
- sinkronisasi broker
- akuntansi portofolio penuh
- semi-automated trading

## Business Flow

Alur bisnis produk ini secara garis besar adalah:

1. Sistem memantau aset pada watchlist pengguna.
2. Data harga, konteks pasar, sentimen, dan derivatif dikumpulkan untuk aset yang relevan.
3. Mesin indikator menghitung sinyal teknikal deterministik.
4. Signal aggregation layer menyusun snapshot terstruktur dan menghitung `signal_strength_score`.
5. AI analysis engine membaca snapshot tersebut dan menghasilkan analisis penuh, termasuk state, alasan utama, concern, rencana aksi, dan invalidation.
6. Sistem mendeteksi perubahan kondisi penting lalu mengirimkan hasil ke dashboard dan chat layer.
7. Saat pengguna mencatat posisi manual, analisis berikutnya menjadi position-aware dan alert ikut menyesuaikan konteks posisi.

## High-Level Architecture

Arsitektur produk ini dibagi ke beberapa lapisan utama:

- Data ingestion layer
Mengumpulkan data market, market context, derivatives context, dan sentiment dari provider yang sudah disetujui untuk MVP.

- Indicator engine
Mengubah data mentah menjadi sinyal teknikal yang konsisten dan bisa dihitung ulang secara deterministik.

- Signal aggregation layer
Menyusun snapshot terstruktur dan menghitung `signal_strength_score`. Layer ini tidak memutuskan state atau saran trading.

- AI analysis layer
Menjadi inti analisis. AI menerima snapshot yang sudah terstruktur, lalu menghasilkan output typed yang berisi state, confidence, summary, alasan, action plan, dan invalidation.

- Delivery layer
Menyajikan hasil melalui web dashboard, alert pipeline, dan WhatsApp API chat layer.

- Persistence and audit layer
Menyimpan snapshot, hasil analisis, confidence, dan metadata audit agar keputusan bisa dilacak dari waktu ke waktu.

## Operating Principles

Beberapa prinsip arsitektur yang menjadi pegangan repo ini:

- AI adalah analyst utama, bukan sekadar summarizer
- `signal_strength_score` harus dihitung secara deterministik sebelum AI dipanggil
- `ai_confidence` harus tetap berada dalam rentang `signal_strength_score +/- 20`
- crypto adalah prioritas MVP sebelum ekspansi ke saham
- Binance tidak dipakai dalam repository ini
- chat layer pada MVP menggunakan WhatsApp API

## Key Outputs

Setiap aset yang dianalisis diharapkan menghasilkan output inti berikut:

- state aset
- deterministic signal strength
- AI confidence
- ringkasan kondisi
- alasan utama dan concern
- rencana aksi
- invalidation
- panduan risiko dan relevansi timeframe

State utama yang dipakai produk ini:

- `IGNORE`
- `WATCH`
- `PREPARE`
- `ACTIONABLE`
- `IN_POSITION`
- `EXIT_WARNING`
- `INVALID`

## Repository Guide

Dokumen utama repo ini:

- [architecture.md](architecture.md) untuk arah produk dan sistem
- [sprints.md](sprints.md) untuk urutan delivery
- [AGENTS.md](AGENTS.md) untuk aturan eksekusi implementasi
- [docs/development.md](docs/development.md) untuk setup lokal, environment, commands, dan catatan teknis repo
