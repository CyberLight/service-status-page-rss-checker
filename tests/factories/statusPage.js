const faker = require('faker');
const moment = require('moment');
const RFC822 = 'ddd, DD MMM YYYY HH:mm:ss ZZ';
const ShortDateFormat = 'MMM DD, HH:mm UTC';

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function createIncident({ 
    date = new Date(), 
    status = faker.random.arrayElement(['Investigating', 'Monitoring', 'Identified', 'Update', 'Resolved']), 
    description = faker.lorem.sentence(10)
}) {
    return `<p>
                <small>${moment(date).utc().format(ShortDateFormat)}</small>
                <br>
                <strong>${status}</strong>${description}
            </p>`;
}

function createItem({ 
    title = faker.lorem.sentence(), 
    pubDate = new Date(), 
    link = faker.internet.url(), 
    guid = faker.internet.url(), 
    incidents = []
}) {
    return `<item>
      <title>${title}</title>
      <description>${escapeHtml(incidents.map(createIncident).join('\n'))}</description>
      <pubDate>${moment(pubDate).format(RFC822)}</pubDate>
      <link>${link}</link>
      <guid>${guid}</guid>
    </item>`
}

function createStatusPage(data) {
    const { channel = {}, items = [] } = data;
return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${channel.name || faker.internet.domainName()} Status - Incident History</title>
    <link>${channel.url || faker.internet.url()}</link>
    <description>Statuspage</description>
    <pubDate>${moment(channel.pubDate || new Date()).format(RFC822)}</pubDate>
    ${items.map(createItem).join('\n')}
   </channel>
</rss>`;
}

module.exports = {
    createStatusPage
}