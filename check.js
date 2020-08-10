global.AbortController = require('abort-controller');
global.fetch = require('node-fetch');
const jsdom = require("jsdom");
const path = require('path');
const fs = require('fs');
const { of, forkJoin, zip } = require('rxjs');
const { fromFetch } = require('rxjs/fetch');
const { 
    switchMap, 
    catchError, 
    mergeMap, 
    map, 
    groupBy, 
    toArray, 
    filter, 
    defaultIfEmpty 
} = require('rxjs/operators');
const { url } = require('inspector');
const dom = new jsdom.JSDOM('');
const DOMParser = dom.window.DOMParser;
const parser = new DOMParser();
const ResolvedStatus = 'Resolved';
const CompleteMessage = '[i] status check completed';
const ErrorMessage = 'something wrong occurred:';
const NoIncidentsMessage = 'No incidents found!';

const byPubDate = (l, r) => Date.parse(r.pubDate) - Date.parse(l.pubDate);

function getShortDate(d) {
    return d.toISOString().slice(0, 10)
}

function htmlDecode(input) {
    const doc = parser.parseFromString(input, 'text/html');
    return doc.documentElement;
}

function parseDescription(description) {
    const descriptionDecoded = htmlDecode(description.textContent);
    const list = [];
    const treeWalker = dom.window.document.createTreeWalker(
        descriptionDecoded,
        dom.window.NodeFilter.SHOW_ELEMENT,
        { acceptNode: function () { return dom.window.NodeFilter.FILTER_ACCEPT; } },
        false
    );
    let currentNode = treeWalker.currentNode;
    let currentItem = null;
    while (currentNode) {
        if (currentNode.nodeName === 'SMALL') {
            currentItem = {
                pubDate: currentNode.textContent
            };
            list.push(currentItem);
        } else if (['B', 'STRONG'].includes(currentNode.nodeName)) {
            currentItem.status = currentNode.textContent;
        }
        currentNode = treeWalker.nextNode();
    }
    return list;
}

function makeLines(xml) {
    const document = parser.parseFromString(xml, 'text/xml');
    const items = document.querySelectorAll('item');
    const channelTitle = document.querySelector('channel > title');
    return Array.from(items).map(el => {
        const [title, description, pubDate] = el.querySelectorAll('title, description, pubDate');
        const incidents = parseDescription(description).sort(byPubDate);
        return {
            pubDate: pubDate.textContent, 
            title: title.textContent, 
            channelTitle: channelTitle.textContent,
            status: incidents[0].status
        }
    });
}

function fetchUrl(url) {
    return fromFetch(url).pipe(
        switchMap(response => {
            return response.ok
                ? response.text()
                : of({ error: true, message: `Error ${response.status}` });
        }),
        catchError(err => {
            return of({ error: true, message: err.message })
        })
    )
}

function hasIncidentsToday(status) {
    return getShortDate(new Date()) === getShortDate(new Date(Date.parse(status.lastIncident.pubDate)));
}

function isStatusEqual(status, statusValue) {
    return status.lastIncident.status === statusValue
}

function getPageStatusesStream(statusPageUrls = []) {
    return forkJoin(statusPageUrls.map(statusPageUrl => fetchUrl(statusPageUrl))).pipe(
        mergeMap(v => v),
        map(xml => makeLines(xml)),
        mergeMap(v => v),
        groupBy(line => line.channelTitle),
        mergeMap(group => zip(of(group.key), group.pipe(toArray()))),
        map(([service, incidents]) => ({
            service, 
            lastIncident: incidents.sort(byPubDate)[0]
        })),
        filter(status => (
            hasIncidentsToday(status) && 
            !isStatusEqual(status, ResolvedStatus)
        )),
        defaultIfEmpty({ 
            empty: true, 
            message: NoIncidentsMessage 
        })
    );
}

function withDefaultSubscription(stream) {
    return stream.subscribe({
        next: status => {
            if (status.empty) {
                console.warn(status.message);
            } else {
                console.warn(JSON.stringify(status, ' ', 4));
            }
        },
        error(err) {
            console.error(ErrorMessage, err);
        },
        complete: () => {
            console.log(CompleteMessage)
        }
    });
}

module.exports = {
    getPageStatusesStream,
    withDefaultSubscription
};

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

if (require.main === module) {
    let urls = process.argv.slice(2);
    if (urls.length === 0) throw new Error('Need one or more parameters');
    let isAllUrls = isAllUrlsValid(urls);
    if (!isAllUrls) {
        const pathToJsonFile = urls[0];
        const { ext } = path.parse(pathToJsonFile);
        if (ext !== '.json') throw new Error('Need json file with list of urls');
        let rawdata = fs.readFileSync(pathToJsonFile);
        let jsonUrls = JSON.parse(rawdata);
        if (!Array.isArray(jsonUrls)) throw new Error('Json file does not contains array');
        isAllUrls = isAllUrlsValid(jsonUrls);
        if (!isAllUrls) throw new Error('Not all values in array are urls!');  
        urls = jsonUrls;
    }   
    console.log('[i] Check service page statuses:', urls);
    withDefaultSubscription(getPageStatusesStream(urls));
}