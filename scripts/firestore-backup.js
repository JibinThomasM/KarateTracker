const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin with service account
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const COLLECTIONS = ['dojos', 'students', 'attendance', 'payments', 'settings', 'feePlans', 'reminders'];

async function exportCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  const docs = [];
  snapshot.forEach(doc => {
    docs.push({ id: doc.id, ...doc.data() });
  });
  return docs;
}

async function runBackup() {
  console.log('Starting Firestore backup...');
  const backup = {};

  for (const collection of COLLECTIONS) {
    try {
      backup[collection] = await exportCollection(collection);
      console.log(`  ${collection}: ${backup[collection].length} documents`);
    } catch (err) {
      console.warn(`  ${collection}: failed - ${err.message}`);
      backup[collection] = [];
    }
  }

  // Write backup file
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const date = new Date().toISOString().split('T')[0];
  const filePath = path.join(backupDir, `backup-${date}.json`);
  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));
  console.log(`Backup saved to: ${filePath}`);

  // Keep only last 30 backups
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
    .sort();

  if (files.length > 30) {
    const toDelete = files.slice(0, files.length - 30);
    toDelete.forEach(f => {
      fs.unlinkSync(path.join(backupDir, f));
      console.log(`  Deleted old backup: ${f}`);
    });
  }

  console.log('Backup complete!');
}

runBackup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
