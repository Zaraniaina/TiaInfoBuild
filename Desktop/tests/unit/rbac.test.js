const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, '..', '..', 'main.js');
const mainContent = fs.readFileSync(mainPath, 'utf8');

function extractFunction(source, fnName) {
  const regex = new RegExp(`function ${fnName}\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`);
  const match = source.match(regex);
  if (!match) throw new Error(`Function ${fnName} not found`);
  let body = match[1];
  if (fnName === 'getSessionRoles') {
    body = body.replace(/_session/g, 'this._session');
  }
  return body;
}

function extractConst(source, constName) {
  const regex = new RegExp(`const ${constName} = ([\\s\\S]*?);`);
  const match = source.match(regex);
  if (!match) throw new Error(`Const ${constName} not found`);
  return match[1];
}

const normalizeRoleCodeBody = extractFunction(mainContent, 'normalizeRoleCode');
const getSessionRolesBody = extractFunction(mainContent, 'getSessionRoles');
const isRoleAllowedBody = extractFunction(mainContent, 'isRoleAllowed');
const roleCodeAliases = extractConst(mainContent, 'ROLE_CODE_ALIASES');

const normalizedModule = `
  const ROLE_CODE_ALIASES = ${roleCodeAliases};
  let _session = null;
  function normalizeRoleCode(rawRole) {
    ${normalizeRoleCodeBody}
  }
  function getSessionRoles() {
    ${getSessionRolesBody}
  }
  function isRoleAllowed(allowedRoles, currentRoles) {
    ${isRoleAllowedBody}
  }
`;

eval(normalizedModule);

describe('RBAC — normalizeRoleCode', () => {
  test('gère les alias DIRECTEUR', () => {
    expect(normalizeRoleCode('direction')).toBe('DIRECTEUR');
    expect(normalizeRoleCode('daf')).toBe('DIRECTEUR');
    expect(normalizeRoleCode('directeur')).toBe('DIRECTEUR');
  });

  test('gère les alias COMMERCIAL', () => {
    expect(normalizeRoleCode('commercial')).toBe('COMMERCIAL');
  });

  test('ne retourne pas RESPONSABLE_MATERIEL', () => {
    expect(normalizeRoleCode('responsable_materiel')).not.toBe('RESPONSABLE_MATERIEL');
  });

  test('retourne ADMIN par défaut', () => {
    expect(normalizeRoleCode('')).toBe('ADMIN');
    expect(normalizeRoleCode(null)).toBe('ADMIN');
  });
});

describe('RBAC — getSessionRoles', () => {
  test('déduit les rôles depuis _session', () => {
    const session = { roleCode: 'ADMIN,DIRECTEUR', roleNom: 'admin' };
    const context = { _session: session };
    const roles = getSessionRoles.call(context);
    expect(roles).toContain('ADMIN');
    expect(roles).toContain('DIRECTEUR');
  });

  test('retourne un tableau vide si pas de session', () => {
    const roles = getSessionRoles.call({ _session: null });
    expect(roles).toEqual([]);
  });
});

describe('RBAC — isRoleAllowed', () => {
  test('autorise si le rôle est dans la liste', () => {
    expect(isRoleAllowed(['ADMIN', 'DIRECTEUR'], ['CHEF_CHANTIER', 'DIRECTEUR'])).toBe(true);
  });

  test('refuse si le rôle n\'est pas dans la liste', () => {
    expect(isRoleAllowed(['ADMIN', 'DIRECTEUR'], ['CHEF_CHANTIER', 'COMMERCIAL'])).toBe(false);
  });

  test('autorise si allowedRoles est vide', () => {
    expect(isRoleAllowed([], ['CHEF_CHANTIER'])).toBe(true);
  });
});

describe('RBAC — secureHandle (canaux sensibles)', () => {
  test('backup:exportSQLite est protégé', () => {
    expect(mainContent).toContain("secureHandle('backup:exportSQLite', backupRoles");
  });

  test('backup:import est protégé', () => {
    expect(mainContent).toContain("secureHandle('backup:import', backupRoles");
  });

  test('backup:restore est protégé', () => {
    expect(mainContent).toContain("secureHandle('backup:restore', backupRoles");
  });

  test('sync:setConfig est réservé à ADMIN', () => {
    expect(mainContent).toContain("secureHandle('sync:setConfig', ['ADMIN']");
  });

  test('sync:push est réservé à ADMIN', () => {
    expect(mainContent).toContain("secureHandle('sync:push', ['ADMIN']");
  });

  test('preferences:get vérifie la propriété', () => {
    expect(mainContent).toContain("secureHandle('preferences:get', ['ADMIN', 'RH']");
    expect(mainContent).toContain('userId !== _session.id');
  });

  test('preferences:update vérifie la propriété', () => {
    expect(mainContent).toContain("secureHandle('preferences:update', ['ADMIN', 'RH']");
    expect(mainContent).toContain('userId !== _session.id');
  });

  test('alertes:delete est restreint', () => {
    expect(mainContent).toContain("const rolesAlertesDelete = ['ADMIN', 'DIRECTEUR', 'COMPTABLE']");
    expect(/secureHandle\('alertes:delete',\s+rolesAlertesDelete/.test(mainContent)).toBe(true);
  });
});
