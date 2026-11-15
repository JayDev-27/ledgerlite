import { repository } from './repository';
import { seedDatabase } from './seed';
import { APP_NAME } from '@/constants/app';

async function run() {
  console.log(`Seeding ${APP_NAME} database...`);
  try {
    const result = await seedDatabase(repository, true);
    console.log('Database seeded successfully:');
    console.log(`- Categories: ${result.categoriesCount}`);
    console.log(`- Transactions: ${result.transactionsCount}`);
    console.log(`- Budgets: ${result.budgetsCount}`);
    console.log(`- Learned Rules: ${result.rulesCount}`);
    console.log(`- Recurring Templates: ${result.recurringCount}`);
    console.log(`- Memory Items: ${result.memoryCount}`);
  } catch (error) {
    console.error('Failed to seed database:', error);
    process.exit(1);
  }
}

run();
