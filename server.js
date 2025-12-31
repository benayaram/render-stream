const express = require('express');
const { spawn } = require('child_process');
const YTDlpWrap = require('yt-dlp-wrap').default;
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// 1. Install yt-dlp automatically on startup
const ytDlpWrap = new YTDlpWrap();
let ytDlpBinaryPath = './yt-dlp';

// Download latest yt-dlp binary (runs once when server starts)
(async () => {
    console.log("Downloading latest yt-dlp...");
    await ytDlpWrap.downloadBinary(ytDlpBinaryPath);
    console.log("yt-dlp downloaded!");
})();

let ffmpegProcess = null;

// HTML Page for you to control it
app.get('/', (req, res) => {
    res.send(`
        <h1>⛪ Holy Word Stream Control</h1>
        <form action="/start" method="POST">
            <input type="text" name="source" placeholder="Paste YouTube/Facebook Link" style="width:100%;padding:10px;" required />
            <br><br>
            <input type="text" name="key" placeholder="Paste Stream Key (Optional)" style="width:100%;padding:10px;" />
            <br><br>
            <button type="submit" style="padding:15px;width:100%;background:red;color:white;">🔴 GO LIVE</button>
        </form>
        <br>
        <form action="/stop" method="POST">
            <button style="padding:15px;width:100%;background:black;color:white;">⬛ STOP STREAM</button>
        </form>
    `);
});

// START STREAM API
app.post('/start', express.urlencoded({ extended: true }), async (req, res) => {
    const sourceLink = req.body.source;
    // HARDCODE YOUR KEY HERE IF YOU WANT, OR TYPE IT IN THE BOX
    const streamKey = req.body.key || "PASTE_DEFAULT_KEY_HERE"; 
    const rtmpUrl = `rtmp://a.rtmp.youtube.com/live2/${streamKey}`;

    if (ffmpegProcess) {
        return res.send("<h1>⚠️ Stream is already running! Stop it first.</h1>");
    }

    console.log(`Getting raw link for: ${sourceLink}`);

    // Get raw video URL
    let rawUrl = await ytDlpWrap.execPromise([sourceLink, '-g']);
    rawUrl = rawUrl.trim().split('\n')[0]; // Get the first video stream found

    console.log("Starting FFmpeg...");

    ffmpegProcess = spawn('ffmpeg', [
        '-re',
        '-i', rawUrl,
        '-c:v', 'copy', '-c:a', 'copy',
        '-f', 'flv', rtmpUrl
    ]);

    ffmpegProcess.stderr.on('data', (data) => console.log(`FFmpeg: ${data}`));
    ffmpegProcess.on('close', () => { ffmpegProcess = null; console.log("Stream stopped"); });

    res.send("<h1>✅ Stream Started! Check YouTube.</h1><a href='/'>Back</a>");
});

// STOP STREAM API
app.post('/stop', (req, res) => {
    if (ffmpegProcess) {
        ffmpegProcess.kill('SIGINT');
        ffmpegProcess = null;
        res.send("<h1>🛑 Stream Stopped.</h1><a href='/'>Back</a>");
    } else {
        res.send("<h1>Nothing was running.</h1><a href='/'>Back</a>");
    }
});

// KEEPALIVE HACK (Prevents Render Free Tier from sleeping)
setInterval(() => {
    console.log("Ping to stay awake...");
    // Just a log keep-alive, but better to use an external pinger if possible.
}, 280000); // Every 4.5 minutes

app.listen(10000, () => console.log('Server ready on port 10000'));
      
