import Redis from 'ioredis';

async function inspectRedis() {
  const connection = new Redis({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
  });

  console.log('🔍 Inspecting Redis keys...\n');

  // Buscar todas las claves relacionadas con inbound
  const keys = await connection.keys('*inbound*');
  console.log(`Found ${keys.length} keys related to 'inbound':\n`);

  for (const key of keys.slice(0, 20)) {
    const type = await connection.type(key);
    console.log(`  ${key} (${type})`);
  }

  if (keys.length > 20) {
    console.log(`\n  ... and ${keys.length - 20} more keys`);
  }

  // Buscar claves con prefijo botbite
  console.log('\n\n🔍 Looking for botbite prefix keys...\n');
  const botbiteKeys = await connection.keys('botbite:*');
  console.log(`Found ${botbiteKeys.length} keys with 'botbite:' prefix:\n`);

  for (const key of botbiteKeys.slice(0, 20)) {
    const type = await connection.type(key);
    console.log(`  ${key} (${type})`);
  }

  if (botbiteKeys.length > 20) {
    console.log(`\n  ... and ${botbiteKeys.length - 20} more keys`);
  }

  await connection.quit();
}

inspectRedis().catch(console.error);
