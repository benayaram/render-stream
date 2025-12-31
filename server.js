const express = require('express');
const { spawn } = require('child_process');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let ffmpegProcess = null;

// HTML Page
app.get('/', (req, res) => {
    res.send(`
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>body{font-family:sans-serif;padding:20px;text-align:center}input{width:100%;padding:10px;margin:10px 0}button{width:100%;padding:15px;color:white;border:none;border-radius:5px;font-size:16px}</style>
        <h1>⛪ Holy Word Stream Control</h1>
        <form action="/start" method="POST">
            <input type="text" name="source" placeholder="Paste YouTube/Facebook Link" required />
            <input type="text" name="key" placeholder="Paste Stream Key (Optional)" />
            <button type="submit" style="background:red;">🔴 GO LIVE</button>
        </form>
        <br>
        <form action="/stop" method="POST">
            <button style="background:black;">⬛ STOP STREAM</button>
        </form>
    `);
});

// Helper function to get the raw video URL using the downloaded file
function getRawUrl(sourceLink) {
    return new Promise((resolve, reject) => {
        // We use the file './yt-dlp' directly now
        const process = spawn('./yt-dlp', ['-g', sourceLink]);
        let dataString = "";

        process.stdout.on('data', (data) => {
            dataString += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0 && dataString) {
                // Get the first link (video), ignoring the second (audio only) if split
                const rawLink = dataString.split('\n')[0].trim();
                resolve(rawLink);
            } else {
                reject(new Error("Could not get video link"));
            }
        });
    });
}

// START STREAM API
app.post('/start', async (req, res) => {
    const sourceLink = req.body.source;
    const streamKey = req.body.key || "PASTE_DEFAULT_KEY_HERE"; 
    const rtmpUrl = `rtmp://a.rtmp.youtube.com/live2/${streamKey}`;

    if (ffmpegProcess) {
        return res.send("<h1>⚠️ Stream is already running! Stop it first.</h1><a href='/'>Back</a>");
    }

    try {
        console.log(`Getting raw link for: ${sourceLink}`);
        const rawUrl = await getRawUrl(sourceLink);
        
        console.log("Starting FFmpeg...");
        ffmpegProcess = spawn('ffmpeg', [
            '-re',
            '-i', rawUrl,
            '-c:v', 'copy', '-c:a', 'copy',
            '-f', 'flv', rtmpUrl
        ]);

        ffmpegProcess.stderr.on('data', (data) => console.log(`FFmpeg: ${data}`));
        ffmpegProcess.on('close', () => { 
            ffmpegProcess = null; 
            console.log("Stream stopped"); 
        });

        res.send("<h1>✅ Stream Started! Check YouTube.</h1><a href='/'>Back</a>");
    } catch (error) {
        console.error(error);
        res.send(`<h1>❌ Error: ${error.message}</h1><a href='/'>Back</a>`);
    }
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

app.listen(10000, () => console.log('Server ready on port 10000'));
                                         
