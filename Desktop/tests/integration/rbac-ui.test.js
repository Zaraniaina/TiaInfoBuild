const fs = require('fs');
const path = require('path');

const layoutPath = path.join(__dirname, '..', '..', 'views', 'layout.js');
const layoutContent = fs.readFileSync(layoutPath, 'utf8');

const permissionsPath = path.join(__dirname, '..', '..', 'shared', 'permissions.js');
const permissionsContent = fs.readFileSync(permissionsPath, 'utf8');

function extractObject(source, varName) {
  const match = source.match(new RegExp(`const ${varName} = ({[\\s\\S]*?});`));
  if (!match) throw new Error(`${varName} not found`);
  return match[1];
}

function extractRolesFromString(str) {
  const matches = str.match(/'([A-Z_a-z-]+)'/g) || [];
  return matches.map(m => m.replace(/'/g, ''));
}

const permissionMapSource = extractObject(layoutContent, 'PERMISSION_MAP');
const roleRoutesSource = extractObject(layoutContent, 'ROLE_ROUTES');
const permissionsSource = extractObject(permissionsContent, 'PERMISSIONS');
const roleAliasesSource = extractObject(permissionsContent, 'ROLE_ALIASES');

const permissionMapKeys = (permissionMapSource.match(/'([^']+)':\s*\[/g) || []).map(m => {
  const keyMatch = m.match(/'([^']+)':/);
  return keyMatch ? keyMatch[1].trim() : null;
}).filter(Boolean);
const roleRoutesKeys = (roleRoutesSource.match(/[A-Z_]+:\s*\[/g) || []).map(m => m.replace(/\s*\[/g, '').trim());

describe('RBAC UI — Cohérence permissions backend/frontend', () => {
  test('COMMERCIAL n\'est plus autorisé sur les chantiers', () => {
    const entry = permissionMapKeys.find(k => k.startsWith('chantiers:'));
    expect(entry).toBeDefined();
    const match = permissionMapSource.match(new RegExp(`'${entry}':\\s*\\[[\\s\\S]*?\\]`));
    const roles = extractRolesFromString(match[0]);
    expect(roles).not.toContain('COMMERCIAL');
  });

  test('COMMERCIAL n\'est plus autorisé sur la lecture des articles', () => {
    const match = permissionMapSource.match(/'articles:list':\s*\[[\s\S]*?\]/);
    expect(match).toBeDefined();
    const roles = extractRolesFromString(match[0]);
    expect(roles).not.toContain('COMMERCIAL');
  });

  test('CHEF_CHANTIER ne peut plus créer de dépenses', () => {
    const match = permissionMapSource.match(/'depenses:create':\s*\[[\s\S]*?\]/);
    expect(match).toBeDefined();
    const roles = extractRolesFromString(match[0]);
    expect(roles).not.toContain('CHEF_CHANTIER');
  });

  test('CHEF_PROJET ne peut plus créer de dépenses', () => {
    const match = permissionMapSource.match(/'depenses:create':\s*\[[\s\S]*?\]/);
    expect(match).toBeDefined();
    const roles = extractRolesFromString(match[0]);
    expect(roles).not.toContain('CHEF_PROJET');
  });

  test('DIRECTEUR peut consulter les paiements', () => {
    const match = permissionMapSource.match(/'paiements:list':\s*\[[\s\S]*?\]/);
    expect(match).toBeDefined();
    const roles = extractRolesFromString(match[0]);
    expect(roles).toContain('DIRECTEUR');
  });

  test('COMMERCIAL ne peut pas supprimer de paiements', () => {
    const match = permissionMapSource.match(/'paiements:delete':\s*\[[\s\S]*?\]/);
    expect(match).toBeDefined();
    const roles = extractRolesFromString(match[0]);
    expect(roles).not.toContain('COMMERCIAL');
  });

  test('COMPTABLE peut supprimer des paiements', () => {
    const match = permissionMapSource.match(/'paiements:delete':\s*\[[\s\S]*?\]/);
    expect(match).toBeDefined();
    const roles = extractRolesFromString(match[0]);
    expect(roles).toContain('COMPTABLE');
  });

  test('CHEF_PROJET peut consulter les heures sup', () => {
    const match = permissionMapSource.match(/'heures-sup:list':\s*\[[\s\S]*?\]/);
    expect(match).toBeDefined();
    const roles = extractRolesFromString(match[0]);
    expect(roles).toContain('CHEF_PROJET');
  });

  test('CHEF_PROJET peut consulter les matériels', () => {
    const match = permissionMapSource.match(/'materiels:list':\s*\[[\s\S]*?\]/);
    expect(match).toBeDefined();
    const roles = extractRolesFromString(match[0]);
    expect(roles).toContain('CHEF_PROJET');
  });

  test('CHEF_PROJET peut consulter les dépenses', () => {
    const match = permissionMapSource.match(/'depenses:list':\s*\[[\s\S]*?\]/);
    expect(match).toBeDefined();
    const roles = extractRolesFromString(match[0]);
    expect(roles).toContain('CHEF_PROJET');
  });

  test('ROLE_ROUTES contient les nouvelles routes pour CHEF_PROJET', () => {
    const match = roleRoutesSource.match(/CHEF_PROJET:\s*\[[\s\S]*?\]/);
    expect(match).toBeDefined();
    const routes = extractRolesFromString(match[0]);
    expect(routes).toContain('heures-sup');
    expect(routes).toContain('materiels');
    expect(routes).toContain('depenses');
  });
});

describe('RBAC UI — Alias et rôles', () => {
  test('DIRECTION est un alias de DIRECTEUR dans les permissions backend', () => {
    const aliasesMatch = roleAliasesSource.match(/DIRECTION:\s*'([^']+)'/);
    expect(aliasesMatch).toBeDefined();
    expect(aliasesMatch[1]).toBe('DIRECTEUR');
  });

  test('RESPONSABLE_MATERIEL n\'apparaît pas dans les alias frontend', () => {
    const aliasesMatch = layoutContent.match(/const ROLE_CODE_ALIASES = ({[\s\S]*?});/);
    expect(aliasesMatch).toBeDefined();
    expect(aliasesMatch[1]).not.toContain('responsable_materiel');
  });

  test('RESPONSABLE_MATERIEL n\'apparaît pas dans les alias backend', () => {
    expect(permissionsContent).not.toContain('RESPONSABLE_MATERIEL');
  });
});
