const fs = require('fs');
const axiosHelper = new (require('./includes/axios-helper')).init(5);
const chalk = require('chalk');
const https = require('https');
const mv = require('mv');
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

if(process.argv.length < 6)
    throw new Error('Error: Token and spaceId is required.');

const token = process.argv[2];
const spaceId = process.argv[3];
const maximumStoredQuantity = process.argv[4];
const maximumStoredSize = process.argv[5];

const config = {
    headers: {
        Cookie: 'token_v2=' + token
    }
};

axiosHelper.post('https://www.notion.so/api/v3/enqueueTask', {
    task: { 
        eventName: 'exportSpace',
        request: {
            exportOptions: {
                exportType: 'markdown',
                timeZone: 'Asia/Seoul'
            },
            spaceId
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
    console.log('Check remaning storage and clean.');
    if(!fs.existsSync('../out'))
        fs.mkdirSync('../out');
    if(!fs.existsSync('./.out-temporary'))
        fs.mkdirSync('./.out-temporary');
    (async () => {
        while(maximumStoredQuantity !== -1
            && maximumStoredQuantity <= fs.readdirSync('../out').length)
            fs.unlinkSync('../out/' + fs.readdirSync('../out')[0]);
        while(maximumStoredSize !== -1
            && maximumStoredSize <= ((path) => (fs.readdirSync(path).reduce((a, c) => a + fs.statSync(path + '/' + c).size, 0) / 1024 ** 3).toFixed(2))('../out'))
            fs.unlinkSync('../out/' + fs.readdirSync('../out')[0]);
    })();

    console.log('It was started to download the workspace.\nPlease wait. It may takes more than 10 minutes.');
    const path = `./.out-temporary/Export-${ new Date().getTime() }.zip`;
    const file = fs.createWriteStream(path);
    https.get(exportUrl, (response) => {
        response.pipe(file);
        
        file.on('finish', () => (
            file.close(() => {
                mv(path, `../out/${ path.split('/', 3)[2] }`, reject);
                console.log('Done!');
                process.exit(0);
            })
        ));

        file.on('error', (error) => {
            fs.unlinkSync(path);
            reject(error);
        });
    });
})).catch((error) => {
    console.log(error);
    new Error(error);
});