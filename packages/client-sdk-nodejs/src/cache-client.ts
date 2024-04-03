import {CacheControlClient} from './internal/cache-control-client';
import {CacheDataClient} from './internal/cache-data-client';
import {
  CreateSigningKey,
  ListSigningKeys,
  RevokeSigningKey,
  CacheFlush,
  MomentoLogger,
  Configuration,
  Configurations,
} from '.';
import {CacheClientProps, EagerCacheClientProps} from './cache-client-props';
import {
  range,
  Semaphore,
  validateTimeout,
  validateTtlSeconds,
} from '@gomomento/sdk-core/dist/src/internal/utils';
import {ICacheClient} from '@gomomento/sdk-core/dist/src/clients/ICacheClient';
import {AbstractCacheClient} from '@gomomento/sdk-core/dist/src/internal/clients/cache/AbstractCacheClient';
import {CacheClientPropsWithConfig} from './internal/cache-client-props-with-config';

const EAGER_CONNECTION_DEFAULT_TIMEOUT_SECONDS = 30;

/**
 * Momento Cache Client.
 *
 * Features include:
 * - Get, set, and delete data
 * - Create, delete, and list caches
 * - Create, revoke, and list signing keys
 */
export class CacheClient extends AbstractCacheClient implements ICacheClient {
  private readonly logger: MomentoLogger;
  private readonly notYetAbstractedControlClient: CacheControlClient;
  private readonly _configuration: Configuration;
  static semaphore: Semaphore;

  /**
   * Creates an instance of CacheClient.
   * @param {CacheClientProps} props configuration and credentials for creating a CacheClient.
   */
  constructor(props: CacheClientProps) {
    validateTtlSeconds(props.defaultTtlSeconds);
    const configuration: Configuration =
      props.configuration ?? getDefaultCacheClientConfiguration();
    const propsWithConfig: CacheClientPropsWithConfig = {
      ...props,
      configuration: configuration,
    };

    const numConcurrentRequests = configuration
      .getTransportStrategy()
      .getGrpcConfig()
      .getConcurrentRequestsLimit();
    CacheClient.semaphore = new Semaphore(numConcurrentRequests);

    const controlClient = new CacheControlClient({
      configuration: configuration,
      credentialProvider: props.credentialProvider,
    });

    const numClients = configuration
      .getTransportStrategy()
      .getGrpcConfig()
      .getNumClients();
    const dataClients = range(numClients).map(
      (_, id) => new CacheDataClient(propsWithConfig, String(id))
    );
    super(controlClient, dataClients);
    this._configuration = configuration;
    this.notYetAbstractedControlClient = controlClient;

    this.logger = configuration.getLoggerFactory().getLogger(this);
    this.logger.debug('Creating Momento CacheClient');
  }

  public close() {
    CacheClient.semaphore.purge();
    this.controlClient.close();
    this.dataClients.map(dc => dc.close());
    this._configuration.getMiddlewares().map(m => {
      if (m.close) {
        m.close();
      }
    });
  }

  /**
   * Creates a new instance of CacheClient. If eagerConnectTimeout is present in the given props, the client will
   * eagerly create its connection to Momento. It will wait until the connection is established, or until the timout
   * runs out. It the timeout runs out, the client will be valid to use, but it may still be connecting in the background.
   * @param {EagerCacheClientProps} props configuration and credentials for creating a CacheClient.
   */
  static async create(props: EagerCacheClientProps): Promise<CacheClient> {
    const client = new CacheClient(props);
    const timeout =
      props.eagerConnectTimeout !== undefined
        ? props.eagerConnectTimeout
        : EAGER_CONNECTION_DEFAULT_TIMEOUT_SECONDS;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    validateTimeout(timeout);
    // client need to explicitly set the value as 0 to disable eager connection.
    if (props.eagerConnectTimeout !== 0) {
      await Promise.all(
        client.dataClients.map(dc => (dc as CacheDataClient).connect(timeout))
      );
    }
    return client;
  }

  /**
   * Returns the configuration used to create the CacheClient.
   *
   * @readonly
   * @type {Configuration} - The configuration used to create the CacheClient.
   * @memberof CacheClient
   */
  public get configuration(): Configuration {
    return this._configuration;
  }

  /**
   * Flushes / clears all the items of the given cache
   *
   * @param {string} cacheName - The cache to be flushed.
   * @returns {Promise<CacheFlush.Response>} -
   * {@link CacheFlush.Success} on success.
   * {@link CacheFlush.Error} on failure.
   */
  public async flushCache(cacheName: string): Promise<CacheFlush.Response> {
    return await this.notYetAbstractedControlClient.flushCache(cacheName);
  }

  /**
   * Creates a Momento signing key.
   *
   * @param {number} ttlMinutes - The time to live in minutes until the Momento
   * signing key expires.
   * @returns {Promise<CreateSigningKey.Response>} -
   * {@link CreateSigningKey.Success} containing the key, key ID, endpoint, and
   * expiration date on success.
   * {@link CreateSigningKey.Error} on failure.
   */
  public async createSigningKey(
    ttlMinutes: number
  ): Promise<CreateSigningKey.Response> {
    const client = this.getNextDataClient();
    return await this.notYetAbstractedControlClient.createSigningKey(
      ttlMinutes,
      client.getEndpoint()
    );
  }

  /**
   * Revokes a Momento signing key.
   *
   * @remarks
   * All tokens signed by this key will be invalid.
   *
   * @param {string} keyId - The ID of the key to revoke.
   * @returns {Promise<RevokeSigningKey.Response>} -
   * {@link RevokeSigningKey.Success} on success.
   * {@link RevokeSigningKey.Error} on failure.
   */
  public async revokeSigningKey(
    keyId: string
  ): Promise<RevokeSigningKey.Response> {
    return await this.notYetAbstractedControlClient.revokeSigningKey(keyId);
  }

  /**
   * Lists all Momento signing keys for the provided auth token.
   *
   * @returns {Promise<ListSigningKeys.Response>} -
   * {@link ListSigningKeys.Success} containing the keys on success.
   * {@link ListSigningKeys.Error} on failure.
   */
  public async listSigningKeys(): Promise<ListSigningKeys.Response> {
    const client = this.getNextDataClient();
    return await this.notYetAbstractedControlClient.listSigningKeys(
      client.getEndpoint()
    );
  }

  protected getNextDataClient(): CacheDataClient {
    const client = this.dataClients[this.nextDataClientIndex];
    this.nextDataClientIndex =
      (this.nextDataClientIndex + 1) % this.dataClients.length;
    return client as CacheDataClient;
  }
}

function getDefaultCacheClientConfiguration(): Configuration {
  const config = Configurations.Laptop.latest();
  const logger = config.getLoggerFactory().getLogger('CacheClient');
  logger.info(
    'No configuration provided to CacheClient. Using default "Laptop" configuration, suitable for development. For production use, consider specifying an explicit configuration.'
  );
  return config;
}

/**
 * @deprecated use {CacheClient} instead
 */
export class SimpleCacheClient extends CacheClient {}
