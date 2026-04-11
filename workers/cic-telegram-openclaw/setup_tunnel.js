const { exec, spawn } = require('child_process');

console.log("Starting localtunnel...");
const ltOptions = { shell: true };
const lt = spawn('npx', ['localtunnel', '--port', '8787', '--bypass-tunnel-reminder'], ltOptions);

lt.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(output);
    const match = output.match(/your url is: (https:\/\/[^\s]+)/);
    if (match && match[1]) {
        const url = match[1] + '/telegram-webhook';
        console.log(`Setting webhook to: ${url}`);
        
        exec(`curl -X POST https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook -F "url=${url}" -F "secret_token=${process.env.TELEGRAM_WEBHOOK_SECRET}"`, (err, stdout, stderr) => {
            console.log("Telegram response:", stdout);
        });
    }
});

lt.stderr.on('data', (data) => {
    console.error(`lt stderr: ${data}`);
});
