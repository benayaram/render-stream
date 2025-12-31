const express = require('express');
const { spawn } = require('child_process');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let ffmpegProcess = null;

// DASHBOARD
app.get('/', (req, res) => {
    res.send(`
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body{font-family:sans-serif;padding:20px;text-align:center;background:#f0f0f0;}
            .card{background:white;padding:20px;border-radius:10px;box-shadow:0 2px 5px rgba(0,0,0,0.1);}
            input{width:90%;padding:12px;margin:10px 0;border:1px solid #ccc;border-radius:5px;}
            button{width:100%;padding:15px;color:white;border:none;border-radius:5px;font-size:18px;font-weight:bold;cursor:pointer;}
            .live-btn{background:#cc0000;}
            .stop-btn{background:#333;}
        </style>
        <div class="card">
            <h1>⛪ Stream Relay</h1>
            <form action="/start" method="POST">
                <input type="text" name="source" placeholder="Paste Source Link (YouTube)" required />
                <input type="text" name="key" placeholder="Paste Your Stream Key" required />
                <button type="submit" class="live-btn">🔴 GO LIVE</button>
            </form>
            <br>
            <form action="/stop" method="POST">
                <button class="stop-btn">⬛ STOP STREAM</button>
            </form>
        </div>
    `);
});

// HELPER: Get Video Link (Stealth Mode)
function getRawUrl(sourceLink) {
    return new Promise((resolve, reject) => {
        // Disguise as an iPhone on a cellular network
        const args = [
            '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
            '--referer', 'https://m.youtube.com/',
            '--geo-bypass',
            '-f', 'best',
            '-g', sourceLink
        ];

        const process = spawn('./yt-dlp', args);
        
        let dataString = "";
        let errorString = "";

        process.stdout.on('data', (data) => { dataString += data.toString(); });
        process.stderr.on('data', (data) => { errorString += data.toString(); });

        process.on('close', (code) => {
            if (code === 0 && dataString) {
                const rawLink = dataString.split('\n')[0].trim();
                resolve(rawLink);
            } else {
                reject(new Error(errorString || "Unknown Error"));
            }
        });
    });
}

// START ACTION
app.post('/start', async (req, res) => {
    const sourceLink = req.body.source;
    const streamKey = req.body.key;
    const rtmpUrl = `rtmp://a.rtmp.youtube.com/live2/${streamKey}`;

    if (ffmpegProcess) {
        return res.send("<h1>⚠️ Stream is already running!</h1><a href='/'>Back</a>");
    }

    try {
        console.log(`Trying to fetch: ${sourceLink}`);
        const rawUrl = await getRawUrl(sourceLink);
        
        console.log("Got link, starting FFmpeg...");
        
        ffmpegProcess = spawn('ffmpeg', [
            '-re',
            '-i', rawUrl,
            '-c:v', 'copy', '-c:a', 'copy',
            '-f', 'flv', rtmpUrl
        ]);

        ffmpegProcess.on('close', () => { ffmpegProcess = null; console.log("FFmpeg stopped."); });

        res.send("<h1>✅ SUCCESS! Check your Channel.</h1><a href='/'>Back</a>");
    } catch (error) {
        // Print the exact error so you can see it on your phone
        res.send(`
            <h3>❌ FAILED</h3>
            <p><strong>Reason:</strong> ${error.message}</p>
            <a href='/'>Try Again</a>
        `);
    }
});

// STOP ACTION
app.post('/stop', (req, res) => {
    if (ffmpegProcess) {
        ffmpegProcess.kill('SIGINT');
        ffmpegProcess = null;
        res.send("<h1>🛑 Stream Stopped.</h1><a href='/'>Back</a>");
    } else {
        res.send("<h1>Nothing was running.</h1><a href='/'>Back</a>");
    }
});

app.listen(10000, () => console.log('Server ready on port 10000'));
    
