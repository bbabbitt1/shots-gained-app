import bcrypt from 'bcryptjs';
import { getPool, closePool } from './connection.js';

const run = async () => {
  const pool = await getPool();
  const hash = await bcrypt.hash('Nugget1021!', 10);
  await pool.request()
    .input('hash', hash)
    .input('email', 'bbabbitt@greensidedata.com')
    .query('UPDATE DimPlayer SET PasswordHash = @hash WHERE Email = @email');
  console.log('Password reset to: password123');
  await closePool();
};

run().catch(console.error);
