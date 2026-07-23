import { randomUUID } from 'node:crypto';

import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from 'testcontainers';

const POSTGRES_PORT = 5432;

export interface StartedPostgresTestDatabase {
  container: StartedTestContainer;
  databaseUrl: string;
}

export interface PostgresTestDatabaseConfiguration {
  database: string;
  databaseUrl: string;
  password: string;
  username: string;
}

export function createPostgresTestDatabaseConfiguration(
  hostPort: number,
): PostgresTestDatabaseConfiguration {
  const suffix = randomUUID().replaceAll('-', '');
  const database = `icemetrics_test_${suffix}`;
  const username = `icemetrics_${suffix}`;
  const password = randomUUID();
  const databaseUrl = new URL('postgresql://127.0.0.1');
  databaseUrl.port = String(hostPort);
  databaseUrl.username = username;
  databaseUrl.password = password;
  databaseUrl.pathname = database;

  return {
    database,
    databaseUrl: databaseUrl.toString(),
    password,
    username,
  };
}

export async function startPostgresTestContainer(
  configuration: PostgresTestDatabaseConfiguration,
  hostPort: number,
): Promise<StartedPostgresTestDatabase> {
  const container = await new GenericContainer('postgres:17.10-alpine3.23')
    .withEnvironment({
      POSTGRES_DB: configuration.database,
      POSTGRES_PASSWORD: configuration.password,
      POSTGRES_USER: configuration.username,
    })
    .withExposedPorts({ container: POSTGRES_PORT, host: hostPort })
    .withStartupTimeout(60_000)
    .withWaitStrategy(
      Wait.forLogMessage(/database system is ready to accept connections/, 2),
    )
    .start();

  const databaseUrl = new URL(configuration.databaseUrl);
  databaseUrl.hostname = container.getHost();
  databaseUrl.port = String(container.getMappedPort(POSTGRES_PORT));

  return {
    container,
    databaseUrl: databaseUrl.toString(),
  };
}
