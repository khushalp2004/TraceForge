import crypto from "crypto";
import http from "http";

const encryptedPrefix = "enc:";
const seed = "Honda_amaze_2021";
const payload = "enc:778924b87baefff5f2e5efc7.4657307398617236596ae236c3f9c796.6b855cdf7cfe9a0e3e20cf6c7695b6944e03b75a7079bc8b24b92b19d61d38d6241cb3cad245e02ea6b317be0f454cb3";

const encryptionKey = crypto.createHash("sha256").update(seed).digest();

function decrypt(payload) {
    const serialized = payload.slice(encryptedPrefix.length);
    const [ivHex, authTagHex, encryptedHex] = serialized.split(".");
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, "hex")), decipher.final()]);
    return decrypted.toString("utf8");
}

const apiKey = decrypt(payload);
console.log("Decrypted API Key:", apiKey);

const data = JSON.stringify({
    message: "TypeError: Cannot read property 'id' of undefined",
    stackTrace: "at Dashboard.tsx:120:34\nat call (react-dom.js:40:12)",
    environment: "production"
});

const options = {
    hostname: 'localhost',
    port: 80,
    path: '/ingest',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Traceforge-Key': apiKey,
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('Ingest Response:', body);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
