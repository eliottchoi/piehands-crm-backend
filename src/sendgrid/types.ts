// SendGrid TypeScript 타입 정의

export interface SendGridMailData {
  to: string | string[];
  from: {
    email: string;
    name?: string;
  };
  subject: string;
  html?: string;
  text?: string;
  customArgs?: Record<string, string>;
  trackingSettings?: {
    clickTracking?: { enable: boolean; enableText?: boolean };
    openTracking?: { enable: boolean; substitutionTag?: string };
    subscriptionTracking?: { 
      enable: boolean;
      text?: string;
      html?: string;
    };
  };
  mailSettings?: {
    spamCheck?: { enable: boolean; threshold?: number };
  };
}

export interface SendGridResponse {
  statusCode: number;
  body: any;
  headers: Record<string, string>;
}

export interface SendGridEvent {
  event: 'delivered' | 'opened' | 'clicked' | 'bounce' | 'unsubscribe' | 'spam_report' | 'dropped' | 'deferred';
  email: string;
  timestamp: number;
  sg_message_id: string;
  sg_event_id?: string;
  useragent?: string;
  ip?: string;
  url?: string; // for click events
  reason?: string; // for bounce events
  status?: string; // for bounce events
  type?: string; // 'bounce', 'blocked'
  
  // Additional fields for different event types
  category?: string[];
  asm_group_id?: number;
  response?: string;
}

export interface EmailLogCreateData {
  userId: string;
  campaignId?: string;
  templateId?: string;
  sendgridMessageId?: string;
  toEmail: string;
  fromEmail?: string;
  subject?: string;
  contentPreview?: string;
  status?: string;
  errorMessage?: string;
  sentAt?: Date;
}

export interface UserEventData {
  userId: string;
  name: string;
  properties: Record<string, any>;
  timestamp?: Date;
}
