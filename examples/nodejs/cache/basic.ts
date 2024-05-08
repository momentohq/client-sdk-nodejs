import {
  CacheGet,
  CreateCache,
  CacheSet,
  CacheClient,
  Configurations,
  CredentialProvider,
  CacheGetResponse,
} from '@gomomento/sdk';

async function main() {
  const momento = await CacheClient.create({
    configuration: Configurations.Laptop.v1(),
    credentialProvider: CredentialProvider.fromEnvironmentVariable({
      environmentVariableName: 'MOMENTO_API_KEY',
    }),
    defaultTtlSeconds: 60,
  });

  const createCacheResponse = await momento.createCache('cache');
  if (createCacheResponse instanceof CreateCache.AlreadyExists) {
    console.log('cache already exists');
  } else if (createCacheResponse instanceof CreateCache.Error) {
    throw createCacheResponse.innerException();
  }

  console.log('Storing key=foo, value=FOO');
  const setResponse = await momento.set('cache', 'foo', 'FOO');
  if (setResponse instanceof CacheSet.Success) {
    console.log('Key stored successfully!');
  } else {
    console.log(`Error setting key: ${setResponse.toString()}`);
  }

  const getResponse = await momento.get('cache', 'foo');
  switch (getResponse.type) {
    // case CacheGet.ResponseType.Hit:
    //   console.log(`cache hit: ${getResponse.valueString()}`);
    //   break;
    // case CacheGet.ResponseType.Miss:
    //   console.log('cache miss');
    //   break;
    // case CacheGet.ResponseType.Error:
    //   console.log(`Error: ${getResponse.message()}`);
    //   break;
    case CacheGetResponse.Hit: {
      console.log('hit', getResponse.valueString());
      break;
    }
    case CacheGetResponse.Miss: {
      console.log('miss', getResponse.value());
      break;
    }
    case CacheGetResponse.Error: {
      console.log('error', getResponse.message());
    }
  }
  // if (getResponse instanceof CacheGet.Hit) {
  //   console.log(`cache hit: ${getResponse.valueString()}`);
  // } else if (getResponse instanceof CacheGet.Miss) {
  //   console.log('cache miss');
  // } else if (getResponse instanceof CacheGet.Error) {
  //   console.log(`Error: ${getResponse.message()}`);
  // }
}

main()
  .then(() => {
    console.log('success!!');
  })
  .catch((e: Error) => {
    console.error(`Uncaught exception while running example: ${e.message}`);
    throw e;
  });
