export type OutlookMailStatus = {
  configured: boolean;
  connected: boolean;
  email?: string;
  displayName?: string;
  error?: string;
};

export type EmailThread = {
  id: string;
  subject: string;
  conversationId: string;
  receivedDateTime: string;
  isDraft: boolean;
  from: { emailAddress: { name: string; address: string } };
};

export type AppSessionInfo = {
  email: string;
  name: string;
  provider: "microsoft";
  issuedAt: number;
  expiresAt: number;
  microsoftScope?: string;
};
