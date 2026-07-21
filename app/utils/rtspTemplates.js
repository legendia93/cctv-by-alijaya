// Satu sumber kebenaran untuk template RTSP per-brand.
// Dipakai server-side (bulk-add) dan client-side (via endpoint JSON /api/dvr/brand-templates).
// Template pakai token {username} {password} {ip} {port} {channel} {stream} {subtype}.

const BRAND_TEMPLATES = {
    hikvision: {
        name: 'Hikvision',
        template: 'rtsp://{username}:{password}@{ip}:{port}/Streaming/Channels/{channel}01',
        defaults: { port: 554, channel: 1 },
        description: 'Channel 1 = Main Stream. Untuk sub stream gunakan channel02'
    },
    dahua: {
        name: 'Dahua',
        template: 'rtsp://{username}:{password}@{ip}:{port}/cam/realmonitor?channel={channel}&subtype={subtype}',
        defaults: { port: 554, channel: 1, subtype: 0 },
        description: 'Subtype 0 = Main Stream (HD), Subtype 1 = Sub Stream (SD)'
    },
    tp_link: {
        name: 'TP-Link Tapo',
        template: 'rtsp://{username}:{password}@{ip}:{port}/stream{channel}',
        defaults: { port: 554, channel: 1 },
        description: 'stream1 = Main Stream, stream2 = Sub Stream'
    },
    reolink: {
        name: 'Reolink',
        template: 'rtsp://{username}:{password}@{ip}:{port}/h264Preview_01_{stream}',
        defaults: { port: 554, stream: 'main' },
        description: 'main = Main Stream, sub = Sub Stream'
    },
    axis: {
        name: 'Axis',
        template: 'rtsp://{username}:{password}@{ip}:{port}/axis-media/media.amp',
        defaults: { port: 554 },
        description: 'URL standar Axis Communications'
    },
    foscam: {
        name: 'Foscam',
        template: 'rtsp://{username}:{password}@{ip}:{port}/videoMain',
        defaults: { port: 88 },
        description: 'videoMain = HD Stream, videoSub = SD Stream'
    },
    uniview: {
        name: 'Uniview (UNV)',
        template: 'rtsp://{username}:{password}@{ip}:{port}/unicast/c{channel}/s{stream}/live',
        defaults: { port: 554, channel: 1, stream: 0 },
        description: 's0 = Main Stream, s1 = Sub Stream'
    },
    bardi: {
        name: 'Bardi',
        template: 'rtsp://{username}:{password}@{ip}:{port}/V_ENC_000',
        defaults: { port: 554 },
        description: 'Bardi IP Camera - V_ENC_000 stream'
    },
    sony: {
        name: 'Sony',
        template: 'rtsp://{username}:{password}@{ip}:{port}/media/video{channel}',
        defaults: { port: 554, channel: 1 },
        description: 'video1 = Main Stream, video2 = Sub Stream'
    },
    panasonic: {
        name: 'Panasonic',
        template: 'rtsp://{username}:{password}@{ip}:{port}/MediaInput/stream{channel}',
        defaults: { port: 554, channel: 1 },
        description: 'stream1 = Main Stream, stream2 = Sub Stream'
    },
    avtech: {
        name: 'AVTech',
        template: 'rtsp://{username}:{password}@{ip}:{port}/live/ch00_{channel}',
        defaults: { port: 554, channel: 0 },
        description: 'ch00_0 = Main Stream, ch00_1 = Sub Stream'
    },
    xiaomi: {
        name: 'Xiaomi / Yi',
        template: 'rtsp://{username}:{password}@{ip}:{port}/ch0_{stream}.264',
        defaults: { port: 554, stream: 0 },
        description: 'ch0_0 = HD Stream, ch0_1 = SD Stream'
    },
    ezviz: {
        name: 'EZVIZ',
        template: 'rtsp://{username}:{password}@{ip}:{port}/live/ch0',
        defaults: { port: 554 },
        description: 'EZVIZ Cloud Camera via RTSP'
    },
    imou: {
        name: 'Imou',
        template: 'rtsp://{username}:{password}@{ip}:{port}/live/ch0',
        defaults: { port: 554 },
        description: 'Imou Camera - buatan Dahua'
    },
    v380: {
        name: 'V380',
        template: 'rtsp://{username}:{password}@{ip}:{port}/live/ch0',
        defaults: { port: 554 },
        description: 'V380 WiFi Camera via RTSP'
    },
    wanscam: {
        name: 'Wanscam',
        template: 'rtsp://{username}:{password}@{ip}:{port}/onvif1',
        defaults: { port: 554 },
        description: 'Wanscam WiFi Camera via ONVIF'
    },
    tengfei: {
        name: 'Tengfei',
        template: 'rtsp://{username}:{password}@{ip}:{port}/live/ch0',
        defaults: { port: 554 },
        description: 'Tengfei WiFi Camera via RTSP'
    },
    spc: {
        name: 'SPC',
        template: 'rtsp://{username}:{password}@{ip}:{port}/Streaming/Channels/{channel}01',
        defaults: { port: 554, channel: 1 },
        description: 'SPC DVR 4/8/16 channel (banyak berbasis Hikvision)'
    },
    tiandy: {
        name: 'Tiandy',
        template: 'rtsp://{username}:{password}@{ip}:{port}/live/ch0',
        defaults: { port: 554 },
        description: 'Tiandy IP Camera via RTSP'
    },
    glenz: {
        name: 'Glenz',
        template: 'rtsp://{username}:{password}@{ip}:{port}/live/ch0',
        defaults: { port: 554 },
        description: 'Glenz/HDW WiFi Camera via RTSP'
    },
    generic: {
        name: 'Kustom / Manual',
        template: 'rtsp://{username}:{password}@{ip}:{port}/',
        defaults: { port: 554 },
        description: 'URL RTSP kustom'
    }
};

// Merek yang benar-benar punya konsep multi-channel (DVR/NVR) untuk bulk-add.
// Merek single-camera (axis, foscam, dll) template-nya tak berubah antar-channel,
// jadi bulk hanya masuk akal untuk yang templatenya mengandung {channel}.
function templateHasChannel(brand) {
    const info = BRAND_TEMPLATES[brand];
    return !!(info && info.template.includes('{channel}'));
}

// Bangun satu URL RTSP dari template brand. Meniru logika generator client
// (encode kredensial, isi default, ganti semua token {key}).
function buildRtspUrl(brand, opts = {}) {
    const info = BRAND_TEMPLATES[brand];
    if (!info) return null;

    const streamType = opts.stream === 'sub' ? 'sub' : 'main';
    const params = {
        username: encodeURIComponent(opts.username != null ? String(opts.username) : ''),
        password: encodeURIComponent(opts.password != null ? String(opts.password) : ''),
        ip: opts.ip,
        port: opts.port,
        channel: opts.channel,
        stream: streamType === 'main' ? 'main' : 'sub',
        subtype: streamType === 'main' ? 0 : 1
    };

    // Isi default dari brand bila param belum diberikan.
    Object.keys(info.defaults).forEach(key => {
        if (params[key] === undefined || params[key] === null || params[key] === '') {
            params[key] = info.defaults[key];
        }
    });

    let url = info.template;
    Object.keys(params).forEach(key => {
        url = url.replace(new RegExp(`\\{${key}\\}`, 'g'), params[key]);
    });
    return url;
}

module.exports = { BRAND_TEMPLATES, buildRtspUrl, templateHasChannel };
