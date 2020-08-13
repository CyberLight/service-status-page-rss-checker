jest.mock('node-fetch');
const { createStatusPage, OneMinute } = require('./factories/statusPage');
const fetch = require('node-fetch');
const { Response } = require('node-fetch');
const FakeTimers = require("@sinonjs/fake-timers");
const { toArray, take } = require('rxjs/operators');
const { getPageStatusesStream } = require('../check');

let clock;
const RFC822Regexp = /(Sun|Fri|Mon|Sat|Thu|Tue|Wed)\,\s[0-9]{2}\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s[0-9]{4}\s[0-9]{2}\:[0-9]{2}\:[0-9]{2}\s[+-][0-9]{4}/;

const constructResponse = (statuesByItem = [], clockInstance) => {
    const response = new Response();
    response.ok = true;

    const createIncident = (status) => {
        clock.tick(OneMinute);
        return {
            date: new Date(),
            status,
        };
    }

    const createItem = (statuses) => {
        return {
            incidents: statuses.map(createIncident)
        };
    };

    const data = createStatusPage({
        items: statuesByItem.map(createItem),
    }, clockInstance);

    response.text = jest.fn().mockReturnValue(Promise.resolve(data));
    return response;
}

beforeEach((done) => {
    clock = FakeTimers.install({ toFake: ['Date'], shouldAdvanceTime: true, advanceTimeDelta: 20 });
    clock.setSystemTime(new Date('2020-08-09T15:38:26.972Z'));
    fetch.mockClear();
    done();
});

afterEach((done) => {
    clock.uninstall();
    done();
});


describe('for current date', () => {
    describe('single url', () => {
        describe('Incidents with status != Resolved', () => {
            test.each([
                ['Investigating'],
                ['Monitoring'],
                ['Identified'],
                ['Update'],
            ])('should return incidents with status "%s"', async (status) => {
                fetch.mockReturnValue(Promise.resolve(constructResponse([[status]], clock)));

                const actual = await getPageStatusesStream([
                    'http://some.service.io/status_page/rss'
                ]).toPromise();

                expect(fetch).toHaveBeenCalledTimes(1);
                expect(actual).toEqual(expect.objectContaining({
                    lastIncident: expect.objectContaining({
                        channelTitle: expect.any(String),
                        pubDate: expect.stringMatching(RFC822Regexp),
                        status,
                        title: expect.any(String),
                    }),
                    service: expect.any(String),
                }));
            }); 
        });

        describe('Incidents with status == Resolved', () => {
            test('should not return incidents', async () => {
                fetch.mockReturnValue(Promise.resolve(constructResponse([['Resolved']], clock)));

                const actual = await getPageStatusesStream([
                    'http://some.service.io/status_page/rss'
                ]).toPromise();

                expect(fetch).toHaveBeenCalledTimes(1);
                expect(actual).toEqual({
                    empty: true,
                    message: "No incidents found!",
                });
            });
        });
    });

    describe('multiple urls', () => {
        describe('Incidents with status != Resolved', () => {
            test.each([
                ['Investigating'],
                ['Monitoring'],
                ['Identified'],
                ['Update'],
            ])('should return incidents with status "%s"', async (statusName) => {
                fetch.mockReturnValueOnce(Promise.resolve(constructResponse([[statusName]], clock)));
                fetch.mockReturnValueOnce(Promise.resolve(constructResponse([[statusName]], clock)));
                fetch.mockReturnValueOnce(Promise.resolve(constructResponse([[statusName]], clock)));

                const results = await getPageStatusesStream([
                    'http://some.service.io/status_page/rss',
                    'http://some2.service.io/status_page/rss',
                    'http://some3.service.io/status_page/rss'
                ]).pipe(
                    take(3), 
                    toArray()
                ).toPromise();

                expect(results).toHaveLength(3);
                expect(results).toEqual(expect.arrayContaining([
                    expect.objectContaining({
                        lastIncident: expect.objectContaining({
                            channelTitle: expect.any(String),
                            pubDate: expect.stringMatching(RFC822Regexp),
                            status: statusName,
                            title: expect.any(String),
                        }),
                        service: expect.any(String),
                    })
                ]));
            });
        });    

        describe('Incidents with status == Resolved', () => {
            test('should return incidents with status "Resolved"', async () => {
                const statusName = 'Resolved';
                fetch.mockReturnValueOnce(Promise.resolve(constructResponse([[statusName]], clock)));
                fetch.mockReturnValueOnce(Promise.resolve(constructResponse([[statusName]], clock)));
                fetch.mockReturnValueOnce(Promise.resolve(constructResponse([[statusName]], clock)));

                const results = await getPageStatusesStream([
                    'http://some.service.io/status_page/rss',
                    'http://some2.service.io/status_page/rss',
                    'http://some3.service.io/status_page/rss'
                ]).pipe(
                    take(3),
                    toArray()
                ).toPromise();

                expect(results).toHaveLength(1);
                expect(results).toEqual([{
                    empty: true,
                    message: "No incidents found!",
                }]);
            });
        });
        
        describe('Incidents with mixed statuses', () => {
            test('should return incidents only with status != "Resolved"', async () => {
                fetch.mockReturnValueOnce(Promise.resolve(constructResponse([['Investigating', 'Monitoring', 'Resolved']], clock)));
                fetch.mockReturnValueOnce(Promise.resolve(constructResponse([['Investigating', 'Update']], clock)));
                fetch.mockReturnValueOnce(Promise.resolve(constructResponse([['Investigating', 'Update', 'Identified']], clock)));

                const results = await getPageStatusesStream([
                    'http://some.service.io/status_page/rss',
                    'http://some2.service.io/status_page/rss',
                    'http://some3.service.io/status_page/rss'
                ]).pipe(
                    take(3),
                    toArray()
                ).toPromise();

                expect(results).toHaveLength(2);
                expect(results).toEqual([
                    expect.objectContaining({
                        lastIncident: expect.objectContaining({
                            channelTitle: expect.any(String),
                            pubDate: expect.stringMatching(RFC822Regexp),
                            status: 'Update',
                            title: expect.any(String),
                        }),
                        service: expect.any(String),
                    }),
                    expect.objectContaining({
                        lastIncident: expect.objectContaining({
                            channelTitle: expect.any(String),
                            pubDate: expect.stringMatching(RFC822Regexp),
                            status: 'Identified',
                            title: expect.any(String),
                        }),
                        service: expect.any(String),
                    })
                ]);
            });

            test('should return latest item with incidents statuses != "Resolved"', async () => {
                fetch.mockReturnValueOnce(Promise.resolve(constructResponse([
                    ['Investigating', 'Monitoring', 'Resolved'],
                    ['Investigating', 'Monitoring:Latest'],
                ], clock)));
                fetch.mockReturnValueOnce(Promise.resolve(constructResponse([
                    ['Investigating', 'Update', 'Resolved'],
                    ['Investigating:Latest'],
                ], clock)));
                fetch.mockReturnValueOnce(Promise.resolve(constructResponse([
                    ['Investigating', 'Update', 'Identified', 'Resolved'],
                    ['Investigating', 'Identified', 'Resolved'],
                ], clock)));

                const results = await getPageStatusesStream([
                    'http://some.service.io/status_page/rss',
                    'http://some2.service.io/status_page/rss',
                    'http://some3.service.io/status_page/rss'
                ]).pipe(
                    take(3),
                    toArray()
                ).toPromise();

                expect(results).toHaveLength(2);
                expect(results).toEqual([
                    expect.objectContaining({
                        lastIncident: expect.objectContaining({
                            channelTitle: expect.any(String),
                            pubDate: expect.stringMatching(RFC822Regexp),
                            status: 'Monitoring:Latest',
                            title: expect.any(String),
                        }),
                        service: expect.any(String),
                    }),
                    expect.objectContaining({
                        lastIncident: expect.objectContaining({
                            channelTitle: expect.any(String),
                            pubDate: expect.stringMatching(RFC822Regexp),
                            status: 'Investigating:Latest',
                            title: expect.any(String),
                        }),
                        service: expect.any(String),
                    }),
                ]);
            });
        });  
    });
});
