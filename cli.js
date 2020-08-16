#! /usr/bin/env node

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const error = chalk.bold.red;
const warning = chalk.keyword('orange');
const { withDefaultSubscription, getPageStatusesStream } = require('./check');

function validURL(str) {
    var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
        '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
    return !!pattern.test(str);
}

function isAllUrlsValid(urls) {
    return urls.every(s => validURL(s));
}

function startCli() {
    const { argv } = require('yargs')
    .option('urls', {
        describe: 'urls to status pages or path to json file with array of urls to status pages',
        type: 'array',
        demandOption: true
    })
    .check((argv) => {
        const { urls } = argv;
        if (urls.length === 0) {
            throw new Error('Need one or more urls');
        } else if (!isAllUrlsValid(urls)) {
            const pathToJsonFile = urls[0];
            const { ext } = path.parse(pathToJsonFile);
            if (ext !== '.json') throw new Error('Need json file as first parameter with list of urls');
            let rawdata = fs.readFileSync(pathToJsonFile);
            let jsonUrls = JSON.parse(rawdata);
            if (!Array.isArray(jsonUrls)) throw new Error('Json file does not contains array');
            if (!isAllUrlsValid(jsonUrls)) throw new Error('Not all values in array are urls!');
            return true;
        } else {
            return true;
        }
    })
    .fail(function (msg, err, yargs) {
        console.error('Ooops... something went wrong :(');
        console.error('REASON:', err ? error(msg) : warning(msg));
        console.error('You should be doing', yargs.help());
        process.exit(1);
    })
    .help();

    let { urls } = argv;
    let isAllUrls = isAllUrlsValid(urls);
    if (!isAllUrls) {
        let rawdata = fs.readFileSync(urls[0]);
        let jsonUrls = JSON.parse(rawdata);
        urls = jsonUrls;
    }
    console.log('[i] Check service page statuses:', urls);
    withDefaultSubscription(getPageStatusesStream(urls));
}

module.exports = startCli;

if (require.main === module) {
    startCli();
}