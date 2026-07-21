// Kandidat path & port RTSP untuk auto-probe (Plan #5 — Deteksi Stream Terbaik).
// Dipisah ke modul sendiri supaya mudah dirawat & bisa dipakai ulang (mis. Plan #2 bulk DVR).
//
// Tiap entri path:
//   path  : path RTSP (tanpa leading slash)
//   label : label yang ramah untuk UI
//   main  : true kalau kandidat ini biasanya main-stream (resolusi tinggi)
//
// Sumber: temuan bug SSN-01 (Sekainet/XM), kamera Tuya/Avaro (port 8554 path /main /sub),
// + pola umum merek (Dahua, Hikvision, Reolink, Uniview, Axis, dll).

const RTSP_CANDIDATES = [
    // Tuya / SmartLife / Avaro & generic pendek (dari temuan 10.10.111.4 :8554)
    { path: 'main', label: 'Main Stream', main: true },
    { path: 'sub', label: 'Sub Stream', main: false },

    // Sekainet / XM / V380 (dari temuan SSN-01)
    { path: 'h264/ch1/main/av_stream', label: 'Main Stream', main: true },
    { path: 'h264/ch1/sub/av_stream', label: 'Sub Stream', main: false },

    // Dahua
    { path: 'cam/realmonitor?channel=1&subtype=0', label: 'Dahua Main', main: true },
    { path: 'cam/realmonitor?channel=1&subtype=1', label: 'Dahua Sub', main: false },

    // Hikvision / Hi-Look
    { path: 'Streaming/Channels/101', label: 'Hikvision Main', main: true },
    { path: 'Streaming/Channels/102', label: 'Hikvision Sub', main: false },
    { path: 'h264/ch1/main/av_stream', label: 'Main Stream', main: true },

    // Reolink
    { path: 'h264Preview_01_main', label: 'Reolink Main', main: true },
    { path: 'h264Preview_01_sub', label: 'Reolink Sub', main: false },

    // Uniview (UNV)
    { path: 'media/video1', label: 'Uniview Main', main: true },
    { path: 'media/video2', label: 'Uniview Sub', main: false },
    { path: 'unicast/c1/s0/live', label: 'Uniview Live', main: true },
    { path: 'unicast/c1/s1/live', label: 'Uniview Sub', main: false },

    // Axis
    { path: 'axis-media/media.amp', label: 'Axis Media', main: true },

    // TP-Link Tapo
    { path: 'stream1', label: 'Tapo Main', main: true },
    { path: 'stream2', label: 'Tapo Sub', main: false },

    // Pola profil ONVIF / generik
    { path: 'profile1', label: 'Profile 1', main: true },
    { path: 'profile2', label: 'Profile 2', main: false },
    { path: 'onvif1', label: 'ONVIF 1', main: true },
    { path: 'onvif2', label: 'ONVIF 2', main: false },
    { path: 'video1', label: 'Video 1', main: true },
    { path: 'stream0', label: 'Stream 0', main: true },

    // Pola "live/*"
    { path: 'live/main', label: 'Live Main', main: true },
    { path: 'live/ch00_0', label: 'Live Ch00', main: true },
    { path: 'live/ch01_0', label: 'Live Ch01', main: false },
    { path: 'live/ch0', label: 'Live Ch0', main: false },
    { path: 'live/ch1', label: 'Live Ch1', main: false },
    { path: 'live', label: 'Live', main: true },

    // Generik lain
    { path: '0/av0', label: 'Stream 0', main: true },
    { path: '1/1', label: 'Ch 1/1', main: true },
    { path: 'ch0_0', label: 'Channel 0', main: true },
    { path: '11', label: 'Stream 11', main: true },
    { path: '12', label: 'Stream 12', main: false }
];

// De-duplikasi path (beberapa merek berbagi path yang sama) menjaga urutan pertama.
const _seenPath = new Set();
const RTSP_CANDIDATES_UNIQUE = RTSP_CANDIDATES.filter((c) => {
    if (_seenPath.has(c.path)) return false;
    _seenPath.add(c.path);
    return true;
});

// Port RTSP umum untuk dicoba kalau user tidak menyebut port.
// 554 = standar; 8554 = Tuya/SmartLife/Avaro & banyak generic; 10554 = beberapa NVR;
// 555/5554 = varian lain.
const RTSP_PORTS = [554, 8554, 10554, 555, 5554];

module.exports = {
    RTSP_CANDIDATES: RTSP_CANDIDATES_UNIQUE,
    RTSP_PORTS
};
