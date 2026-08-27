const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, '..', '..', 'main.js');
const mainContent = fs.readFileSync(mainPath, 'utf8');

const layoutPath = path.join(__dirname, '..', '..', 'views', 'layout.js');
const layoutContent = fs.readFileSync(layoutPath, 'utf8');

describe('IPC RBAC — Nouveaux canaux factures', () => {
  test('factures:envoyer est enregistré dans main.js', () => {
    expect(mainContent).toContain("secureHandle('factures:envoyer'");
  });

  test('factures:dupliquer est enregistré dans main.js', () => {
    expect(mainContent).toContain("secureHandle('factures:dupliquer'");
  });

  test('factures:envoyer protège par ADMIN, COMMERCIAL, COMPTABLE', () => {
    const match = mainContent.match(/secureHandle\('factures:envoyer',\s*\[([^\]]+)\]/);
    expect(match).toBeDefined();
    const roles = match[1].split(',').map(r => r.trim().replace(/['"]/g, ''));
    expect(roles).toEqual(expect.arrayContaining(['ADMIN', 'COMMERCIAL', 'COMPTABLE']));
  });

  test('factures:dupliquer protège par ADMIN, COMMERCIAL', () => {
    const match = mainContent.match(/secureHandle\('factures:dupliquer',\s*[^,]+,\s*async/);
    expect(match).toBeDefined();
    const contextMatch = mainContent.match(/secureHandle\('factures:dupliquer',\s*rolesFacturesWrite/);
    expect(contextMatch).toBeDefined();
    expect(mainContent).toContain("secureHandle('factures:dupliquer', rolesFacturesWrite");
  });
});

describe('IPC RBAC — Audit trail', () => {
  test('factures:envoyer est dans auditChannels', () => {
    const auditMatch = mainContent.match(/const auditChannels = \[([\s\S]*?)\];/);
    expect(auditMatch).toBeDefined();
    const channelsStr = auditMatch[1];
    expect(channelsStr).toContain('factures:envoyer');
    expect(channelsStr).toContain('factures:dupliquer');
    expect(channelsStr).toContain('depenses:update');
    expect(channelsStr).toContain('photos:create');
    expect(channelsStr).toContain('backup:import');
    expect(channelsStr).toContain('backup:restore');
    expect(channelsStr).toContain('backup:delete');
  });
});

describe('IPC RBAC — Permissions frontend/backend cohérence', () => {
  test('paiements:update existe dans PERMISSION_MAP', () => {
    expect(layoutContent).toContain("'paiements:update':");
  });

  test('paiements:delete existe dans PERMISSION_MAP', () => {
    expect(layoutContent).toContain("'paiements:delete':");
  });

  test('factures:envoyer existe dans PERMISSION_MAP', () => {
    expect(layoutContent).toContain("'factures:envoyer':");
  });

  test('factures:dupliquer existe dans PERMISSION_MAP', () => {
    expect(layoutContent).toContain("'factures:dupliquer':");
  });

  test('depenses:update existe dans PERMISSION_MAP', () => {
    expect(layoutContent).toContain("'depenses:update':");
  });
});

describe('IPC RBAC — Service email', () => {
  test('emailService.js existe', () => {
    const emailServicePath = path.join(__dirname, '..', '..', 'services', 'emailService.js');
    expect(fs.existsSync(emailServicePath)).toBe(true);
  });

  test('emailService exporte sendInvoiceEmail', () => {
    const emailServicePath = path.join(__dirname, '..', '..', 'services', 'emailService.js');
    const content = fs.readFileSync(emailServicePath, 'utf8');
    expect(content).toContain('sendInvoiceEmail');
  });

  test('Entreprise table contient colonnes SMTP dans init.js', () => {
    const initPath = path.join(__dirname, '..', '..', 'models', 'init.js');
    const initContent = fs.readFileSync(initPath, 'utf8');
    expect(initContent).toContain('smtpHost');
    expect(initContent).toContain('smtpPort');
    expect(initContent).toContain('smtpUser');
    expect(initContent).toContain('smtpPass');
    expect(initContent).toContain('smtpFrom');
    expect(initContent).toContain('smtpSecure');
  });
});
