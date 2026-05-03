import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';

@Injectable({ providedIn: 'root' })
export class WhatsappService {
  constructor(private dbService: DatabaseService) {}

  buildReminderUrl(whatsappNumber: string, studentName: string, amount: number, monthYear: string): string {
    const template = this.getTemplate();
    const currency = this.getCurrency();
    const month = this.formatMonth(monthYear);

    const message = template
      .replace('{name}', studentName)
      .replace('{currency}', currency)
      .replace('{amount}', amount.toString())
      .replace('{month}', month);

    // Clean phone number - remove spaces, dashes, and ensure country code
    let phone = whatsappNumber.replace(/[\s\-\(\)]/g, '');
    if (phone.startsWith('0')) {
      phone = '91' + phone.substring(1); // Default to India +91
    }
    if (!phone.startsWith('+') && !phone.startsWith('91')) {
      phone = '91' + phone;
    }
    phone = phone.replace('+', '');

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  getTemplate(): string {
    const result = this.dbService.query<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'whatsapp_template'"
    );
    return result[0]?.value || 'Hi {name}, your fee of {currency}{amount} for {month} is overdue.';
  }

  getCurrency(): string {
    const result = this.dbService.query<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'currency'"
    );
    return result[0]?.value || '₹';
  }

  private formatMonth(monthYear: string): string {
    const [year, month] = monthYear.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }
}
