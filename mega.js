const mega = require("megajs");

const auth = {
    email: 'romekxd8@gmail.com',
    password: 'g64GbnXm.Y3a8F8',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246'
};

function randomMegaId(length = 6, numberLength = 4) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const number = Math.floor(Math.random() * Math.pow(10, numberLength));
    return `${result}${number}`;
}

async function uploadToMega(filePath) {
    return new Promise((resolve, reject) => {
        try {
            const storage = new mega.Storage(auth, (err) => {
                if (err) return reject(err);
                
                const fileName = `${randomMegaId()}.json`;
                const uploadStream = storage.upload({
                    name: fileName,
                    allowUploadBuffering: true
                }, fs.createReadStream(filePath));
                
                uploadStream.on("complete", (file) => {
                    file.link((err, url) => {
                        if (err) return reject(err);
                        storage.close();
                        resolve(url);
                    });
                });
                
                uploadStream.on("error", (err) => {
                    storage.close();
                    reject(err);
                });
            });
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = {
    uploadToMega,
    randomMegaId
};
