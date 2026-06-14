// Run this to generate a bcrypt hash for your passwords!
// Usage: node hash-password.js "yourPassword123"
const bcrypt = require('bcryptjs');

const password = process.argv[2] || 'test123';

bcrypt.hash(password, 10, function(err, hash) {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Password:', password);
    console.log('Hashed Password:', hash);
    console.log('\nUse this hashed password in your Supabase users table!');
  }
});
