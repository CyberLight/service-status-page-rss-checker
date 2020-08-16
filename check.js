global.AbortController = require('abort-controller');
global.fetch = require('node-fetch');
const jsdom = require("jsdom");
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