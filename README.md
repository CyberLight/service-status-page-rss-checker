# sspchecker (Service Status Page RSS Checker)

This library can check the status page of any service that supports the **Statuspage** like interface using RSS format (except Atom format).

## Installation

```bash
npm i -D sspchecker

# or

npm i sspchecker
```

## Usage

```JavaScript
const { getPageStatusesStream, withDefaultSubscription } = require('sspchecker');

withDefaultSubscription(getPageStatusesStream([ 'https://status.service.name/path/to.rss', ... ]));
```

or from command line:

```bash
ssprsschecker-cli --urls https://status.npmjs.org/history.rss https://status.glitch.com/history.rss
```
or 

```bash
ssprsschecker-cli --urls ./rssUrls.json
```
* where `./rssUrls.json` is a file with content like this:
```json
[
    "https://status.npmjs.org/history.rss",
    "https://status.gitlab.com/pages/5b36dc6502d06804c08349f7/rss",
    "https://status.glitch.com/history.rss"
]
```

## Example of output

```bash
root@195e4786fcb0:/workspaces/service-status-page-rss-checker# sspchecker-cli --urls ./rssUrls.json 
[i] Check service page statuses: [
  'https://status.npmjs.org/history.rss',
  'https://status.gitlab.com/pages/5b36dc6502d06804c08349f7/rss',
  'https://status.glitch.com/history.rss'
]
No incidents found!
[i] status check completed
```
or 

```bash
root@195e4786fcb0:/workspaces/service-status-page-rss-checker# sspchecker-cli --urls https://status.npmjs.org/history.rss https://status.glitch.com/history.rss
[i] Check service page statuses: [
  'https://status.npmjs.org/history.rss',
  'https://status.glitch.com/history.rss'
]
No incidents found!
[i] status check completed
```

## Running tests

```bash
npm test
```

## License
See the [LICENSE](LICENSE.md) file for license rights and limitations (MIT).