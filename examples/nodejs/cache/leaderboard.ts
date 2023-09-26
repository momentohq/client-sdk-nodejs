import {LeaderboardClient, LeaderboardConfigurations, CredentialProvider, SortedSetOrder} from '@gomomento/sdk';
import {
  LeaderboardDelete,
  LeaderboardFetch,
  LeaderboardGetRank,
  LeaderboardLength,
  LeaderboardRemoveElements,
  LeaderboardUpsert,
} from '@gomomento/sdk-core';

async function main() {
  const client = new LeaderboardClient({
    configuration: LeaderboardConfigurations.Laptop.v1(),
    credentialProvider: CredentialProvider.fromEnvironmentVariable({
      environmentVariableName: 'MOMENTO_API_KEY',
    }),
  });

  // upsert
  const elements: Map<bigint, number> = new Map([
    [123n, 100],
    [456n, 200],
    [789n, 300],
  ]);
  const upsertResp = await client.leaderboardUpsert('my-cache', 'my-leaderboard', elements);
  if (upsertResp instanceof LeaderboardUpsert.Success) {
    console.log('Upsert success');
  } else if (upsertResp instanceof LeaderboardUpsert.Error) {
    console.log('Upsert error:', upsertResp.message());
  }

  // fetch by score
  const fetchByScore = await client.leaderboardFetchByScore('my-cache', 'my-leaderboard', {
    minScore: 100,
    maxScore: 500,
    order: SortedSetOrder.Descending,
    offset: 10,
    count: 100,
  });
  if (fetchByScore instanceof LeaderboardFetch.Success) {
    console.log('Fetch by score success');
  } else if (fetchByScore instanceof LeaderboardFetch.Error) {
    console.log('Fetch by score error:', fetchByScore.message());
  }

  // fetch by rank
  const fetchByRank = await client.leaderboardFetchByRank('my-cache', 'my-leaderboard', {
    startRank: 1,
    endRank: 5,
    order: SortedSetOrder.Ascending,
  });
  if (fetchByRank instanceof LeaderboardFetch.Success) {
    console.log('Fetch by rank success');
  } else if (fetchByRank instanceof LeaderboardFetch.Error) {
    console.log('Fetch by rank error:', fetchByRank.message());
  }

  // get rank
  const getRank = await client.leaderboardGetRank('my-cache', 'my-leaderboard', 123n);
  if (getRank instanceof LeaderboardGetRank.Success) {
    console.log('Get rank success');
  } else if (getRank instanceof LeaderboardGetRank.Error) {
    console.log('Get rank error:', getRank.message());
  }

  // length
  const lengthResp = await client.leaderboardLength('my-cache', 'my-leaderboard');
  if (lengthResp instanceof LeaderboardLength.Success) {
    console.log('Get leaderboard length success');
  } else if (lengthResp instanceof LeaderboardLength.Error) {
    console.log('Get leaderboard length error:', lengthResp.message());
  }

  // remove
  const removeResp = await client.leaderboardRemoveElements('my-cache', 'my-leaderboard', [123n, 456n, 789n]);
  if (removeResp instanceof LeaderboardRemoveElements.Success) {
    console.log('Remove elements success');
  } else if (removeResp instanceof LeaderboardRemoveElements.Error) {
    console.log('Remove elements error:', removeResp.message());
  }

  // delete
  const deleteResp = await client.leaderboardDelete('my-cache', 'my-leaderboard');
  if (deleteResp instanceof LeaderboardDelete.Success) {
    console.log('Delete leaderboard success');
  } else if (deleteResp instanceof LeaderboardDelete.Error) {
    console.log('Delete leaderboard error:', deleteResp.message());
  }
}

main()
  .then(() => {
    console.log('Leaderboard example completed!');
  })
  .catch((e: Error) => {
    console.error(`Uncaught exception while running example: ${e.message}`);
    throw e;
  });
