import { Injectable } from '@angular/core';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class WhatsappService {
  constructor(private settingsService: SettingsService) {}

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
    return this.settingsService.get('whatsapp_template') || 'Hi {name}, your fee of {currency}{amount} for {month} is overdue.';
  }

  getCurrency(): string {
    return this.settingsService.get('currency') || '₹';
  }

  private formatMonth(monthYear: string): string {
    const [year, month] = monthYear.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }
}
