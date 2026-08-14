#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const backendPermissionsPath = path.join(root, 'shared', 'permissions.js');
const frontendPermissionsPath = path.join(root, 'views', 'layout.js');

function extractBackendPermissions() {
  const content = fs.readFileSync(backendPermissionsPath, 'utf8');
  const match = content.match(/const PERMISSIONS = ({[\s\S]*?});/);
  if (!match) throw new Error('PERMISSIONS object not found in shared/permissions.js');
  return match[1];
}

function extractFrontendPermissionMap() {
  const content = fs.readFileSync(frontendPermissionsPath, 'utf8');
  const match = content.match(/const PERMISSION_MAP = ({[\s\S]*?};)/);
  if (!match) throw new Error('PERMISSION_MAP object not found in views/layout.js');
  return match[1];
}

function extractFrontendRoleRoutes() {
  const content = fs.readFileSync(frontendPermissionsPath, 'utf8');
  const match = content.match(/const ROLE_ROUTES = ({[\s\S]*?};)/);
  if (!match) throw new Error('ROLE_ROUTES object not found in views/layout.js');
  return match[1];
}

function normalizeRole(role) {
  return role.toUpperCase().trim();
}

function extractRolesFromString(str) {
  const matches = str.match(/'([A-Z_]+)'/g) || [];
  return matches.map(m => m.replace(/'/g, ''));
}

function checkPermissionConsistency() {
  console.log('🔍 Vérification de la cohérence des permissions backend/frontend...\n');

  const backendSource = extractBackendPermissions();
  const frontendSource = extractFrontendPermissionMap();

  const backendKeys = (backendSource.match(/\b([a-zA-Z]+):\s*\{/g) || []).map(m => m.replace(/\s*\{/g, '').trim());
  const frontendKeys = (frontendSource.match(/\b'([^']+)':\s*\[/g) || []).map(m => m.replace(/\s*\[/g, '').replace(/'/g, '').trim());

  const errors = [];
  const warnings = [];

  const backendModules = new Set(backendKeys);
  const frontendModules = new Set(frontendKeys.map(k => k.split(':')[0]));

  for (const key of frontendKeys) {
    const [module, action] = key.split(':');
    const frontendMatch = frontendSource.match(new RegExp(`'${key}':\\s*\\[[\\s\\S]*?\\]`));
    const frontendRoles = frontendMatch ? extractRolesFromString(frontendMatch[0]) : [];

    if (!backendModules.has(module)) {
      warnings.push(`Module frontend "${module}" absent du backend`);
      continue;
    }

    const backendBlockMatch = backendSource.match(new RegExp(`\\b${module}:\\s*\\{[\\s\\S]*?\\}`));
    if (!backendBlockMatch) {
      warnings.push(`Module backend "${module}" introuvable`);
      continue;
    }

    const backendBlock = backendBlockMatch[0];
    const isObject = backendBlock.includes('read:') || backendBlock.includes('write:');

    if (isObject) {
      const readMatch = backendBlock.match(/read:\s*\[([\s\S]*?)\]/);
      const writeMatch = backendBlock.match(/write:\s*\[([\s\S]*?)\]/);
      const backendReadRoles = readMatch ? extractRolesFromString(readMatch[0]) : [];
      const backendWriteRoles = writeMatch ? extractRolesFromString(writeMatch[0]) : [];

      const expectedBackend = action === 'list' || action === 'get' ? backendReadRoles : backendWriteRoles;

      const normalizedFrontend = frontendRoles.map(normalizeRole);
      const normalizedBackend = expectedBackend.map(normalizeRole);

      for (const role of normalizedFrontend) {
        if (!normalizedBackend.includes(role)) {
          errors.push(`[RBAC] ${key}: rôle "${role}" autorisé en frontend mais pas en backend`);
        }
      }
    } else {
      const backendRolesMatch = backendBlock.match(/\[([\s\S]*?)\]/);
      const backendRoles = backendRolesMatch ? extractRolesFromString(backendRolesMatch[0]) : [];
      const normalizedBackend = backendRoles.map(normalizeRole);
      const normalizedFrontend = frontendRoles.map(normalizeRole);

      for (const role of normalizedFrontend) {
        if (!normalizedBackend.includes(role)) {
          errors.push(`[RBAC] ${key}: rôle "${role}" autorisé en frontend mais pas en backend`);
        }
      }
    }
  }

  if (errors.length === 0) {
    console.log('✅ Aucune incohérence RBAC détectée entre backend et frontend.\n');
  } else {
    console.log(`❌ ${errors.length} incohérence(s) RBAC détectée(s) :\n`);
    errors.forEach(e => console.log('  - ' + e));
    console.log();
  }

  if (warnings.length > 0) {
    console.log(`⚠️  ${warnings.length} avertissement(s) :\n`);
    warnings.forEach(w => console.log('  - ' + w));
    console.log();
  }

  return errors.length === 0 ? 0 : 1;
}

function checkRoleRoutesConsistency() {
  console.log('🔍 Vérification de la cohérence des routes par rôle...\n');

  const frontendSource = extractFrontendPermissionMap();
  const routesSource = extractFrontendRoleRoutes();

  const frontendKeys = (frontendSource.match(/\b'([^']+)':\s*\[/g) || []).map(m => m.replace(/\s*\[/g, '').replace(/'/g, '').trim());
  const frontendModules = new Set(frontendKeys.map(k => k.split(':')[0]));

  const routeMatches = routesSource.match(/[A-Z_]+:\s*\[[\s\S]*?\]/g) || [];
  const warnings = [];

  for (const routeBlock of routeMatches) {
    const roleMatch = routeBlock.match(/^([A-Z_]+):/);
    if (!roleMatch) continue;
    const role = roleMatch[1];
    const routes = extractRolesFromString(routeBlock);

    for (const route of routes) {
      if (!frontendModules.has(route)) {
        warnings.push(`Route "${route}" assignée au rôle ${role} mais aucun module frontend correspondant`);
      }
    }
  }

  if (warnings.length === 0) {
    console.log('✅ Toutes les routes par rôle sont cohérentes avec les modules frontend.\n');
  } else {
    console.log(`⚠️  ${warnings.length} avertissement(s) :\n`);
    warnings.forEach(w => console.log('  - ' + w));
    console.log();
  }

  return 0;
}

const exitCode = checkPermissionConsistency();
const routesExitCode = checkRoleRoutesConsistency();

process.exit(Math.max(exitCode, routesExitCode));
