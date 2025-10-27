// scripts/fetchLatencyHistory.js

import axios from 'axios';
import pool from '../config/database.js';
import dayjs from 'dayjs';

/**
 * Helper untuk mengubah string latensi (misal: "5h", "10m", "3d") menjadi detik.
 */
const parseLatencyToSeconds = (latencyString) => {
  if (!latencyString || typeof latencyString !== 'string' || latencyString.toUpperCase() === 'NA') {
    return null;
  }
  const value = parseFloat(latencyString);
  if (isNaN(value)) return null;
  
  if (latencyString.endsWith('h')) return value * 3600;
  if (latencyString.endsWith('d')) return value * 24 * 60 * 60;
  if (latencyString.endsWith('m')) return value * 60;

  return value; // Dianggap detik jika tidak ada satuan
};

/**
 * Fungsi utama untuk mengambil data dari API, memformatnya, dan menyimpannya ke database.
 */
export async function runLatencyTask() {
  console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 🚀 Memulai tugas pengambilan data latensi...`);

  try {
    const url = 'http://server-app:5000/api/dashboard/slmon/laststatus';
    console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 🔗 Memanggil API: ${url}`);

    const response = await axios.get(url, {
      timeout: 90000,
      headers: { Accept: 'application/json' },
    });

    const features = response.data?.features;

    if (!Array.isArray(features) || features.length === 0) {
      console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 🟡 Tidak ada data latensi yang ditemukan dari API.`);
      return;
    }

    // columns list (tetap sama supaya fungsi tidak berubah)
    const columns = [
      'sta', 'ipaddr', 'net', 'time_from_api', 
      'latency1', 'latency2', 'latency3', 'latency4', 'latency5', 'latency6',
      'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6',
      'location', 'provin', 'uptbmkg', 'longitude', 'latitude'
    ];

    let processedCount = 0;
    let insertedCount = 0;
    let skippedCount = 0;

    const dataToInsert = [];

    for (const feature of features) {
      try {
        const props = feature.properties || {};
        const coords = feature.geometry?.coordinates || [];
        const timeFromApi = props.time ? dayjs(props.time).format('YYYY-MM-DD HH:mm:ss') : null;

        // Duplicate check: skip if an identical sta + time_from_api already exists
        if (props.sta && timeFromApi) {
          try {
            const [existingRows] = await pool.query(
              `SELECT latency_history_id FROM latency_history WHERE sta = ? AND time_from_api = ? LIMIT 1`,
              [props.sta, timeFromApi]
            );
            if (existingRows && existingRows.length > 0) {
              skippedCount++;
              continue; // skip this feature
            }
          } catch (checkErr) {
            // jika check gagal, log dan lanjutkan (tidak memblokir seluruh proses)
            console.warn(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] ⚠️ Gagal mengecek duplikasi untuk ${props.sta} ${timeFromApi}:`, checkErr.message || checkErr);
          }
        }

        const row = [
          props.sta, props.ipaddr, props.net,
          timeFromApi,
          parseLatencyToSeconds(props.latency1), parseLatencyToSeconds(props.latency2),
          parseLatencyToSeconds(props.latency3), parseLatencyToSeconds(props.latency4),
          parseLatencyToSeconds(props.latency5), parseLatencyToSeconds(props.latency6),
          props.ch1, props.ch2, props.ch3, props.ch4, props.ch5, props.ch6,
          props.location, props.provin, props.uptbmkg,
          coords && coords[0] ? parseFloat(coords[0]) : null,
          coords && coords[1] ? parseFloat(coords[1]) : null,
        ];

        dataToInsert.push(row);
        processedCount++;
      } catch (innerErr) {
        console.error(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] ❌ Error memproses fitur latensi:`, innerErr.message || innerErr);
        // lanjutkan ke fitur berikutnya
      }
    }

    if (dataToInsert.length === 0) {
      console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] ℹ️ Tidak ada data baru untuk disimpan (semua duplikat atau kosong).`);
      console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}]    Diproses: ${processedCount}, Dimasukkan: ${insertedCount}, Dilewati: ${skippedCount}`);
      return;
    }

    // Insert batch dengan penanganan error
    try {
      const sql = `INSERT INTO latency_history (${columns.join(', ')}) VALUES ?`;
      const [result] = await pool.query(sql, [dataToInsert]);
      insertedCount = dataToInsert.length;
      console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] ✅ Berhasil menyimpan ${insertedCount} data latensi ke database.`);
    } catch (insertErr) {
      console.error(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] ❌ Gagal menyimpan data latensi ke database:`, insertErr.message || insertErr);
      // lempar agar caller (scheduler) bisa menangani retry sesuai mekanisme yang ada
      throw insertErr;
    }

    console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] ✅ Pengambilan latensi selesai:`);
    console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}]    📊 Diproses: ${processedCount}`);
    console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}]    💾 Dimasukkan: ${insertedCount}`);
    console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}]    ⏭️ Dilewati: ${skippedCount}`);

  } catch (error) {
    console.error(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] ❌ Gagal menjalankan tugas:`, error?.message || error);
    // Melempar ulang agar mekanisme retry di scheduler masih bekerja
    throw error;
  }
}
