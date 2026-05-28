const admin = require('firebase-admin');

// Initialize Firebase Admin with service account
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const DRY_RUN = process.env.DRY_RUN === 'true';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const GRAPH_API_VERSION = 'v21.0';

// Escalation schedule: [daysOverdue, reminderType, templateName]
const ESCALATION_SCHEDULE = [
  { days: 0,  type: 'due_today',     template: 'fee_due_today' },
  { days: 3,  type: 'overdue_3',     template: 'fee_overdue_reminder' },
  { days: 7,  type: 'overdue_7',     template: 'fee_overdue_reminder' },
  { days: 14, type: 'overdue_14',    template: 'fee_overdue_reminder' },
  { days: 21, type: 'overdue_final', template: 'fee_overdue_final' },
];

// Stats for summary
const stats = { sent: 0, skipped: 0, failed: 0, noPhone: 0, statusUpdated: 0 };

/**
 * Format phone number for WhatsApp API (same logic as whatsapp.service.ts)
 */
function formatPhone(whatsappNumber) {
  let phone = whatsappNumber.replace(/[\s\-\(\)]/g, '');
  if (phone.startsWith('0')) {
    phone = '91' + phone.substring(1);
  }
  if (!phone.startsWith('+') && !phone.startsWith('91')) {
    phone = '91' + phone;
  }
  phone = phone.replace('+', '');
  return phone;
}

/**
 * Format monthYear (YYYY-MM) to readable string (e.g., "May 2026")
 */
function formatMonth(monthYear) {
  const [year, month] = monthYear.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Calculate days between two YYYY-MM-DD date strings
 */
function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1 + 'T00:00:00Z');
  const d2 = new Date(dateStr2 + 'T00:00:00Z');
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

/**
 * Determine which reminder type should be sent based on days overdue
 */
function getReminderType(daysOverdue) {
  // Find the highest escalation level that applies
  let matched = null;
  for (const level of ESCALATION_SCHEDULE) {
    if (daysOverdue >= level.days) {
      matched = level;
    }
  }
  return matched;
}

/**
 * Send WhatsApp template message via Meta Cloud API
 */
async function sendWhatsAppMessage(phone, templateName, parameters) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const body = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'en' },
      components: [{
        type: 'body',
        parameters: parameters.map(text => ({ type: 'text', text }))
      }]
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || JSON.stringify(data));
  }

  return data.messages?.[0]?.id || null;
}

/**
 * Update pending payments to overdue if past due date (for all dojos)
 */
async function updateOverdueStatuses(today) {
  const snapshot = await db.collection('payments')
    .where('status', '==', 'pending')
    .get();

  const batch = db.batch();
  let count = 0;

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.dueDate < today) {
      batch.update(doc.ref, { status: 'overdue' });
      count++;
    }
  });

  if (count > 0) {
    await batch.commit();
    console.log(`  Updated ${count} payments from 'pending' to 'overdue'`);
  }
  stats.statusUpdated = count;
}

/**
 * Fetch settings from Firestore
 */
async function getSettings() {
  const doc = await db.doc('settings/config').get();
  return doc.exists ? doc.data() : {};
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main reminder logic
 */
async function sendReminders() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`WhatsApp Payment Reminders — ${today}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no messages will be sent)' : 'LIVE'}`);
  console.log('---');

  // Step 1: Update overdue statuses
  console.log('Step 1: Updating overdue statuses...');
  await updateOverdueStatuses(today);

  // Step 2: Get settings for currency
  const settings = await getSettings();
  const currency = settings.currency || '₹';

  // Step 3: Fetch all active dojos
  const dojosSnapshot = await db.collection('dojos')
    .where('isActive', '==', true)
    .get();

  const dojos = dojosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`\nStep 2: Found ${dojos.length} active dojo(s)`);

  // Step 4: For each dojo, process overdue/pending payments
  for (const dojo of dojos) {
    console.log(`\n--- Dojo: ${dojo.name} (${dojo.id}) ---`);

    // Fetch pending + overdue payments for this dojo
    const paymentsSnapshot = await db.collection('payments')
      .where('dojoId', '==', dojo.id)
      .where('status', 'in', ['pending', 'overdue'])
      .get();

    const payments = paymentsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(p => p.status === 'overdue' || (p.status === 'pending' && p.dueDate <= today));

    if (payments.length === 0) {
      console.log('  No due/overdue payments found.');
      continue;
    }

    console.log(`  Found ${payments.length} due/overdue payment(s)`);

    // Fetch all existing reminders for this dojo to check duplicates (batch read)
    const remindersSnapshot = await db.collection('reminders')
      .where('dojoId', '==', dojo.id)
      .get();

    // Build a set of "paymentId_reminderType" for quick lookup
    const sentReminders = new Set();
    remindersSnapshot.docs.forEach(doc => {
      const r = doc.data();
      if (r.status === 'sent') {
        sentReminders.add(`${r.paymentId}_${r.reminderType}`);
      }
    });

    // Process each payment
    for (const payment of payments) {
      const daysOverdue = daysBetween(payment.dueDate, today);
      const level = getReminderType(daysOverdue);

      if (!level) {
        continue; // Not yet due
      }

      // Check if this reminder type was already sent
      const reminderKey = `${payment.id}_${level.type}`;
      if (sentReminders.has(reminderKey)) {
        stats.skipped++;
        continue;
      }

      // Check for valid WhatsApp number
      if (!payment.whatsappNumber || payment.whatsappNumber.trim() === '') {
        console.log(`  SKIP (no phone): ${payment.studentName} — ${payment.monthYear}`);
        stats.noPhone++;
        continue;
      }

      const phone = formatPhone(payment.whatsappNumber);
      const month = formatMonth(payment.monthYear);
      const amount = payment.amountDue.toString();

      // Build template parameters
      let templateParams;
      if (level.template === 'fee_due_today') {
        // Parameters: name, currency, amount, month
        templateParams = [payment.studentName, currency, amount, month];
      } else {
        // Parameters: name, currency, amount, month, daysOverdue
        templateParams = [payment.studentName, currency, amount, month, daysOverdue.toString()];
      }

      console.log(`  → ${payment.studentName} | ${phone} | ${level.type} | ${currency}${amount} | ${month}`);

      if (DRY_RUN) {
        // Record in Firestore even in dry run so we can inspect, but mark differently
        stats.sent++;
        continue;
      }

      // Send the message
      try {
        const messageId = await sendWhatsAppMessage(phone, level.template, templateParams);

        // Record success in reminders collection
        await db.collection('reminders').add({
          paymentId: payment.id,
          studentId: payment.studentId,
          dojoId: dojo.id,
          whatsappNumber: phone,
          reminderType: level.type,
          sentAt: new Date().toISOString(),
          status: 'sent',
          messageId: messageId || '',
          monthYear: payment.monthYear
        });

        stats.sent++;
        sentReminders.add(reminderKey); // Prevent duplicate within same run

        // Rate limiting — 1 second between messages
        await sleep(1000);
      } catch (err) {
        console.error(`  FAILED: ${payment.studentName} — ${err.message}`);

        // Record failure
        await db.collection('reminders').add({
          paymentId: payment.id,
          studentId: payment.studentId,
          dojoId: dojo.id,
          whatsappNumber: phone,
          reminderType: level.type,
          sentAt: new Date().toISOString(),
          status: 'failed',
          errorMessage: err.message,
          monthYear: payment.monthYear
        });

        stats.failed++;
      }
    }
  }

  // Summary
  console.log('\n===== SUMMARY =====');
  console.log(`Statuses updated:    ${stats.statusUpdated}`);
  console.log(`Reminders sent:      ${stats.sent}`);
  console.log(`Skipped (already):   ${stats.skipped}`);
  console.log(`Skipped (no phone):  ${stats.noPhone}`);
  console.log(`Failed:              ${stats.failed}`);
  console.log('===================');

  if (stats.failed > 0) {
    process.exitCode = 1; // Signal partial failure without crashing
  }
}

sendReminders().catch(err => {
  console.error('Reminder script failed:', err);
  process.exit(1);
});
