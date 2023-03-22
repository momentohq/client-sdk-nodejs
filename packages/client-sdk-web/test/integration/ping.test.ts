import {NoopMomentoLoggerFactory} from '@gomomento/common/dist/src/config/logging';
import {PingClient} from '../../src/ping-client';

describe('ping service', () => {
  it('ping should work', async () => {
    const client = new PingClient({
      endpoint: 'cell-alpha-dev.preprod.a.momentohq.com',
      configuration: {
        getLoggerFactory: () => new NoopMomentoLoggerFactory(),
      },
    });
    await client.ping();
  });
});
