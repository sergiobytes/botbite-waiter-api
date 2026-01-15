import { Queue } from 'bullmq';
import Redis from 'ioredis';

async function cleanQueue() {
  console.log('🧹 Cleaning Redis queue...\n');

  // Conectar a Redis con ioredis
  const connection = new Redis({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
  });

  console.log('✅ Connected to Redis');

  // Crear instancia de la cola con el prefijo correcto (botbite-dev en desarrollo)
  const queue = new Queue('inbound_message', {
    connection,
    prefix: 'botbite-dev',
  });

  // Obtener stats antes
  const countsBefore = await queue.getJobCounts();
  console.log('\n📊 Queue stats BEFORE:');
  console.log(`   Waiting: ${countsBefore.waiting}`);
  console.log(`   Active: ${countsBefore.active}`);
  console.log(`   Completed: ${countsBefore.completed}`);
  console.log(`   Failed: ${countsBefore.failed}`);

  // Limpiar todos los jobs
  console.log('\n🗑️  Removing jobs...');
  await queue.drain(); // Elimina waiting jobs
  await queue.clean(0, 1000, 'completed'); // Elimina completed
  await queue.clean(0, 1000, 'failed'); // Elimina failed

  // Obtener stats después
  const countsAfter = await queue.getJobCounts();
  console.log('\n📊 Queue stats AFTER:');
  console.log(`   Waiting: ${countsAfter.waiting}`);
  console.log(`   Active: ${countsAfter.active}`);
  console.log(`   Completed: ${countsAfter.completed}`);
  console.log(`   Failed: ${countsAfter.failed}`);

  console.log('\n✅ Queue cleaned successfully!');

  await queue.close();
  await connection.quit();
  process.exit(0);
}

cleanQueue().catch((error) => {
  console.error('❌ Error cleaning queue:', error);
  process.exit(1);
});
