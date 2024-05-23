const fs = require('node:fs/promises');
const path = require('node:path');
const { exec } = require('node:child_process');
const http = require('node:http');

function execAsync(command, options = {}) {
    return new Promise((resolve, reject) => {
        exec(command, options, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve({ stdout, stderr });
            }
        }); 
    });
}

async function translate(targetLanguage, text) {
    return new Promise((resolve, reject) => {
        const templateMatches = text.match(/\{[a-zA-Z0-9].*?\}/g);
        let noTranslateMap = {};
        if (templateMatches) {
            const noTranslateRandom = '7QagXIHZ9fSnirhiYiUR';
            let noTranslateIterator = 0;
            for (const templateMatch of Array.from(templateMatches)) {
                const noTranslateReplacement = noTranslateRandom + ('' +(noTranslateIterator++)).padStart(5, '0');
                noTranslateMap[noTranslateReplacement] = templateMatch;
                text = text.replace(templateMatch, noTranslateReplacement);
            }
        }

        const requestBody = JSON.stringify({
            q: text,
            source: 'en',
            target: targetLanguage,
            format: 'text',
            api_key: ''
        });
        const request = http.request({
            hostname: 'localhost',
            port: 5000,
            path: '/translate',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': requestBody.length
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    let translatedText = JSON.parse(data).translatedText;
                    if (translatedText == null) {
                        reject(new Error('Translation service failed (undefined result).'));
                    } else {
                        let isReplacementError = false;
                        for (const noTranslateReplacement in noTranslateMap) {
                            if (translatedText.includes(noTranslateReplacement)) {
                                translatedText = translatedText.replace(noTranslateReplacement, noTranslateMap[noTranslateReplacement])
                            } else {
                                isReplacementError = true;
                                break;
                            }
                        }
                        if (isReplacementError) {
                            reject(new Error('Translation replaced one of the non-translatable replacement strings.'));
                        } else {
                            resolve(translatedText);
                        }
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });
        request.on("error", (error) => {
            reject(error);
        });
        request.write(requestBody)
        request.end();
    });
}

async function translateRecursive(en, oldEn, language, target) {
    const enType = Object.prototype.toString.call(en);
    if (enType === '[object Object]' || enType === '[object Array]') {
        const keys = (enType === '[object Object]') ? Object.keys(en) : Array.from({ length: en.length }, (v, i) => i);
        for (const key of keys) {
            const enKeyType = Object.prototype.toString.call(en[key]);
            const oldEnKeyType = Object.prototype.toString.call(oldEn[key]);
            const targetKeyType = Object.prototype.toString.call(target[key]);
            let needsRecursiveCall = false;
            let needsTranslate = false;
            if (oldEnKeyType !== enKeyType || targetKeyType !== enKeyType) {
                if (enKeyType === '[object Object]') {
                    oldEn[key] = {};
                    target[key] = {};
                    needsRecursiveCall = true;
                } else if (enKeyType === '[object Array]') {
                    oldEn[key] = [];
                    target[key] = [];
                    needsRecursiveCall = true;
                } else if (enKeyType === '[object String]') {
                    needsTranslate = true;
                }
            } else if (enKeyType === '[object Object]' || enKeyType === '[object Array]') {
                needsRecursiveCall = true;
            } else if (enKeyType === '[object String]') {
                if (en[key] != oldEn[key]) {
                    needsTranslate = true;
                }
            }
            if (needsRecursiveCall) {
                await translateRecursive(en[key], oldEn[key], language, target[key]);
            }
            if (needsTranslate) {
                console.info(`Translate to ${language}: "${en[key]}"`);
                try {
                    if (en[key] == '') target[key] = '';
                    else target[key] = await translate(language, en[key]);
                    console.info(`Result: "${target[key]}"`);
                } catch (error) {
                    console.info(`Error translating.`, error?.toString());
                    delete target[key];
                }
            }
        }
        if (enType === '[object Array]') {
            target.length = en.length;
        }
    }
}

async function init() {

    // Read the contents of the English language translation, which will serve as a base to translate into other languages.
    const enFile = await fs.readFile(path.join(__dirname, '../src/i18n/en.json'));
    const en = JSON.parse(enFile);
    const currentGitBranch = (await execAsync(`git rev-parse --abbrev-ref HEAD`, { cwd: __dirname })).stdout.trim();

    // Try to find the contents of the English translation for the last time this script was run,
    // so we can only attempt to re-translate text that has changed.
    let lastAutoTranslateCommit = '';
    try {
        lastAutoTranslateCommit = (await fs.readFile(path.join(__dirname, '../src/i18n/last-auto-translate-commit.txt'))).toString().trim();
    } catch (error) {}
    let lastAutoTranslateEn = null;
    if (lastAutoTranslateCommit) {
        try {
            await execAsync(`git checkout ${lastAutoTranslateCommit}`, { cwd: __dirname });
            let checkForHead = (await execAsync(`git rev-parse --abbrev-ref HEAD`, { cwd: __dirname })).stdout.trim();
            if (checkForHead !== 'HEAD') throw new Error('Checked out a commit that doesn\'t exist.');
            const lastAutoTranslateEnFile = await fs.readFile(path.join(__dirname, '../src/i18n/en.json'));
            lastAutoTranslateEn = JSON.parse(lastAutoTranslateEnFile);
        } catch (error) {}
        await execAsync(`git checkout ${currentGitBranch}`, { cwd: __dirname });
    }
    if (!lastAutoTranslateEn) {
        lastAutoTranslateEn = JSON.parse(JSON.stringify(en));
    }
    
    // Get a list of languages
    const i18nFiles = await fs.readdir(path.join(__dirname, '../src/i18n'));
    const languages = i18nFiles.filter((filename) => filename.endsWith('.json') && !filename.startsWith('en')).map((filename) => filename.replace('.json', ''));
    
    // Translate each language
    for (const language of languages) {
        const languageFile = await fs.readFile(path.join(__dirname, `../src/i18n/${language}.json`));
        const languageMessages = JSON.parse(languageFile);
        await translateRecursive(en, JSON.parse(JSON.stringify(lastAutoTranslateEn)), language, languageMessages);
        await fs.writeFile(path.join(__dirname, `../src/i18n/${language}.json`), JSON.stringify(languageMessages, null, '    '));
    }

    // Create a new git commit and store it as last translated commit.
    await execAsync(`git add .`, { cwd: path.join(__dirname, '../src/i18n') });
    await execAsync(`git commit -m "Auto-translate script run."`, { cwd: path.join(__dirname, '../') });
    let newCommitId = (await execAsync('git rev-parse HEAD', { cwd: path.join(__dirname, '../') })).stdout.trim();
    await fs.writeFile(path.join(__dirname, '../src/i18n/last-auto-translate-commit.txt'), newCommitId);
    await execAsync(`git add .`, { cwd: path.join(__dirname, '../src/i18n') });
    await execAsync(`git commit -m "Auto-translate script update last run commit."`, { cwd: path.join(__dirname, '../') });

}

console.info('This script assumes you have a local LibreTranslate server running at http://localhost:5000');
console.info('Info on how to install here: https://github.com/LibreTranslate/LibreTranslate');
init();