const fs = require('fs');
const axiosHelper = new (require('./includes/axios-helper')).init(5);
const chalk = require('chalk');
const https = require('https');
const cron = require('node-cron');
const mv = require('mv');
const webdavClient = require('webdav');
require('object-helper-js');

console.log(
    chalk.bold.redBright(
        `\n` + 
        `     _   ______  ______________  _   __   __ __ ________________  __________ \n` +
        `    / | / / __ \\/_  __/  _/ __ \\/ | / /  / //_// ____/ ____/ __ \\/ ____/ __ \\\n` +
        `   /  |/ / / / / / /  / // / / /  |/ /  / ,<  / __/ / __/ / /_/ / __/ / /_/ /\n` +
        `  / /|  / /_/ / / / _/ // /_/ / /|  /  / /| |/ /___/ /___/ ____/ /___/ _, _/ \n` +
        ` /_/ |_/\\____/ /_/ /___/\\____/_/ |_/  /_/ |_/_____/_____/_/   /_____/_/ |_|  \n\n`
    ),
    chalk.white(
        `The Notion Keeper.\n` + 
        `- Git: https://github.com/donghoony1/Notion-Keeper-V2\n\n\n` + 
        `Initializing...\n\n`
    )
);

[ 'token', 'spaceid' ].forEach((a) => {
    if(a === undefined || a === '')
        throw new Error('Error: Token and spaceId is required.');
});

const maximumStoredQuantity = process.env.maxqty || 30;
const maximumStoredSize = process.env.maxsize || 10;
const cronExpression = process.env.cron || undefined;
const webdav = {
    ...(() => {
        const instance = {};
        [ 'url', 'path', 'user', 'pass' ].forEach((e) => (
            instance[e] = process.env['webdav_' + e] || undefined
        ));
        return instance;
    })()
};
webdav.enabled = webdav.values().every((e) => e !== undefined);

const config = {
    headers: {
        Cookie: 'token_v2=' + process.env.token
    }
};

const cronWaitingMessage = 'Waiting for the time to backup which was defined by cron expression. - ' + cronExpression + '\n\n';

let isRunning = false;


const app = () => axiosHelper.post('https://www.notion.so/api/v3/enqueueTask', {
    task: { 
        eventName: 'exportSpace',
        request: {
            exportOptions: {
                exportType: 'markdown',
                timeZone: 'Asia/Seoul'
            },
            spaceId: process.env.spaceid
        }
    }
}, config).then((response) => new Promise((resolve, reject) => {
    if(!response.data.taskId)
        reject('Error: Can not receive taskId from Notion. Please contact to the developer with E-mail or GitHub issues.');
    console.log('It was requested to export the workspace.\nPlease wait. It may takes few minutes.');
    const checkState = () => setTimeout(() => {
        axiosHelper.post('https://www.notion.so/api/v3/getTasks', {
            taskIds: [
                response.data.taskId
            ]
        }, config).then((response) => {
            const status = response.data.readSafely('results', 0, 'state');
            const exportUrl = response.data.readSafely('results', 0, 'status', 'exportURL');
            if(!status || ![ 'in_progress', 'success' ].includes(status) || status === 'success' && !exportUrl)
                reject('Error: The result is not valid. Please contact to the developer with E-mail or GitHub issues.');
            switch(status) {
                case 'in_progress':
                    checkState();
                    break;
                case 'success':
                    resolve(exportUrl);
                    break;
            }
        }).catch(reject);
    }, 15000);
    checkState();
})).then((exportUrl) => new Promise((resolve, reject) => {
    if(!webdav.enabled) {
        console.log('Check remaning storage and clean.');
        if(!fs.existsSync('../out'))
            fs.mkdirSync('../out');
        if(!fs.existsSync('../out-temp'))
            fs.mkdirSync('../out-temp');
        (async () => {
            while(maximumStoredQuantity !== -1
                && maximumStoredQuantity <= fs.readdirSync('../out').length)
                fs.unlinkSync('../out/' + fs.readdirSync('../out')[0]);
            while(maximumStoredSize !== -1
                && maximumStoredSize <= ((path) => (fs.readdirSync(path).reduce((a, c) => a + fs.statSync(path + '/' + c).size, 0) / 1024 ** 3).toFixed(2))('../out'))
                fs.unlinkSync('../out/' + fs.readdirSync('../out')[0]);
        })();
    }

    console.log('It was started to download the workspace.\nPlease wait. It may takes more than 10 minutes.');
    const name = `Export-${ new Date().getTime() }.zip`;
    let data = [];
    if(webdav.enabled)
        https.get(exportUrl, (response) => {
            response.on('data', (chunk) => (
                data.push(chunk)
            )).on('end', () => {
                const bufferFile = Buffer.concat(data);
                (async() => {
                    const client = webdavClient.createClient(webdav.url, {
                        username: webdav.user, 
                        password: webdav.pass 
                    });
                    await client.putFileContents(webdav.path + '/' + name, bufferFile, {
                        overwrite: true, 
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity 
                    });
                    
                    console.log('Done!\n\n');
                    isRunning = false;

                    if(cronExpression) {
                        resolve();
                        console.log(cronWaitingMessage);
                    } else
                        process.exit(0);
                })();
            });
        });
    else {
        const stream = fs.createWriteStream('../out-temp/' + name);
        https.get(exportUrl, (response) => {
            response.pipe(stream);
            stream.on('finish', () => mv('../out-temp/' + name, '../out/' + name, (error) => {
                if(error) {
                    console.error(error);
                    process.exit(0);
                }

                console.log('Done!\n\n');
                isRunning = false;

                if(cronExpression) {
                    resolve();
                    console.log(cronWaitingMessage);
                } else
                    process.exit(0);
            }));
        });
    }
})).catch((error) => {
    isRunning = false;
    console.log(error);
    throw new Error(error);
});

if(cronExpression) {
    console.log(cronWaitingMessage);
    cron.schedule(cronExpression, () => {
        if(!isRunning) {
            isRunning = true;
            app();
        }
    });
} else
    app();