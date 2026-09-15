import { api } from './api'

/** Paramètres SMTP — interface dédiée de mise en production (super admin). */

export interface MailSettingsPayload {
  provider?: string
  smtp_host?: string
  smtp_port?: number
  smtp_user?: string
  smtp_password?: string
  smtp_tls?: boolean
  smtp_ssl?: boolean
  smtp_from_email?: string
  smtp_from_name?: string
  frontend_url?: string
  is_active?: boolean
}

export interface MailSettings extends MailSettingsPayload {
  id: number | null
  has_password: boolean
  is_active: boolean
  last_test_at: string | null
  last_test_status: string | null
  last_test_message: string | null
  /** `database` = config active en base, `env` = repli sur le .env du serveur. */
  effective_source: 'database' | 'env' | string
  updated_at: string | null
}

export interface MailProviderPresets {
  providers: Record<string, MailSettingsPayload>
  labels: Record<string, string>
}

export interface MailCheckItem {
  code: string
  label: string
  ok: boolean
  required: boolean
  hint: string
}

export interface MailDiagnostics {
  ready: boolean
  effective_source: string
  provider: string
  checks: MailCheckItem[]
}

export interface MailTestResult {
  success: boolean
  message: string
  detail?: string | null
  tested_at?: string | null
}

export const mailSettingsService = {
  async get() {
    const res = await api.get<MailSettings>('/super-admin/mail-settings')
    return res.data
  },

  async getProviders() {
    const res = await api.get<MailProviderPresets>('/super-admin/mail-settings/providers')
    return res.data
  },

  async getDiagnostics() {
    const res = await api.get<MailDiagnostics>('/super-admin/mail-settings/diagnostics')
    return res.data
  },

  async save(payload: MailSettingsPayload) {
    const res = await api.put<MailSettings>('/super-admin/mail-settings', payload)
    return res.data
  },

  /** Teste la configuration ACTIVE (base ou .env). */
  async sendTest(toEmail: string) {
    const res = await api.post<MailTestResult>('/super-admin/mail-settings/test', { to_email: toEmail })
    return res.data
  },

  /** Teste les valeurs SAISIES, sans rien enregistrer (avant mise en production). */
  async sendTestDraft(toEmail: string, payload: MailSettingsPayload) {
    const res = await api.post<MailTestResult>('/super-admin/mail-settings/test-draft', {
      ...payload,
      to_email: toEmail,
    })
    return res.data
  },

  /** Désactive la config en base : retour immédiat au SMTP du .env. */
  async reset() {
    const res = await api.post<MailSettings>('/super-admin/mail-settings/reset')
    return res.data
  },
}