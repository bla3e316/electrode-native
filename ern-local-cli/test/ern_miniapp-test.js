import ernSupport from '@walmart/ern-util-dev';

describe('commands/miniapp', function () {
    this.timeout(100000);
    const {
        runBefore,
        runAfter,
        ernTest,
        ern,
        exists,
        gradle,
        compare,
    } = ernSupport(__dirname);

    before(runBefore);
    after(runAfter);
    it(`miniapp init genapp`, ernTest()
        .then(exists('genapp/package.json'))
        .then(compare('genapp', 'fixtures/init_genapp'))
    );

});