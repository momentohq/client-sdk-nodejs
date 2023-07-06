import {
  AllDataReadWrite,
  CreateCache,
  DeleteCache,
  ExpiresIn,
  GenerateAuthToken,
  MomentoErrorCode,
  RefreshAuthToken,
  TokenScope,
  Permissions,
  CachePermission,
  TopicPermission,
  CacheRole,
  TopicRole,
  TopicPublish,
  TopicSubscribe,
  SubscribeCallOptions,
  CacheSet,
  CacheGet,
} from '@gomomento/sdk-core';
import {expectWithMessage} from './common-int-test-utils';
import {InternalSuperUserPermissions} from '@gomomento/sdk-core/dist/src/internal/utils/auth';
import {
  IAuthClient,
  ICacheClient,
  ITopicClient,
} from '@gomomento/sdk-core/dist/src/internal/clients';
import {v4} from 'uuid';

const SUPER_USER_PERMISSIONS: TokenScope = new InternalSuperUserPermissions();

export function runAuthClientTests(
  sessionTokenAuthClient: IAuthClient,
  legacyTokenAuthClient: IAuthClient,
  sessionTokenCacheClient: ICacheClient,
  sessionTokenTopicClient: ITopicClient,
  authTokenAuthClientFactory: (authToken: string) => IAuthClient,
  cacheClientFactory: (token: string) => ICacheClient,
  topicClientFactory: (token: string) => ITopicClient,
  cacheName: string
) {
  describe('generate auth token using session token credentials', () => {
    it('should return success and generate auth token', async () => {
      const resp = await sessionTokenAuthClient.generateAuthToken(
        SUPER_USER_PERMISSIONS,
        ExpiresIn.seconds(10)
      );
      expectWithMessage(
        () => expect(resp).toBeInstanceOf(GenerateAuthToken.Success),
        `Unexpected response: ${resp.toString()}`
      );
    });

    it('should succeed for generating an api token that expires', async () => {
      const secondsSinceEpoch = Math.round(Date.now() / 1000);
      const expireResponse = await sessionTokenAuthClient.generateAuthToken(
        SUPER_USER_PERMISSIONS,
        ExpiresIn.seconds(10)
      );
      const expiresIn = secondsSinceEpoch + 10;

      expect(expireResponse).toBeInstanceOf(GenerateAuthToken.Success);

      const expireResponseSuccess = expireResponse as GenerateAuthToken.Success;
      expect(expireResponseSuccess.is_success);
      expect(expireResponseSuccess.expiresAt.doesExpire());
      expect(expireResponseSuccess.expiresAt.epoch()).toBeWithin(
        expiresIn - 1,
        expiresIn + 2
      );
    });

    it('should succeed for generating an api token that never expires', async () => {
      const neverExpiresResponse =
        await sessionTokenAuthClient.generateAuthToken(
          SUPER_USER_PERMISSIONS,
          ExpiresIn.never()
        );
      expect(neverExpiresResponse).toBeInstanceOf(GenerateAuthToken.Success);
      const neverExpireResponseSuccess =
        neverExpiresResponse as GenerateAuthToken.Success;
      expect(neverExpireResponseSuccess.is_success);
      expect(neverExpireResponseSuccess.expiresAt.doesExpire()).toBeFalse();
    });

    it('should not succeed for generating an api token that has an invalid expires', async () => {
      const invalidExpiresResponse =
        await sessionTokenAuthClient.generateAuthToken(
          SUPER_USER_PERMISSIONS,
          ExpiresIn.seconds(-100)
        );
      expect(invalidExpiresResponse).toBeInstanceOf(GenerateAuthToken.Error);
      expect(
        (invalidExpiresResponse as GenerateAuthToken.Error).errorCode()
      ).toEqual(MomentoErrorCode.INVALID_ARGUMENT_ERROR);
    });
  });

  describe('refresh auth token use auth token credentials', () => {
    it('should succeed for refreshing an auth token', async () => {
      const generateResponse = await sessionTokenAuthClient.generateAuthToken(
        SUPER_USER_PERMISSIONS,
        ExpiresIn.seconds(10)
      );
      expectWithMessage(() => {
        expect(generateResponse).toBeInstanceOf(GenerateAuthToken.Success);
      }, `Unexpected response: ${generateResponse.toString()}`);
      const generateSuccessRst = generateResponse as GenerateAuthToken.Success;

      const authTokenAuthClient = authTokenAuthClientFactory(
        generateSuccessRst.authToken
      );

      // we need to sleep for a bit here so that the timestamp on the refreshed token will be different than the
      // one on the original token
      const delaySecondsBeforeRefresh = 2;
      await delay(delaySecondsBeforeRefresh * 1_000);

      const refreshResponse = await authTokenAuthClient.refreshAuthToken(
        generateSuccessRst.refreshToken
      );
      expectWithMessage(() => {
        expect(refreshResponse).toBeInstanceOf(RefreshAuthToken.Success);
      }, `Unexpected response: ${refreshResponse.toString()}`);
      const refreshSuccessRst = refreshResponse as RefreshAuthToken.Success;

      expect(refreshSuccessRst.is_success);

      const expiresAtDelta =
        refreshSuccessRst.expiresAt.epoch() -
        generateSuccessRst.expiresAt.epoch();

      expect(expiresAtDelta).toBeGreaterThanOrEqual(delaySecondsBeforeRefresh);
      expect(expiresAtDelta).toBeLessThanOrEqual(delaySecondsBeforeRefresh + 1);
    });

    it("should not succeed for refreshing an api token that's expired", async () => {
      const generateResponse = await sessionTokenAuthClient.generateAuthToken(
        SUPER_USER_PERMISSIONS,
        ExpiresIn.seconds(1)
      );
      const generateSuccessRst = generateResponse as GenerateAuthToken.Success;

      // Wait 1sec for the token to expire
      await delay(1000);

      const authTokenAuthClient = authTokenAuthClientFactory(
        generateSuccessRst.authToken
      );

      const refreshResponse = await authTokenAuthClient.refreshAuthToken(
        generateSuccessRst.refreshToken
      );
      expect(refreshResponse).toBeInstanceOf(RefreshAuthToken.Error);
      expect((refreshResponse as RefreshAuthToken.Error).errorCode()).toEqual(
        MomentoErrorCode.AUTHENTICATION_ERROR
      );
    });

    it("expired token can't create cache", async () => {
      const generateResponse = await sessionTokenAuthClient.generateAuthToken(
        SUPER_USER_PERMISSIONS,
        ExpiresIn.seconds(1)
      );
      const generateSuccessRst = generateResponse as GenerateAuthToken.Success;

      // Wait 1sec for the token to expire
      await delay(1000);

      const cacheClient = cacheClientFactory(generateSuccessRst.authToken);

      const createCacheRst = await cacheClient.createCache(
        'cache-should-fail-to-create'
      );

      expect(createCacheRst).toBeInstanceOf(CreateCache.Error);
      const createCacheErrorRst = createCacheRst as CreateCache.Error;
      expect(createCacheErrorRst.errorCode()).toEqual(
        MomentoErrorCode.AUTHENTICATION_ERROR
      );
    });

    it('should support generating a superuser token when authenticated via a session token', async () => {
      const generateResponse = await sessionTokenAuthClient.generateAuthToken(
        SUPER_USER_PERMISSIONS,
        ExpiresIn.seconds(1)
      );
      expect(generateResponse).toBeInstanceOf(GenerateAuthToken.Success);
    });

    it('should support generating an AllDataReadWrite token when authenticated via a session token', async () => {
      const generateResponse = await sessionTokenAuthClient.generateAuthToken(
        AllDataReadWrite,
        ExpiresIn.seconds(1)
      );
      expect(generateResponse).toBeInstanceOf(GenerateAuthToken.Success);
    });

    it('should not support generating a superuser token when authenticated via a v1 superuser token', async () => {
      const superUserTokenResponse =
        await sessionTokenAuthClient.generateAuthToken(
          SUPER_USER_PERMISSIONS,
          ExpiresIn.seconds(10)
        );
      expect(superUserTokenResponse).toBeInstanceOf(GenerateAuthToken.Success);

      const authClient = authTokenAuthClientFactory(
        (superUserTokenResponse as GenerateAuthToken.Success).authToken
      );

      const generateResponse = await authClient.generateAuthToken(
        SUPER_USER_PERMISSIONS,
        ExpiresIn.seconds(1)
      );
      expect(generateResponse).toBeInstanceOf(GenerateAuthToken.Error);
      const error = generateResponse as GenerateAuthToken.Error;
      expect(error.errorCode()).toEqual(MomentoErrorCode.PERMISSION_ERROR);
      expect(error.message()).toContain('Insufficient permissions');
    });

    it('should support generating an AllDataReadWrite token when authenticated via a v1 superuser token', async () => {
      const superUserTokenResponse =
        await sessionTokenAuthClient.generateAuthToken(
          SUPER_USER_PERMISSIONS,
          ExpiresIn.seconds(10)
        );
      expect(superUserTokenResponse).toBeInstanceOf(GenerateAuthToken.Success);

      const authClient = authTokenAuthClientFactory(
        (superUserTokenResponse as GenerateAuthToken.Success).authToken
      );

      const generateResponse = await authClient.generateAuthToken(
        AllDataReadWrite,
        ExpiresIn.seconds(1)
      );
      expect(generateResponse).toBeInstanceOf(GenerateAuthToken.Success);
    });

    it('should not support generating a superuser token when authenticated via a v1 AllDataReadWrite token', async () => {
      const allDataReadWriteTokenResponse =
        await sessionTokenAuthClient.generateAuthToken(
          AllDataReadWrite,
          ExpiresIn.seconds(10)
        );
      expect(allDataReadWriteTokenResponse).toBeInstanceOf(
        GenerateAuthToken.Success
      );

      const authClient = authTokenAuthClientFactory(
        (allDataReadWriteTokenResponse as GenerateAuthToken.Success).authToken
      );

      const generateResponse = await authClient.generateAuthToken(
        SUPER_USER_PERMISSIONS,
        ExpiresIn.seconds(1)
      );
      expect(generateResponse).toBeInstanceOf(GenerateAuthToken.Error);
    });

    it('should not support generating an AllDataReadWrite token when authenticated via a v1 AllDataReadWrite token', async () => {
      const allDataReadWriteTokenResponse =
        await sessionTokenAuthClient.generateAuthToken(
          AllDataReadWrite,
          ExpiresIn.seconds(10)
        );
      expect(allDataReadWriteTokenResponse).toBeInstanceOf(
        GenerateAuthToken.Success
      );

      const authClient = authTokenAuthClientFactory(
        (allDataReadWriteTokenResponse as GenerateAuthToken.Success).authToken
      );

      const generateResponse = await authClient.generateAuthToken(
        AllDataReadWrite,
        ExpiresIn.seconds(1)
      );
      expect(generateResponse).toBeInstanceOf(GenerateAuthToken.Error);
    });

    it('should not support generating a superuser token when authenticated via a legacy token', async () => {
      const generateResponse = await legacyTokenAuthClient.generateAuthToken(
        SUPER_USER_PERMISSIONS,
        ExpiresIn.seconds(1)
      );
      expect(generateResponse).toBeInstanceOf(GenerateAuthToken.Error);
    });

    it('should not support generating an AllDataReadWrite token when authenticated via a legacy token', async () => {
      const generateResponse = await legacyTokenAuthClient.generateAuthToken(
        AllDataReadWrite,
        ExpiresIn.seconds(1)
      );
      expect(generateResponse).toBeInstanceOf(GenerateAuthToken.Error);
    });
  });

  describe('AllDataReadWrite token scope', () => {
    let allDataReadWriteClient: ICacheClient;

    beforeAll(async () => {
      const generateResponse = await sessionTokenAuthClient.generateAuthToken(
        AllDataReadWrite,
        ExpiresIn.seconds(60)
      );
      expect(generateResponse).toBeInstanceOf(GenerateAuthToken.Success);
      const allDataReadWriteToken = (
        generateResponse as GenerateAuthToken.Success
      ).authToken;
      allDataReadWriteClient = cacheClientFactory(allDataReadWriteToken);
    });
    it('cannot create a cache', async () => {
      const createCacheResponse = await allDataReadWriteClient.createCache(
        'FOOFOOFOO'
      );
      expect(createCacheResponse).toBeInstanceOf(CreateCache.Error);
      const createCacheError = createCacheResponse as CreateCache.Error;
      expect(createCacheError.errorCode()).toEqual(
        MomentoErrorCode.PERMISSION_ERROR
      );
      expect(createCacheError.message()).toContain('Insufficient permissions');
    });
    it('cannot delete a cache', async () => {
      const deleteCacheResponse = await allDataReadWriteClient.deleteCache(
        cacheName
      );
      expect(deleteCacheResponse).toBeInstanceOf(DeleteCache.Error);
      const deleteCacheError = deleteCacheResponse as DeleteCache.Error;
      expect(deleteCacheError.errorCode()).toEqual(
        MomentoErrorCode.PERMISSION_ERROR
      );
      expect(deleteCacheError.message()).toContain('Insufficient permissions');
    });

    it('can set values in an existing cache', async () => {
      const setResponse = await allDataReadWriteClient.set(
        cacheName,
        'foo',
        'FOO'
      );
      console.log('setResponse', setResponse);
      expect(setResponse).toBeInstanceOf(CacheSet.Success);
    });
    it('can get values from an existing cache', async () => {
      const getResponse = await allDataReadWriteClient.get(
        cacheName,
        'habanero'
      );
      console.log('getResponse', getResponse);
      expect(getResponse).toBeInstanceOf(CacheGet.Miss);
    });
  });

  describe('Fine grained authorization scenarios', () => {
    const FGA_CACHE_1 = 'fga-' + v4();
    const FGA_CACHE_2 = 'fga-' + v4();
    const FGA_CACHE_1_KEY = 'foo';
    const FGA_CACHE_1_VALUE = 'FOO';
    const FGA_CACHE_2_KEY = 'bar';
    const FGA_CACHE_2_VALUE = 'BAR';

    const trivialHandlers: SubscribeCallOptions = {
      onError: () => {
        return;
      },
      onItem: () => {
        return;
      },
    };

    // Setup 2 caches
    beforeAll(async () => {
      expect(
        await sessionTokenCacheClient.createCache(FGA_CACHE_1)
      ).toBeInstanceOf(CreateCache.Success);
      expect(
        await sessionTokenCacheClient.createCache(FGA_CACHE_2)
      ).toBeInstanceOf(CreateCache.Success);
      expect(
        await sessionTokenCacheClient.set(FGA_CACHE_1, 'foo', 'FOO', {ttl: 600})
      ).toBeInstanceOf(CacheSet.Success);
      expect(
        await sessionTokenCacheClient.set(FGA_CACHE_2, 'bar', 'BAR', {ttl: 600})
      ).toBeInstanceOf(CacheSet.Success);
    });

    it('can only read all caches', async () => {
      const readAllCachesTokenResponse =
        await sessionTokenAuthClient.generateAuthToken(
          new Permissions([new CachePermission(CacheRole.ReadOnly)]),
          ExpiresIn.seconds(10)
        );
      expect(readAllCachesTokenResponse).toBeInstanceOf(
        GenerateAuthToken.Success
      );
      const readAllCachesToken = (
        readAllCachesTokenResponse as GenerateAuthToken.Success
      ).authToken;
      const cacheClient = cacheClientFactory(readAllCachesToken);
      // 1. Sets should fail
      const setError1 = await cacheClient.set(FGA_CACHE_1, 'homer', 'simpson');
      expect(setError1).toBeInstanceOf(CacheSet.Error);
      expect(setError1).toHaveProperty(
        'errorCode',
        MomentoErrorCode.PERMISSION_ERROR
      );
      const setError2 = await cacheClient.set(FGA_CACHE_2, 'oye', 'caramba', {
        ttl: 30,
      });
      expect(setError2).toBeInstanceOf(CacheSet.Error);
      expect(setError2).toHaveProperty(
        'errorCode',
        MomentoErrorCode.PERMISSION_ERROR
      );

      // 2. Gets for existing keys should succeed with hits
      const hitResp1 = await cacheClient.get(FGA_CACHE_1, FGA_CACHE_1_KEY);
      expect(hitResp1).toBeInstanceOf(CacheGet.Hit);
      expect(hitResp1).toHaveProperty('valueString', FGA_CACHE_1_VALUE);
      const hitResp2 = await cacheClient.get(FGA_CACHE_2, FGA_CACHE_2_KEY);
      expect(hitResp2).toBeInstanceOf(CacheGet.Hit);
      expect(hitResp2).toHaveProperty('valueString', FGA_CACHE_2_VALUE);

      // 3. Gets for non-existing keys return misses
      const missResp1 = await cacheClient.get(FGA_CACHE_1, 'i-exist-not');
      expect(missResp1).toBeInstanceOf(CacheGet.Miss);
      const missResp2 = await cacheClient.get(FGA_CACHE_2, 'i-exist-not');
      expect(missResp2).toBeInstanceOf(CacheGet.Miss);

      const topicClient = topicClientFactory(readAllCachesToken);
      const pubResp = await topicClient.publish(
        FGA_CACHE_1,
        'Ankh-Morpork Inquirer',
        'There is a werewolf in the City Watch!!!!!'
      );
      expect(pubResp).toBeInstanceOf(TopicPublish.Error);
      expect(pubResp).toHaveProperty(
        'errorCode',
        MomentoErrorCode.PERMISSION_ERROR
      );

      const subResp = await topicClient.subscribe(
        FGA_CACHE_1,
        'Ankh-Morpork Inquirer',
        trivialHandlers
      );
      expect(subResp).toBeInstanceOf(TopicSubscribe.Error);
      expect(subResp).toHaveProperty(
        'errorCode',
        MomentoErrorCode.PERMISSION_ERROR
      );
    });

    it('can only read all topics', async () => {
      const readAllTopicsTokenResponse =
        await sessionTokenAuthClient.generateAuthToken(
          new Permissions([new TopicPermission(TopicRole.ReadOnly)]),
          ExpiresIn.seconds(10)
        );
      expect(readAllTopicsTokenResponse).toBeInstanceOf(
        GenerateAuthToken.Success
      );
      const readAllTopicsToken = (
        readAllTopicsTokenResponse as GenerateAuthToken.Success
      ).authToken;
      const cacheClient = cacheClientFactory(readAllTopicsToken);
      // Sets should fail
      const setResp1 = await cacheClient.set(FGA_CACHE_1, 'homer', 'simpson');
      expect(setResp1).toBeInstanceOf(CacheSet.Error);
      expect(setResp1).toHaveProperty(
        'errorCode',
        MomentoErrorCode.PERMISSION_ERROR
      );
      const setResp2 = await cacheClient.set(FGA_CACHE_2, 'oye', 'caramba', {
        ttl: 30,
      });
      expect(setResp2).toBeInstanceOf(CacheSet.Error);
      expect(setResp2).toHaveProperty(
        'errorCode',
        MomentoErrorCode.PERMISSION_ERROR
      );

      // Gets should fail
      const getResp1 = await cacheClient.get(FGA_CACHE_1, FGA_CACHE_1_KEY);
      expect(getResp1).toBeInstanceOf(CacheGet.Error);
      expect(getResp1).toHaveProperty('valueString', FGA_CACHE_1_VALUE);
      const getResp2 = await cacheClient.get(FGA_CACHE_2, FGA_CACHE_2_KEY);
      expect(getResp2).toBeInstanceOf(CacheGet.Error);

      const topicClient = topicClientFactory(readAllTopicsToken);
      // Publish should fail
      const pubResp = await topicClient.publish(
        FGA_CACHE_1,
        'The Ankh-Morpork Times',
        'The Truth Shall Make Ye Fret'
      );
      expect(pubResp).toBeInstanceOf(TopicPublish.Error);
      expect(pubResp).toHaveProperty(
        'errorCode',
        MomentoErrorCode.PERMISSION_ERROR
      );

      // Subscribe should succeed
      const subResp = await topicClient.subscribe(
        FGA_CACHE_1,
        'The Ankh-Morpork Times',
        trivialHandlers
      );
      expect(subResp).toBeInstanceOf(TopicSubscribe.Subscription);
    });

    it('can read/write cache FGA_CACHE_1 and read/write all topics in cache FGA_CACHE_2', async () => {
      const tokenResponse = await sessionTokenAuthClient.generateAuthToken(
        new Permissions([
          new CachePermission(CacheRole.ReadWrite, {
            cache: {name: FGA_CACHE_1},
          }),
          new TopicPermission(TopicRole.ReadWrite, {
            cache: {name: FGA_CACHE_2},
          }),
        ]),
        ExpiresIn.seconds(10)
      );
      expect(tokenResponse).toBeInstanceOf(GenerateAuthToken.Success);
      const token = (tokenResponse as GenerateAuthToken.Success).authToken;
      const cacheClient = cacheClientFactory(token);

      // Read/Write on cache FGA_CACHE_1 is allowed
      const setResp = await cacheClient.set(FGA_CACHE_1, 'ned', 'flanders');
      expect(setResp).toBeInstanceOf(CacheSet.Success);

      const hitResp = await cacheClient.get(FGA_CACHE_1, 'ned');
      expect(hitResp).toBeInstanceOf(CacheGet.Hit);
      expect(hitResp).toHaveProperty('valueString', 'flanders');

      // Read/Write on cache FGA_CACHE_2 is not allowed
      const setResp1 = await cacheClient.set(FGA_CACHE_2, 'flaming', 'mo');
      expect(setResp1).toBeInstanceOf(CacheSet.Error);
      expect(setResp1).toHaveProperty(
        'errorCode',
        MomentoErrorCode.PERMISSION_ERROR
      );
      const getResp1 = await cacheClient.get(FGA_CACHE_2, 'flaming');
      expect(getResp1).toBeInstanceOf(CacheGet.Error);
      expect(getResp1).toHaveProperty(
        'errorCode',
        MomentoErrorCode.PERMISSION_ERROR
      );

      const topicClient = topicClientFactory(token);
      // Read/Write on topics in cache FGA_CACHE_1 is not allowed
      const pubResp = await topicClient.publish(
        FGA_CACHE_1,
        'breaking news!',
        'Flying lizard seen over Manhattan!'
      );
      expect(pubResp).toBeInstanceOf(TopicPublish.Error);
      expect(pubResp).toHaveProperty(
        'errorCode',
        MomentoErrorCode.PERMISSION_ERROR
      );
      const subResp = await topicClient.subscribe(
        FGA_CACHE_1,
        'breaking news!',
        trivialHandlers
      );
      expect(subResp).toBeInstanceOf(TopicSubscribe.Error);
      expect(subResp).toHaveProperty(
        'errorCode',
        MomentoErrorCode.PERMISSION_ERROR
      );

      // Read/Write on topics in cache FGA_CACHE_2 is allowed
      expect(
        await topicClient.publish(FGA_CACHE_2, 'breaking news!', 'UFOs spotted')
      ).toBeInstanceOf(TopicPublish.Success);
      const subscribeResponse = await topicClient.subscribe(
        FGA_CACHE_2,
        'breaking news!',
        trivialHandlers
      );
      expectWithMessage(() => {
        expect(subscribeResponse).toBeInstanceOf(TopicSubscribe.Subscription);
      }, `expected SUBSCRIPTION but got ${subscribeResponse.toString()}`);
    });

    afterAll(async () => {
      expect(
        await sessionTokenCacheClient.deleteCache(FGA_CACHE_1)
      ).toBeInstanceOf(DeleteCache.Success);
      expect(
        await sessionTokenCacheClient.deleteCache(FGA_CACHE_2)
      ).toBeInstanceOf(DeleteCache.Success);
    });
  });
}

export function delay(ms: number): Promise<unknown> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
