import {v4} from 'uuid';
import {
  TopicClient,
  MomentoErrorCode,
  TopicPublish,
  TopicSubscribe,
  InvalidArgumentError,
} from '../../src';
import {
  SetupIntegrationTest,
  IntegrationTestCacheClientProps,
  ItBehavesLikeItValidatesCacheName,
  ValidateCacheProps,
} from './integration-setup';
import {TextEncoder} from 'util';
import {
  ResponseBase,
  IResponseError,
} from '../../src/messages/responses/response-base';
import {SubscribeCallOptions} from '../../src/utils/topic-call-options';
import {sleep} from '../../src/internal/utils/sleep';

const {IntegrationTestCacheName} = SetupIntegrationTest();
const topicClient = new TopicClient({
  configuration: IntegrationTestCacheClientProps.configuration,
  credentialProvider: IntegrationTestCacheClientProps.credentialProvider,
});

interface ValidateTopicProps {
  topicName: string;
}

const STREAM_WAIT_TIME_MS = 2000;

function ItBehavesLikeItValidatesTopicName(
  getResponse: (props: ValidateTopicProps) => Promise<ResponseBase>
) {
  it('validates its topic name', async () => {
    const response = await getResponse({topicName: '   '});
    expect((response as IResponseError).errorCode()).toEqual(
      MomentoErrorCode.INVALID_ARGUMENT_ERROR
    );
    expect((response as IResponseError).message()).toEqual(
      'Invalid argument passed to Momento client: topic name must not be empty'
    );
  });
}

function ItBehavesLikeItValidatesRequestTimeout(requestTimeout: number) {
  it(`should be throw an error for an invalid request timeout (requestTimeout=${requestTimeout})`, () => {
    expect(() => {
      new TopicClient({
        configuration:
          IntegrationTestCacheClientProps.configuration.withClientTimeoutMillis(
            requestTimeout
          ),
        credentialProvider: IntegrationTestCacheClientProps.credentialProvider,
      });
    }).toThrowError(
      new InvalidArgumentError('request timeout must be greater than zero.')
    );
  });
}

describe('topic client constructor', () => {
  ItBehavesLikeItValidatesRequestTimeout(0);
  ItBehavesLikeItValidatesRequestTimeout(-1);
});

describe('#publish', () => {
  ItBehavesLikeItValidatesCacheName((props: ValidateCacheProps) => {
    return topicClient.publish(props.cacheName, 'topic', 'value');
  });

  ItBehavesLikeItValidatesTopicName((props: ValidateTopicProps) => {
    return topicClient.publish('cache', props.topicName, 'value');
  });

  it('validates its value', async () => {
    const response = await topicClient.publish('cache', 'topic', '  ');
    expect((response as IResponseError).errorCode()).toEqual(
      MomentoErrorCode.INVALID_ARGUMENT_ERROR
    );
    expect((response as IResponseError).message()).toEqual(
      'Invalid argument passed to Momento client: value must not be empty'
    );
  });

  it('should error when publishing to a cache that does not exist', async () => {
    const response = await topicClient.publish(v4(), 'topic', 'value');
    expect((response as IResponseError).errorCode()).toEqual(
      MomentoErrorCode.NOT_FOUND_ERROR
    );
    expect((response as IResponseError).message()).toEqual(
      'A cache with the specified name does not exist.  To resolve this error, make sure you have created the cache before attempting to use it: 5 NOT_FOUND: Cache not found'
    );
  });

  it('should not error when publishing to a topic that does not exist', async () => {
    const response = await topicClient.publish(
      IntegrationTestCacheName,
      v4(),
      'value'
    );
    expect(response).toBeInstanceOf(TopicPublish.Success);
  });
});

describe('#subscribe', () => {
  const trivialHandlers: SubscribeCallOptions = {
    onError: () => {
      return;
    },
    onItem: () => {
      return;
    },
  };

  ItBehavesLikeItValidatesCacheName((props: ValidateCacheProps) => {
    return topicClient.subscribe(props.cacheName, 'topic', trivialHandlers);
  });

  ItBehavesLikeItValidatesTopicName((props: ValidateTopicProps) => {
    return topicClient.subscribe('cache', props.topicName, trivialHandlers);
  });

  it('should error when subscribing to a cache that does not exist and unsubscribe from the error handler', async () => {
    const response = await topicClient.subscribe(v4(), 'topic');
    expect((response as IResponseError).errorCode()).toEqual(
      MomentoErrorCode.NOT_FOUND_ERROR
    );
  });
});

describe('subscribe and publish', () => {
  it('should publish strings and bytes and receive them on a subscription', async () => {
    const topicName = v4();
    const publishedValues = [
      'value1',
      'value2',
      new TextEncoder().encode('value3'),
    ];
    const receivedValues: (string | Uint8Array)[] = [];

    let done = false;
    const subscribeResponse = await topicClient.subscribe(
      IntegrationTestCacheName,
      topicName,
      {
        onItem: (item: TopicSubscribe.Item) => {
          receivedValues.push(item.value());
        },
        onError: (error: TopicSubscribe.Error) => {
          if (!done) {
            expect(1).fail(
              `Should not receive an error but got one: ${error.message()}`
            );
          }
        },
      }
    );
    expect(subscribeResponse).toBeInstanceOf(TopicSubscribe.Subscription);

    // Wait for stream to start.
    await sleep(STREAM_WAIT_TIME_MS);

    for (const value of publishedValues) {
      const publishResponse = await topicClient.publish(
        IntegrationTestCacheName,
        topicName,
        value
      );
      expect(publishResponse).toBeInstanceOf(TopicPublish.Success);
    }

    // Wait for values to be received.
    await sleep(STREAM_WAIT_TIME_MS);

    expect(receivedValues).toEqual(publishedValues);
    done = true;

    // Need to close the stream before the test ends or else the test will hang.
    (subscribeResponse as TopicSubscribe.Subscription).unsubscribe();
  });

  it('should not receive messages when unsubscribed', async () => {
    const topicName = v4();
    const publishedValue = 'value';
    const receivedValues: (string | Uint8Array)[] = [];

    let done = false;
    const subscribeResponse = await topicClient.subscribe(
      IntegrationTestCacheName,
      topicName,
      {
        onItem: (item: TopicSubscribe.Item) => {
          receivedValues.push(item.value());
        },
        onError: (error: TopicSubscribe.Error) => {
          if (!done) {
            expect(1).fail(
              `Should not receive an error but got one: ${error.message()}`
            );
          }
        },
      }
    );
    expect(subscribeResponse).toBeInstanceOf(TopicSubscribe.Subscription);

    // Wait for stream to start.
    await sleep(STREAM_WAIT_TIME_MS);
    // Unsubscribing before data is published should not receive any data.
    (subscribeResponse as TopicSubscribe.Subscription).unsubscribe();

    const publishResponse = await topicClient.publish(
      IntegrationTestCacheName,
      topicName,
      publishedValue
    );
    expect(publishResponse).toBeInstanceOf(TopicPublish.Response);

    // Wait for values to go over the network.
    await sleep(STREAM_WAIT_TIME_MS);

    expect(receivedValues).toEqual([]);
    done = true;

    // Need to close the stream before the test ends or else the test will hang.
    (subscribeResponse as TopicSubscribe.Subscription).unsubscribe();
  });

  it('should subscribe with default handlers', async () => {
    const topicName = v4();

    const subscribeResponse = await topicClient.subscribe(
      IntegrationTestCacheName,
      topicName
    );
    expect(subscribeResponse).toBeInstanceOf(TopicSubscribe.Subscription);
    (subscribeResponse as TopicSubscribe.Subscription).unsubscribe();
  });
});
